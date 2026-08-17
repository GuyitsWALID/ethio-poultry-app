"use client";

import { useEffect, useMemo, useState } from "react";

import type { Database } from "@/types/supabase";

type AppRole = Database["public"]["Enums"]["user_role"];

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
  is_active: boolean;
};

type FarmRow = {
  id: string;
  name: string;
  branch_id: string;
};

type BranchRow = {
  id: string;
  name: string;
};

type FarmAccessRow = {
  id: string;
  profile_id: string;
  farm_id: string;
  starts_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revocation_reason?: string | null;
  assignment_status?: string;
};
type WarehouseRow={id:string;name:string};
type WarehouseAccessRow={id:string;profile_id:string;warehouse_id:string;starts_at:string;expires_at:string|null;revoked_at:string|null;revocation_reason?:string|null;assignment_status?:string};

const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: "ceo", label: "CEO" },
  { value: "farm_manager", label: "Farm Manager" },
];

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [farmAccess, setFarmAccess] = useState<FarmAccessRow[]>([]);
  const [warehouses,setWarehouses]=useState<WarehouseRow[]>([]);
  const [warehouseAccess,setWarehouseAccess]=useState<WarehouseAccessRow[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [selectedWarehouseId,setSelectedWarehouseId]=useState("");
  const [expiresAt,setExpiresAt]=useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManage = currentRole === "ceo";
  const branchNameMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches]);
  const farmNameMap = useMemo(() => new Map(farms.map((farm) => [farm.id, farm.name])), [farms]);
  const profileNameMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.full_name ?? "Unnamed manager"])), [profiles]);
  const warehouseNameMap = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])), [warehouses]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const contextResponse = await fetch("/api/me/context", { method: "GET" });
    const context = contextResponse.ok ? await contextResponse.json() : null;
    const nextOrgId = context?.orgId as string | null;
    setOrgId(nextOrgId);
    setCurrentRole((context?.role ?? null) as AppRole | null);
    if (!nextOrgId) {
      setLoading(false);
      return;
    }

    const assignmentResponse=await fetch("/api/governance/assignments",{cache:"no-store"});
    const payload=await assignmentResponse.json().catch(()=>({}));
    if(!assignmentResponse.ok)setError(payload.error??"Operational access data could not be loaded.");
    setProfiles((payload.profiles??[]) as ProfileRow[]);
    setBranches((payload.branches??[]) as BranchRow[]);
    setFarms((payload.farms??[]) as FarmRow[]);
    setWarehouses((payload.warehouses??[]) as WarehouseRow[]);
    setWarehouseAccess((payload.warehouseAssignments??[]) as WarehouseAccessRow[]);
    setFarmAccess((payload.farmAssignments??[]) as FarmAccessRow[]);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const updateProfile = async (profileId: string, updates: Partial<Pick<ProfileRow, "role" | "is_active">>) => {
    if (!canManage) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const response=await fetch(`/api/governance/users/${profileId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(updates)});const payload=await response.json();
    if (!response.ok) {
      setError(payload.error??"User update failed.");
      setSaving(false);
      return;
    }
    setSuccess("User profile updated.");
    setSaving(false);
    await load();
  };

  const addAssignment = async (scopeType:"farm"|"warehouse") => {
    const scopeId=scopeType==="farm"?selectedFarmId:selectedWarehouseId;
    if (!canManage || !orgId) {
      setError("Only the organization CEO can grant operational access.");
      return;
    }
    if (!selectedProfileId) {
      setError("Select an active Farm Manager before granting access.");
      return;
    }
    if (!scopeId) {
      setError(`Select the ${scopeType} that this Farm Manager should access.`);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response=await fetch("/api/governance/assignments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile_id:selectedProfileId,scope_type:scopeType,scope_id:scopeId,expires_at:expiresAt||null})});
      const payload=await response.json().catch(()=>({}));
      if (!response.ok) {
        setError(payload.error??"Access was not granted. Please try again.");
        return;
      }
      const managerName=profileNameMap.get(selectedProfileId)??"The Farm Manager";
      const scopeName=scopeType==="farm"?(farmNameMap.get(scopeId)??"the selected farm"):(warehouseNameMap.get(scopeId)??"the selected warehouse");
      await load();
      setSuccess(`${managerName} now has active access to ${scopeName}. The grant is recorded in assignment history.`);
      if(scopeType==="farm")setSelectedFarmId("");else setSelectedWarehouseId("");
      setExpiresAt("");
    } catch {
      setError("Access was not granted because the request could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const revokeAssignment=async(scopeType:"farm"|"warehouse",assignmentId:string,label:string)=>{if(!canManage)return;const reason=window.prompt(`Why should access to ${label} end?` )?.trim();if(!reason)return;if(reason.length<8){setError("Revocation reason must be at least eight characters.");return}setSaving(true);setError(null);const response=await fetch("/api/governance/assignments",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({scope_type:scopeType,assignment_id:assignmentId,reason})});const payload=await response.json();if(!response.ok)setError(payload.error??"Assignment could not be revoked.");else setSuccess(`${label} access revoked and retained in history.`);setSaving(false);await load()};
  const assignmentStatus=(row:{assignment_status?:string})=>row.assignment_status??"Unknown";
  const activeAssignment=(row:{assignment_status?:string})=>assignmentStatus(row)==="Active";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Users and roles</p>
        <h2 className="text-2xl font-semibold text-forest-900">Operational Access Governance</h2>
        <p className="mt-2 text-sm text-forest-600">
          Manage System A roles and branch/farm access scopes. Full account creation still uses the CEO setup flow.
        </p>
      </div>

      {error ? <p className="rounded-xl border border-ember-500/30 bg-ember-500/10 p-3 text-sm text-ember-600">{error}</p> : null}
      {success ? <p className="rounded-xl border border-leaf-500/30 bg-leaf-500/10 p-3 text-sm text-leaf-700">{success}</p> : null}

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-forest-900">Assign Scope Access</h3>
            <p className="text-sm text-forest-600">Assign managers directly to the farms they operate. Branch selection is only a filter.</p>
          </div>
          {!canManage ? <p className="text-sm text-forest-600">View mode: CEO/system admin required for edits.</p> : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select className="h-11 rounded-xl border border-sand-200 px-3 text-sm" value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
            <option value="">Select user</option>
            {profiles.filter((profile)=>profile.role==="farm_manager"&&profile.is_active).map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.id} · {profile.role}</option>
            ))}
          </select>
          <select disabled className="h-11 rounded-xl border border-sand-200 px-3 text-sm opacity-60" value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}>
            <option value="">Select branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <button type="button" disabled className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60">
            Branch access retired
          </button>
          <select className="h-11 rounded-xl border border-sand-200 px-3 text-sm md:col-span-2" value={selectedFarmId} onChange={(event) => setSelectedFarmId(event.target.value)}>
            <option value="">Select farm</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>{farm.name} · {branchNameMap.get(farm.branch_id) ?? "Branch"}</option>
            ))}
          </select>
          <button type="button" disabled={saving || !canManage || !selectedProfileId || !selectedFarmId} onClick={() => void addAssignment("farm")} className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60">
            Add Farm Access
          </button>
          <select className="h-11 rounded-xl border border-sand-200 px-3 text-sm" value={selectedWarehouseId} onChange={(event)=>setSelectedWarehouseId(event.target.value)}><option value="">Select warehouse</option>{warehouses.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-600"><span>Access expiry (optional)</span><input type="datetime-local" aria-label="Assignment expiry" className="h-8 rounded-xl border border-sand-200 px-3 text-sm font-normal normal-case tracking-normal text-forest-900" value={expiresAt} onChange={(event)=>setExpiresAt(event.target.value)}/></label>
          <button type="button" disabled={saving||!canManage||!selectedProfileId||!selectedWarehouseId} onClick={()=>void addAssignment("warehouse")} className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60">{saving?"Granting access…":"Add Warehouse Access"}</button>
        </div>
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-forest-900">Users</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Branches</th>
                <th className="px-2 py-2">Farms</th>
                <th className="px-2 py-2">Warehouses</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-2 py-4 text-forest-600" colSpan={7}>Loading users...</td></tr>
              ) : profiles.length === 0 ? (
                <tr><td className="px-2 py-4 text-forest-600" colSpan={7}>No users found.</td></tr>
              ) : profiles.map((profile) => {
                const userFarms = farmAccess.filter((access) => access.profile_id === profile.id&&activeAssignment(access)).map((access) => farmNameMap.get(access.farm_id) ?? access.farm_id);
                const userWarehouses=warehouseAccess.filter(access=>access.profile_id===profile.id&&activeAssignment(access)).map(access=>warehouses.find(row=>row.id===access.warehouse_id)?.name??access.warehouse_id);
                return (
                  <tr key={profile.id} className="border-b border-sand-100 align-top">
                    <td className="px-2 py-2 font-medium text-forest-900">{profile.full_name ?? profile.id}</td>
                    <td className="px-2 py-2 text-forest-700">{profile.phone ?? "-"}</td>
                    <td className="px-2 py-2">
                      <select
                        className="h-9 rounded-xl border border-sand-200 px-2 text-sm"
                        value={profile.role}
                        disabled={!canManage || saving}
                        onChange={(event) => void updateProfile(profile.id, { role: event.target.value as AppRole })}
                      >
                        {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        disabled={!canManage || saving}
                        onClick={() => void updateProfile(profile.id, { is_active: !profile.is_active })}
                        className={`rounded-full px-3 py-1 text-xs ${profile.is_active ? "bg-leaf-500/10 text-leaf-700" : "bg-ember-500/10 text-ember-700"} disabled:opacity-60`}
                      >
                        {profile.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="max-w-[220px] px-2 py-2 text-forest-500">Not authoritative</td>
                    <td className="max-w-[260px] px-2 py-2 text-forest-700">{userFarms.join(", ") || "-"}</td>
                    <td className="max-w-[260px] px-2 py-2 text-forest-700">{userWarehouses.join(", ")||"-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="border-b border-sand-200 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Custody timeline</p><h3 className="mt-1 font-display text-2xl font-semibold text-forest-900">Assignment history</h3><p className="mt-1 text-sm text-forest-600">Current, scheduled, expired, and revoked access stays visible for review.</p></div>
        <div className="divide-y divide-sand-100">{[...farmAccess.map(row=>({kind:"farm" as const,row,label:farmNameMap.get(row.farm_id)??row.farm_id})),...warehouseAccess.map(row=>({kind:"warehouse" as const,row,label:warehouses.find(item=>item.id===row.warehouse_id)?.name??row.warehouse_id}))].length===0?<p className="p-5 text-sm text-forest-600">No assignment history exists.</p>:[...farmAccess.map(row=>({kind:"farm" as const,row,label:farmNameMap.get(row.farm_id)??row.farm_id})),...warehouseAccess.map(row=>({kind:"warehouse" as const,row,label:warehouses.find(item=>item.id===row.warehouse_id)?.name??row.warehouse_id}))].map(item=>{const profile=profiles.find(row=>row.id===item.row.profile_id);const status=assignmentStatus(item.row);return <article key={`${item.kind}-${item.row.id}`} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-forest-900">{item.label}</strong><span className="rounded-full bg-sand-100 px-2 py-1 text-[9px] font-semibold uppercase text-forest-700">{item.kind}</span><span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${status==="Active"?"bg-leaf-500/15 text-forest-800":status==="Scheduled"?"bg-sky-500/10 text-sky-700":status==="Revoked"?"bg-ember-500/10 text-ember-700":"bg-sand-100 text-forest-500"}`}>{status}</span></div><p className="mt-1 text-xs text-forest-600">{profile?.full_name??item.row.profile_id} · starts {new Date(item.row.starts_at).toLocaleString()}{item.row.expires_at?` · expires ${new Date(item.row.expires_at).toLocaleString()}`:" · no expiry"}</p>{item.row.revocation_reason?<p className="mt-1 text-xs text-ember-700">Reason: {item.row.revocation_reason}</p>:null}</div>{status==="Active"&&canManage?<button type="button" disabled={saving} onClick={()=>void revokeAssignment(item.kind,item.row.id,item.label)} className="min-h-10 rounded-xl border border-ember-300 px-4 text-xs font-semibold text-ember-700 hover:bg-ember-50 disabled:opacity-50">Revoke access</button>:null}</article>})}</div>
      </section>
    </div>
  );
}
