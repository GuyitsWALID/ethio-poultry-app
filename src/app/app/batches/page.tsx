"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bird, Boxes, CalendarDays, CheckCircle2, Layers3, MoreHorizontal, PackageOpen, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type BatchRow = {
  id: string;
  batch_code: string;
  branch_id: string;
  farm_id: string;
  house_id: string;
  placement_date: string;
  source: "internal_transfer" | "external_purchase";
  total_count: number;
  flock_total: number;
  total_chicks: number;
  chicks_per_flock: number;
  status: string;
  updated_at:string;
};

type SlotRow = {
  id: string;
  flock_code: string;
  flock_type: "broiler" | "layer" | "rearing" | "parent_stock";
  source: "internal_transfer" | "external_purchase";
  farm_id: string;
  house_id: string;
  current_count: number;
};

export function BatchManagement({ embedded = false }: { embedded?: boolean }) {
  const { role, loading: scopeLoading, scope, setScope, branches, filteredFarms, filteredHouses, filteredFlocks } = useFarmScope();
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [slotRows, setSlotRows] = useState<SlotRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const farmNameById = useMemo(() => new Map(filteredFarms.map((farm) => [farm.id, farm.name])), [filteredFarms]);
  const houseNameById = useMemo(() => new Map(filteredHouses.map((house) => [house.id, house.name])), [filteredHouses]);

  const loadRows = async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id) return;

    let q = supabase
      .from("batches")
      .select("id, batch_code, branch_id, farm_id, house_id, placement_date, source, total_count, status, updated_at")
      .eq("org_id", profile.org_id)
      .order("placement_date", { ascending: false })
      .limit(50);
    if (scope.branchId) q = q.eq("branch_id", scope.branchId);
    if (scope.farmId) q = q.eq("farm_id", scope.farmId);
    if (scope.houseId) q = q.eq("house_id", scope.houseId);
    const { data } = await q;
    const batchRows = (data ?? []) as Array<{
      id: string;
      batch_code: string;
      branch_id: string;
      farm_id: string;
      house_id: string;
      placement_date: string;
      source: "internal_transfer" | "external_purchase";
      total_count: number;
      status: string;
      updated_at:string;
    }>;

    const batchIds = batchRows.map((row) => row.id);
    const { data: linkedFlocks } = batchIds.length
      ? await supabase
          .from("flocks")
          .select("batch_id, current_count")
          .eq("org_id", profile.org_id)
          .in("batch_id", batchIds)
      : { data: [] as Array<{ batch_id: string | null; current_count: number | null }> };

    const flockAgg = new Map<string, { flockTotal: number; chicksTotal: number }>();
    (linkedFlocks ?? []).forEach((flock) => {
      const batchId = flock.batch_id;
      if (!batchId) return;
      const prev = flockAgg.get(batchId) ?? { flockTotal: 0, chicksTotal: 0 };
      flockAgg.set(batchId, {
        flockTotal: prev.flockTotal + 1,
        chicksTotal: prev.chicksTotal + (flock.current_count ?? 0),
      });
    });

    const mapped = batchRows.map((row) => {
      const agg = flockAgg.get(row.id);
      const flockTotal = agg?.flockTotal ?? 0;
      const chicksPerFlock = flockTotal > 0 ? Math.round((agg?.chicksTotal ?? 0) / flockTotal) : 0;
      return {
        ...row,
        flock_total: flockTotal,
        total_chicks: agg?.chicksTotal ?? 0,
        chicks_per_flock: chicksPerFlock,
      };
    }) as BatchRow[];
    const scopedRows = scope.flockId
      ? mapped.filter((row) => filteredFlocks.some((flock) => flock.id === scope.flockId && flock.batch_id === row.id))
      : mapped;
    setRows(scopedRows);

    if (scope.branchId) {
      const farmIds = filteredFarms.map((farm) => farm.id);
      const { data: activeSlots } = farmIds.length
        ? await supabase
            .from("flocks")
            .select("id, flock_code, flock_type, source, farm_id, house_id, current_count")
            .eq("org_id", profile.org_id)
            .eq("status", "active")
            .in("farm_id", farmIds)
            .order("flock_code")
        : { data: [] as SlotRow[] };
      setSlotRows((activeSlots ?? []) as SlotRow[]);
    } else {
      setSlotRows([]);
    }
  };

  const onEditBatch = async (row: BatchRow) => {
    const nextCode = window.prompt("Enter updated batch code:", row.batch_code)?.trim();
    if (!nextCode || nextCode === row.batch_code) {
      setMenuOpenId(null);
      return;
    }
    setActionLoadingId(row.id);
    setError(null);
    setSuccess(null);
    const response=await fetch("/api/governance/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_type:"locked_correction",farm_id:row.farm_id,source_table:"batches",source_id:row.id,source_version:row.updated_at,changed_fields:["batch_code"],proposed_values:{batch_code:nextCode},reason:`Correct batch code from ${row.batch_code} to ${nextCode}.`})});const payload=await response.json();
    if (!response.ok) {
      setError(payload.error??"Unable to submit batch correction.");
    } else {
      setSuccess("Batch correction submitted for CEO approval.");
    }
    setActionLoadingId(null);
    setMenuOpenId(null);
  };

  const onArchiveBatch = async (row: BatchRow) => {
    if (row.status.toLowerCase() === "archived") {
      setMenuOpenId(null);
      return;
    }
    setActionLoadingId(row.id);
    setError(null);
    setSuccess(null);
    const response=await fetch("/api/governance/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_type:"batch_archive",farm_id:row.farm_id,source_table:"batches",source_id:row.id,source_version:row.updated_at,changed_fields:["status"],proposed_values:{status:"archived"},reason:`Archive completed batch cycle ${row.batch_code}.`})});const payload=await response.json();
    if (!response.ok) {
      setError(payload.error??"Failed to submit archive proposal.");
    } else {
      setSuccess("Batch archive submitted for CEO approval.");
    }
    setActionLoadingId(null);
    setMenuOpenId(null);
  };

  const onDeleteBatch = async (row: BatchRow) => {
    setMenuOpenId(null);setError(`${row.batch_code} cannot be deleted. Use Archive batch to submit a governed lifecycle proposal.`);
  };

  const toggleMenu = (rowId: string, button: HTMLButtonElement) => {
    if (menuOpenId === rowId) {
      setMenuOpenId(null);
      setMenuPosition(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 6, left: rect.right - 128 });
    setMenuOpenId(rowId);
  };

  useEffect(() => {
    if (scopeLoading) return;
    if (role === "farm_manager" && !scope.branchId && branches.length > 0) {
      setScope((current) => ({ ...current, branchId: branches[0].id, farmId: "", houseId: "", flockId: "", batchId: "" }));
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeLoading, role, scope.branchId, scope.farmId, scope.houseId, scope.flockId, filteredFarms, branches]);

  const onCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    if (!scope.branchId) {
      setError("Select a branch in scope filters first.");
      setLoading(false);
      return;
    }
    if (slotRows.length === 0) {
      setError("No active flock slots found for this branch. Create the first branch setup before cycling a batch.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setError("Session required.");
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id) {
      setError("Organization context not found.");
      setLoading(false);
      return;
    }

    const slotPayload = slotRows.map((slot) => ({
      farm_id: slot.farm_id,
      house_id: slot.house_id,
      flock_code: slot.flock_code,
      flock_type: slot.flock_type,
      source: slot.source,
      initial_count: Number(formData.get(`slot_count_${slot.id}`) ?? 0),
    }));
    const totalCount = slotPayload.reduce((sum, slot) => sum + slot.initial_count, 0);
    if (totalCount <= 0 || slotPayload.some((slot) => !Number.isFinite(slot.initial_count) || slot.initial_count <= 0)) {
      setError("Enter a positive chick count for every flock slot.");
      setLoading(false);
      return;
    }
    const purchaseCost = Number(formData.get("purchase_cost_per_bird") ?? 0);
    const transport = Number(formData.get("transport_cost") ?? 0);
    const other = Number(formData.get("other_cost") ?? 0);
    const totalBatchCost = purchaseCost * totalCount + transport + other;
    const rawAgeAtPlacement = formData.get("age_at_placement_days")?.toString();
    const ageAtPlacementDays = rawAgeAtPlacement === "" || rawAgeAtPlacement === undefined ? Number.NaN : Number(rawAgeAtPlacement);
    if (!Number.isInteger(ageAtPlacementDays) || ageAtPlacementDays < 0) {
      setError("Age at placement is required and must be a non-negative whole number of days.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.rpc("create_branch_batch_cycle", {
      p_org_id: profile.org_id,
      p_branch_id: scope.branchId,
      p_batch: {
        batch_code: formData.get("batch_code")?.toString().trim(),
        source: (formData.get("source")?.toString().trim() as "internal_transfer" | "external_purchase") ?? "external_purchase",
        supplier_name: formData.get("supplier_name")?.toString().trim() || null,
        purchase_date: formData.get("purchase_date")?.toString() || null,
        placement_date: formData.get("placement_date")?.toString(),
        age_at_placement_days: ageAtPlacementDays,
        male_count: Number(formData.get("male_count")) || 0,
        female_count: Number(formData.get("female_count")) || 0,
        total_count: totalCount,
        purchase_cost_per_bird: purchaseCost || null,
        transport_cost: transport || 0,
        other_cost: other || 0,
        total_batch_cost: totalBatchCost,
        notes: formData.get("notes")?.toString().trim() || null,
      },
      p_flock_slots: slotPayload,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setSuccess("Batch created successfully.");
    event.currentTarget.reset();
    await loadRows();
    setLoading(false);
  };

  return (
    <div className="space-y-5 pb-8">
      {!embedded ? <><section className="relative overflow-hidden rounded-[28px] bg-forest-900 px-6 py-7 text-sand-50 sm:px-8 lg:px-10"><div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-[44px] border-amber-500/10"/><div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.24em] text-amber-500"><Layers3 className="h-4 w-4"/>Bird-cycle control</div><h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold sm:text-4xl">Start the next batch without losing the lineage of the last.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100/80">A new branch cycle archives current flock slots and recreates them under one traceable intake and cost record. Review every count before committing.</p></div><button type="button" onClick={()=>void loadRows()} disabled={loading} className="inline-flex h-11 items-center gap-2 self-start rounded-xl border border-white/20 px-4 text-sm font-semibold hover:bg-white/10"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>Refresh</button></div></section><section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm"><div className="grid divide-y divide-sand-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">{([["Batch cycles",rows.length,Boxes],["Active cycles",rows.filter((row)=>row.status.toLowerCase()==="active").length,CheckCircle2],["Linked flocks",rows.reduce((sum,row)=>sum+row.flock_total,0),Bird],["Birds in latest cycles",rows.reduce((sum,row)=>sum+row.total_chicks,0),PackageOpen]] as Array<[string,number,LucideIcon]>).map(([label,value,Icon])=><div key={label} className="p-5"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-forest-500">{label}</p><Icon className="h-4 w-4 text-forest-500"/></div><p className="mt-2 font-display text-3xl font-semibold text-forest-900">{value.toLocaleString()}</p></div>)}</div></section></> : null}

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">Controlled cycle change</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Create a branch batch cycle</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-forest-600">
          Scope selected: {scope.branchId ? "Branch set" : "Branch missing"}. Existing active flock slots in this branch will be archived and recreated under the new batch code.
        </p>
        <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><p><strong>This changes active operations.</strong> Current active flock slots in the branch are archived and replacement flock records are created with the new counts below.</p></div>
        <label className="mt-4 grid max-w-md gap-2 text-sm text-forest-700">
          Branch for this cycle
          <select
            value={scope.branchId}
            onChange={(event) => setScope({ branchId: event.target.value, farmId: "", houseId: "", flockId: "", batchId: "" })}
            className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
          >
            <option value="">Select branch</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <input name="batch_code" required placeholder="Batch code" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <select name="source" className="h-11 rounded-xl border border-sand-200 px-3 text-sm">
            <option value="external_purchase">External Purchase</option>
            <option value="internal_transfer">Internal Transfer</option>
          </select>
          <input name="supplier_name" placeholder="Supplier name" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="purchase_date" type="date" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="placement_date" type="date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="age_at_placement_days" type="number" min={0} required placeholder="Age at placement (days)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="male_count" type="number" placeholder="Male count" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="female_count" type="number" placeholder="Female count" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="purchase_cost_per_bird" type="number" step="0.01" placeholder="Purchase cost per bird" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="transport_cost" type="number" step="0.01" placeholder="Transport cost" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="other_cost" type="number" step="0.01" placeholder="Other cost" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <div className="md:col-span-2 rounded-xl border border-sand-200">
            <div className="border-b border-sand-200 px-3 py-2">
              <p className="text-sm font-semibold text-forest-900">New flock counts</p>
              <p className="text-xs text-forest-600">Each row keeps the same farm, house, and visible flock code, but creates a new flock record for this batch.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-100 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                    <th className="px-3 py-2">Flock</th>
                    <th className="px-3 py-2">Farm</th>
                    <th className="px-3 py-2">House</th>
                    <th className="px-3 py-2">Current birds</th>
                    <th className="px-3 py-2">New chicks</th>
                  </tr>
                </thead>
                <tbody>
                  {slotRows.map((slot) => (
                    <tr key={slot.id} className="border-b border-sand-100">
                      <td className="px-3 py-2 font-medium text-forest-900">{slot.flock_code}</td>
                      <td className="px-3 py-2 text-forest-700">{farmNameById.get(slot.farm_id) ?? slot.farm_id}</td>
                      <td className="px-3 py-2 text-forest-700">{houseNameById.get(slot.house_id) ?? slot.house_id}</td>
                      <td className="px-3 py-2 text-forest-700">{slot.current_count.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <input
                          name={`slot_count_${slot.id}`}
                          type="number"
                          min={1}
                          defaultValue={slot.current_count || ""}
                          required
                          className="h-10 w-36 rounded-lg border border-sand-200 px-3 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                  {slotRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-sm text-forest-600">Select a branch with active flock slots to create a new cycle.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <textarea name="notes" placeholder="Notes" className="md:col-span-2 min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm" />
          {error ? <p className="md:col-span-2 rounded-xl border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-sm text-ember-500">{error}</p> : null}
          {success ? <p className="md:col-span-2 rounded-xl border border-leaf-500/40 bg-leaf-500/10 px-3 py-2 text-sm text-leaf-500">{success}</p> : null}
          <button type="submit" disabled={loading} className="md:col-span-2 min-h-11 rounded-xl bg-forest-900 px-4 py-2 text-sm font-semibold text-sand-50 disabled:opacity-60">
            {loading ? "Saving..." : "Create Batch"}
          </button>
        </form>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="border-b border-sand-200 p-5 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">Cycle register</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Recent batch cycles</h2><p className="mt-1 text-sm text-forest-600">Placement, source, flock distribution, and lifecycle status.</p></div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 bg-sand-50 text-left text-[10px] uppercase tracking-[0.16em] text-forest-600">
                <th className="px-2 py-2">Batch</th>
                <th className="px-2 py-2">Placement</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2"># Flocks</th>
                <th className="px-2 py-2">Total Chicks</th>
                <th className="px-2 py-2">Chicks / Flock</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-sand-100">
                  <td className="px-2 py-2 font-medium text-forest-900">{row.batch_code}</td>
                  <td className="px-2 py-2 text-forest-700"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5"/>{row.placement_date}</span></td>
                  <td className="px-2 py-2 text-forest-700">{row.source}</td>
                  <td className="px-2 py-2 text-forest-700">{row.flock_total}</td>
                  <td className="px-2 py-2 text-forest-700">{row.total_chicks}</td>
                  <td className="px-2 py-2 text-forest-700">{row.chicks_per_flock}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      className="rounded-md border border-sand-200 p-1.5 text-forest-700 hover:bg-sand-50"
                      onClick={(e) => toggleMenu(row.id, e.currentTarget)}
                      disabled={actionLoadingId === row.id}
                      aria-label="Batch actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-sm text-forest-600">No batches found for current scope.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {menuOpenId && menuPosition
          ? createPortal(
              <div
                className="fixed z-50 w-32 rounded-lg border border-sand-200 bg-white p-1 shadow-lg"
                style={{ top: menuPosition.top, left: menuPosition.left }}
              >
                {(() => {
                  const row = rows.find((r) => r.id === menuOpenId);
                  if (!row) return null;
                  return (
                    <>
                      <button
                        type="button"
                        className="block w-full rounded px-2 py-1.5 text-left text-sm text-forest-800 hover:bg-sand-50"
                        onClick={() => void onEditBatch(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded px-2 py-1.5 text-left text-sm text-forest-800 hover:bg-sand-50 disabled:opacity-50"
                        onClick={() => void onArchiveBatch(row)}
                        disabled={row.status.toLowerCase() === "archived"}
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => void onDeleteBatch(row)}
                      >
                        Delete
                      </button>
                    </>
                  );
                })()}
              </div>,
              document.body
            )
          : null}
      </section>
    </div>
  );
}

export default function BatchesPage() {
  return <BatchManagement />;
}
