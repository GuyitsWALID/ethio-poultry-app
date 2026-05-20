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

type Branch = { id: string; name: string };
type Farm = { id: string; name: string; branch_id: string };
type House = { id: string; name: string; farm_id: string };
type Flock = { id: string; flock_code: string; farm_id: string; house_id: string };
type Batch = { id: string; batch_code: string; branch_id: string; farm_id: string; house_id: string; flock_id: string };

type ScopeContextValue = {
  isFarmManager: boolean;
  loading: boolean;
  scope: ScopeState;
  setScope: React.Dispatch<React.SetStateAction<ScopeState>>;
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
const ScopeContext = createContext<ScopeContextValue | null>(null);

export function FarmScopeProvider({ children }: { children: React.ReactNode }) {
  const [isFarmManager, setIsFarmManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<ScopeState>(initialScope);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("farm_manager_scope");
    if (saved) {
      try {
        setScope(JSON.parse(saved) as ScopeState);
      } catch {
        setScope(initialScope);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("farm_manager_scope", JSON.stringify(scope));
  }, [scope]);

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
        setBranches((data?.branches ?? []) as Branch[]);
        setFarms((data?.farms ?? []) as Farm[]);
        setHouses((data?.houses ?? []) as House[]);
        setFlocks((data?.flocks ?? []) as Flock[]);
        setBatches((data?.batches ?? []) as Batch[]);
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
      if (branchIds.length) {
        const { data: branchRows } = await supabase.from("branches").select("id, name").in("id", branchIds).order("name");
        setBranches((branchRows ?? []) as Branch[]);
      }

      if (effectiveFarms.length) {
        const farmIds = effectiveFarms.map((f) => f.id);
        const [{ data: houseRows }, { data: flockRows }, { data: batchRows }] = await Promise.all([
          supabase.from("houses").select("id, name, farm_id").in("farm_id", farmIds).order("name"),
          supabase.from("flocks").select("id, flock_code, farm_id, house_id").in("farm_id", farmIds).order("flock_code"),
          supabase
            .from("batches")
            .select("id, batch_code, branch_id, farm_id, house_id, flock_id")
            .in("farm_id", farmIds)
            .order("placement_date", { ascending: false }),
        ]);
        setHouses((houseRows ?? []) as House[]);
        setFlocks((flockRows ?? []) as Flock[]);
        setBatches((batchRows ?? []) as Batch[]);
      }

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
    if (scope.farmId) items = items.filter((b) => b.farm_id === scope.farmId);
    if (scope.houseId) items = items.filter((b) => b.house_id === scope.houseId);
    if (scope.flockId) items = items.filter((b) => b.flock_id === scope.flockId);
    if (scope.batchId) items = items.filter((b) => b.id === scope.batchId);
    return items;
  }, [batches, scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId]);

  return (
    <ScopeContext.Provider
      value={{
        isFarmManager,
        loading,
        scope,
        setScope,
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
