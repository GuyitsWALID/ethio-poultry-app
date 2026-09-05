"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, Suspense, Fragment } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageFilterStorageKey, readPageFilters, writePageFilters, type PageFilterValues } from "@/lib/page-filter-state";

type ScopeState = {
  branchId: string;
  farmId: string;
  batchId: string;
  houseId: string;
  flockId: string;
};

export type PeriodPreset = "today" | "7d" | "30d" | "mtd" | "qtd" | "custom";
export type ReportingPeriod = { preset: PeriodPreset; dateFrom: string; dateTo: string };

type Branch = { id: string; name: string };
type Farm = { id: string; name: string; branch_id: string };
type House = { id: string; name: string; farm_id: string };
type Flock = { id: string; flock_code: string; farm_id: string; house_id: string; batch_id: string | null; initial_count: number; current_count: number };
type Batch = {
  id: string;
  batch_code: string;
  status: string;
  branch_id: string;
  farm_id: string;
  house_id: string;
  placement_date: string | null;
  age_at_placement_days: number | null;
};

type ScopeContextValue = {
  role: string | null;
  isFarmManager: boolean;
  loading: boolean;
  scope: ScopeState;
  setScope: React.Dispatch<React.SetStateAction<ScopeState>>;
  period: ReportingPeriod;
  setPeriod: React.Dispatch<React.SetStateAction<ReportingPeriod>>;
  filterValues: PageFilterValues;
  setFilterValue: (key: string, value: string) => void;
  resetFilters: () => void;
  branches: Branch[];
  farms: Farm[];
  houses: House[];
  flocks: Flock[];
  batches: Batch[];
  filteredFarms: Farm[];
  filteredHouses: House[];
  filteredFlocks: Flock[];
  filteredBatches: Batch[];
};

const initialScope: ScopeState = { branchId: "", farmId: "", batchId: "", houseId: "", flockId: "" };

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function reportingPeriodFor(preset: Exclude<PeriodPreset, "custom">, now = new Date()): ReportingPeriod {
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const start = new Date(end);
  if (preset === "7d") start.setUTCDate(start.getUTCDate() - 6);
  if (preset === "30d") start.setUTCDate(start.getUTCDate() - 29);
  if (preset === "mtd") start.setUTCDate(1);
  if (preset === "qtd") {
    start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
  }
  return { preset, dateFrom: isoDate(start), dateTo: isoDate(end) };
}

function normalizeScope(scope: ScopeState, options: { branches: Branch[]; farms: Farm[]; houses: House[]; flocks: Flock[]; batches: Batch[] }): ScopeState {
  const branchId = options.branches.some((b) => b.id === scope.branchId) ? scope.branchId : "";
  const farmsInBranch = branchId ? options.farms.filter((f) => f.branch_id === branchId) : options.farms;
  const farmId = farmsInBranch.some((f) => f.id === scope.farmId) ? scope.farmId : "";
  const housesInScope = options.houses.filter((h) => (farmId ? h.farm_id === farmId : farmsInBranch.some((f) => f.id === h.farm_id)));
  const houseId = housesInScope.some((h) => h.id === scope.houseId) ? scope.houseId : "";
  const flocksInScope = options.flocks.filter(
    (f) => (farmId ? f.farm_id === farmId : farmsInBranch.some((farm) => farm.id === f.farm_id)) && (!houseId || f.house_id === houseId)
  );
  const flockId = flocksInScope.some((f) => f.id === scope.flockId) ? scope.flockId : "";
  const scopedFlockBatchIds = new Set(flocksInScope.map((f) => f.batch_id).filter((id): id is string => Boolean(id)));
  const batchesInScope = options.batches.filter(
    (b) =>
      (!branchId || b.branch_id === branchId) &&
      (!farmId || scopedFlockBatchIds.has(b.id)) &&
      (!houseId || scopedFlockBatchIds.has(b.id)) &&
      (!flockId || options.flocks.some((f) => f.id === flockId && f.batch_id === b.id))
  );
  const batchId = batchesInScope.some((b) => b.id === scope.batchId) ? scope.batchId : "";
  return { branchId, farmId, houseId, flockId, batchId };
}
const ScopeContext = createContext<ScopeContextValue | null>(null);

export function FarmScopeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <Suspense fallback={<p role="status" className="p-6 text-forest-700">Loading workspace…</p>}><PageScopeProvider key={pathname} pathname={pathname}>{children}</PageScopeProvider></Suspense>;
}

