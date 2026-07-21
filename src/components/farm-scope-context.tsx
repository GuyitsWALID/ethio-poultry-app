/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

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
const SCOPE_STORAGE_KEY = "app_scope_state_v1";
const PERIOD_STORAGE_KEY = "app_reporting_period_v1";

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

  useEffect(() => {
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY);
    if (saved) {
      try {
        setScope(JSON.parse(saved) as ScopeState);
      } catch {
        setScope(initialScope);
      }
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as ReportingPeriod;
      if (parsed.dateFrom && parsed.dateTo && parsed.dateFrom <= parsed.dateTo) setPeriod(parsed);
    } catch {
      setPeriod(reportingPeriodFor("mtd"));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(scope));
  }, [scope]);

  useEffect(() => {
    localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(period));
  }, [period]);

  useEffect(() => {
    const loadScopeData = async () => {
      setLoading(true);
      const supabase = createClient();
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

      // CEO/System users: full org scope
      if (!isManager) {
        const response = await fetch("/api/scope/options", { method: "GET" });
        if (!response.ok) {
          setBranches([]);
          setFarms([]);
          setHouses([]);
          setFlocks([]);
          setBatches([]);
          setLoading(false);
          return;
        }

        const data = await response.json();
        const nextBranches = (data?.branches ?? []) as Branch[];
        const nextFarms = (data?.farms ?? []) as Farm[];
        const nextHouses = (data?.houses ?? []) as House[];
        const nextFlocks = (data?.flocks ?? []) as Flock[];
        const nextBatches = (data?.batches ?? []) as Batch[];
        setBranches(nextBranches);
        setFarms(nextFarms);
        setHouses(nextHouses);
        setFlocks(nextFlocks);
        setBatches(nextBatches);
        setScope((prev) => normalizeScope(prev, { branches: nextBranches, farms: nextFarms, houses: nextHouses, flocks: nextFlocks, batches: nextBatches }));
        setLoading(false);
        return;
      }

      // Farm manager: access-limited scope
      const [{ data: branchAccessRows }, { data: farmAccessRows }] = await Promise.all([
        supabase.from("user_branch_access").select("branch_id").eq("profile_id", userId),
        supabase.from("user_farm_access").select("farm_id").eq("profile_id", userId),
      ]);

      const allowedBranchIds = (branchAccessRows ?? []).map((row) => row.branch_id);
      const allowedFarmIds = (farmAccessRows ?? []).map((row) => row.farm_id);

      let farmsQuery = supabase.from("farms").select("id, name, branch_id").eq("org_id", orgId);

      if (allowedBranchIds.length > 0 || allowedFarmIds.length > 0) {
        const orFilters: string[] = [];
        if (allowedBranchIds.length > 0) orFilters.push(`branch_id.in.(${allowedBranchIds.join(",")})`);
        if (allowedFarmIds.length > 0) orFilters.push(`id.in.(${allowedFarmIds.join(",")})`);
        farmsQuery = farmsQuery.or(orFilters.join(","));
      }

      const { data: farmRows } = await farmsQuery.order("name");
      const effectiveFarms = (farmRows ?? []) as Farm[];
      setFarms(effectiveFarms);

      const branchIds = Array.from(new Set(effectiveFarms.map((f) => f.branch_id)));
      let nextBranches: Branch[] = [];
      if (branchIds.length) {
        const { data: branchRows } = await supabase.from("branches").select("id, name").in("id", branchIds).order("name");
        nextBranches = (branchRows ?? []) as Branch[];
        setBranches(nextBranches);
      }

      let nextHouses: House[] = [];
      let nextFlocks: Flock[] = [];
      let nextBatches: Batch[] = [];
      if (effectiveFarms.length) {
        const farmIds = effectiveFarms.map((f) => f.id);
        const [{ data: houseRows }, { data: flockRows }, { data: batchRows }] = await Promise.all([
          supabase.from("houses").select("id, name, farm_id").in("farm_id", farmIds).order("name"),
          supabase.from("flocks").select("id, flock_code, farm_id, house_id, batch_id, initial_count, current_count").in("farm_id", farmIds).order("flock_code"),
          supabase
            .from("batches")
            .select("id, batch_code, status, branch_id, farm_id, house_id, placement_date, age_at_placement_days")
            .in("farm_id", farmIds)
            .order("placement_date", { ascending: false }),
        ]);
        nextHouses = (houseRows ?? []) as House[];
        nextFlocks = (flockRows ?? []) as Flock[];
        nextBatches = (batchRows ?? []) as Batch[];
        setHouses(nextHouses);
        setFlocks(nextFlocks);
        setBatches(nextBatches);
      }
      setScope((prev) =>
        normalizeScope(prev, {
          branches: nextBranches,
          farms: effectiveFarms,
          houses: nextHouses,
          flocks: nextFlocks,
          batches: nextBatches,
        })
      );

      setLoading(false);
    };
    void loadScopeData();
  }, []);

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
    if (scope.batchId) items = items.filter((b) => b.id === scope.batchId);
    return items;
  }, [batches, filteredFlocks, flocks, scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId]);

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
      {children}
    </ScopeContext.Provider>
  );
}

export function useFarmScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useFarmScope must be used within FarmScopeProvider");
  return ctx;
}
