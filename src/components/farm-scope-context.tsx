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
type Batch = { id: string; batch_code: string; farm_id: string; house_id: string; flock_id: string };

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
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, org_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.org_id) {
        setLoading(false);
        return;
      }

      const isManager = profile.role === "farm_manager";
      setIsFarmManager(isManager);

      // CEO/System users: full org scope
      if (!isManager) {
        const [{ data: branchRows }, { data: farmRows }, { data: houseRows }, { data: flockRows }, { data: batchRows }] =
          await Promise.all([
            supabase.from("branches").select("id, name").eq("org_id", profile.org_id).order("name"),
            supabase.from("farms").select("id, name, branch_id").eq("org_id", profile.org_id).order("name"),
            supabase.from("houses").select("id, name, farm_id").eq("org_id", profile.org_id).order("name"),
            supabase
              .from("flocks")
              .select("id, flock_code, farm_id, house_id")
              .eq("org_id", profile.org_id)
              .order("flock_code"),
            supabase
              .from("batches")
              .select("id, batch_code, farm_id, house_id, flock_id")
              .eq("org_id", profile.org_id)
              .order("placement_date", { ascending: false }),
          ]);

        setBranches((branchRows ?? []) as Branch[]);
        setFarms((farmRows ?? []) as Farm[]);
        setHouses((houseRows ?? []) as House[]);
        setFlocks((flockRows ?? []) as Flock[]);
        setBatches((batchRows ?? []) as Batch[]);
        setLoading(false);
        return;
      }

      // Farm manager: access-limited scope
      const [{ data: branchAccessRows }, { data: farmAccessRows }] = await Promise.all([
        supabase.from("user_branch_access").select("branch_id").eq("profile_id", profile.id),
        supabase.from("user_farm_access").select("farm_id").eq("profile_id", profile.id),
      ]);

      const allowedBranchIds = (branchAccessRows ?? []).map((row) => row.branch_id);
      const allowedFarmIds = (farmAccessRows ?? []).map((row) => row.farm_id);

      let farmsQuery = supabase.from("farms").select("id, name, branch_id").eq("org_id", profile.org_id);

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
          supabase.from("batches").select("id, batch_code, farm_id, house_id, flock_id").in("farm_id", farmIds).order("placement_date", { ascending: false }),
        ]);
        setHouses((houseRows ?? []) as House[]);
        setFlocks((flockRows ?? []) as Flock[]);
        setBatches((batchRows ?? []) as Batch[]);
      }

      setLoading(false);
    };
    void loadScopeData();
  }, []);

  const filteredFarms = useMemo(() => (scope.branchId ? farms.filter((f) => f.branch_id === scope.branchId) : farms), [farms, scope.branchId]);
  const filteredHouses = useMemo(() => (scope.farmId ? houses.filter((h) => h.farm_id === scope.farmId) : houses), [houses, scope.farmId]);
  const filteredFlocks = useMemo(() => {
    let items = flocks;
    if (scope.farmId) items = items.filter((f) => f.farm_id === scope.farmId);
    if (scope.houseId) items = items.filter((f) => f.house_id === scope.houseId);
    return items;
  }, [flocks, scope.farmId, scope.houseId]);
  const filteredBatches = useMemo(() => {
    let items = batches;
    if (scope.farmId) items = items.filter((b) => b.farm_id === scope.farmId);
    if (scope.houseId) items = items.filter((b) => b.house_id === scope.houseId);
    if (scope.flockId) items = items.filter((b) => b.flock_id === scope.flockId);
    if (scope.batchId) items = items.filter((b) => b.id === scope.batchId);
    return items;
  }, [batches, scope.farmId, scope.houseId, scope.flockId, scope.batchId]);

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