function PageScopeProvider({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const destinationKey = ["finding", "flock", "batch", "record", "record_id", "source_id", "approval", "authorization", "request"].map(key => searchParams.get(key) ?? "").join("|");
  const lastSearch = useRef(search);
  const storageKey = useRef("");
  const [filterValues, setFilterValues] = useState<PageFilterValues>({});
  const setFilterValue = useCallback((key: string, value: string) => setFilterValues(current => current[key] === value ? current : ({ ...current, [key]: value })), []);
  const [role, setRole] = useState<string | null>(null);
  const [isFarmManager, setIsFarmManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<ScopeState>(initialScope);
  const [period, setPeriod] = useState<ReportingPeriod>(() => reportingPeriodFor("mtd"));
  const [branches, setBranches] = useState<Branch[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const restoreFilters = useCallback((values: PageFilterValues, options: { branches: Branch[]; farms: Farm[]; houses: House[]; flocks: Flock[]; batches: Batch[] }) => {
    const nextScope = { ...initialScope };
    for (const key of Object.keys(nextScope) as Array<keyof ScopeState>) nextScope[key] = values[key] ?? "";
    if (!Object.keys(values).length && options.farms.length === 1 && !new URLSearchParams(window.location.search).has("finding")) nextScope.farmId = options.farms[0].id;
    setScope(normalizeScope(nextScope, options));
    const preset = values.preset;
    if (preset === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(values.dateFrom ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(values.dateTo ?? "") && values.dateFrom <= values.dateTo) {
      setPeriod({ preset, dateFrom: values.dateFrom, dateTo: values.dateTo });
    } else setPeriod(reportingPeriodFor(preset === "today" || preset === "7d" || preset === "30d" || preset === "qtd" ? preset : "mtd"));
    setFilterValues(values);
  }, []);

  useEffect(() => {
    if (loading || !storageKey.current) return;
    if (search !== lastSearch.current) {
      lastSearch.current = search;
      restoreFilters(readPageFilters(search, null), { branches, farms, houses, flocks, batches });
      return;
    }
    const values = { ...filterValues, ...scope, ...period };
    try { localStorage.setItem(storageKey.current, JSON.stringify(values)); } catch { /* Filters still work when browser storage is unavailable. */ }
    const next = writePageFilters(window.location.search, values);
    if (next !== search) {
      lastSearch.current = next;
      window.history.replaceState(null, "", `${pathname}?${next}${window.location.hash}`);
    }
  }, [loading, search, filterValues, scope, period, pathname, branches, farms, houses, flocks, batches, restoreFilters]);

  useEffect(() => {
    const loadScopeData = async () => {
      setLoading(true);
      const contextResponse = await fetch("/api/me/context", { method: "GET" });
      if (!contextResponse.ok) {
        setLoading(false);
        return;
      }

      const context = await contextResponse.json();
      const orgId = context?.orgId as string | null;
      const role = context?.role as string | null;
      const userId = context?.userId as string | null;

      if (!orgId || !userId) {
        setLoading(false);
        return;
      }

      setRole(role);
      const isManager = role === "farm_manager";
      setIsFarmManager(isManager);

      // The server applies organization and active farm-assignment scope. Keeping
      // these reads behind one endpoint avoids RLS-dependent empty dropdowns.
      const response = await fetch("/api/scope/options", { method: "GET" });
      if (!response.ok) {
        setBranches([]); setFarms([]); setHouses([]); setFlocks([]); setBatches([]); setLoading(false); return;
      }
      const data = await response.json();
      const nextBranches = (data?.branches ?? []) as Branch[];
      const effectiveFarms = (data?.farms ?? []) as Farm[];
      const nextHouses = (data?.houses ?? []) as House[];
      const nextFlocks = (data?.flocks ?? []) as Flock[];
      const nextBatches = (data?.batches ?? []) as Batch[];
      setBranches(nextBranches);
      setFarms(effectiveFarms);
      setHouses(nextHouses);
      setFlocks(nextFlocks);
      setBatches(nextBatches);
      storageKey.current = pageFilterStorageKey(orgId, userId, pathname);
      let saved: string | null = null;
      try { saved = localStorage.getItem(storageKey.current); } catch { /* Use URL/defaults. */ }
      restoreFilters(readPageFilters(window.location.search, saved), {
          branches: nextBranches,
          farms: effectiveFarms,
          houses: nextHouses,
          flocks: nextFlocks,
          batches: nextBatches,
        });

      setLoading(false);
    };
    void loadScopeData().catch(() => setLoading(false));
  }, [pathname, restoreFilters]);

  const filteredFarms = useMemo(
    () => (scope.branchId ? farms.filter((f) => f.branch_id === scope.branchId) : farms),
    [farms, scope.branchId]
  );
  const farmsInScopeIds = useMemo(() => new Set(filteredFarms.map((f) => f.id)), [filteredFarms]);
  const filteredHouses = useMemo(() => {
    let items = houses.filter((h) => farmsInScopeIds.has(h.farm_id));
    if (scope.farmId) items = items.filter((h) => h.farm_id === scope.farmId);
    return items;
  }, [houses, farmsInScopeIds, scope.farmId]);
  const filteredFlocks = useMemo(() => {
    let items = flocks.filter((f) => farmsInScopeIds.has(f.farm_id));
    if (scope.farmId) items = items.filter((f) => f.farm_id === scope.farmId);
    if (scope.houseId) items = items.filter((f) => f.house_id === scope.houseId);
    return items;
  }, [flocks, farmsInScopeIds, scope.farmId, scope.houseId]);
  const filteredBatches = useMemo(() => {
    let items = batches;
    if (scope.branchId) items = items.filter((b) => b.branch_id === scope.branchId);
    const scopedBatchIds = new Set(filteredFlocks.map((f) => f.batch_id).filter((id): id is string => Boolean(id)));
    if (scope.farmId || scope.houseId) items = items.filter((b) => scopedBatchIds.has(b.id));
    if (scope.flockId) items = items.filter((b) => flocks.some((f) => f.id === scope.flockId && f.batch_id === b.id));
    return items;
  }, [batches, filteredFlocks, flocks, scope.branchId, scope.farmId, scope.houseId, scope.flockId]);

  return (
    <ScopeContext.Provider
      value={{
        role,
        isFarmManager,
        loading,
        scope,
        setScope,
        period,
        setPeriod,
        filterValues,
        setFilterValue,
        resetFilters: () => { setScope(initialScope); setPeriod(reportingPeriodFor("mtd")); setFilterValues({}); },
        branches,
        farms,
        houses,
        flocks,
        batches,
        filteredFarms,
        filteredHouses,
        filteredFlocks,
        filteredBatches,
      }}
    >
      {loading ? <p role="status" className="p-6 text-forest-700">Loading workspace…</p> : <Fragment key={destinationKey}>{children}</Fragment>}
    </ScopeContext.Provider>
  );
}

export function useFarmScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useFarmScope must be used within FarmScopeProvider");
  return ctx;
}
