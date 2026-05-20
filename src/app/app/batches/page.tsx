"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { createPortal } from "react-dom";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type BatchRow = {
  id: string;
  batch_code: string;
  placement_date: string;
  source: "internal_transfer" | "external_purchase";
  total_count: number;
  flock_total: number;
  total_chicks: number;
  chicks_per_flock: number;
  status: string;
};

export default function BatchesPage() {
  const { scope, filteredFarms, filteredHouses, filteredFlocks } = useFarmScope();
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadRows = async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id) return;

    let q = supabase
      .from("batches")
      .select("id, batch_code, placement_date, source, total_count, status")
      .eq("org_id", profile.org_id)
      .order("placement_date", { ascending: false })
      .limit(50);
    if (scope.farmId) q = q.eq("farm_id", scope.farmId);
    if (scope.houseId) q = q.eq("house_id", scope.houseId);
    if (scope.flockId) q = q.eq("flock_id", scope.flockId);
    const { data } = await q;
    const batchRows = (data ?? []) as Array<{
      id: string;
      batch_code: string;
      placement_date: string;
      source: "internal_transfer" | "external_purchase";
      total_count: number;
      status: string;
    }>;

    const batchCodes = Array.from(new Set(batchRows.map((row) => row.batch_code).filter(Boolean)));
    const { data: intakeRows } = batchCodes.length
      ? await supabase
          .from("branch_intake_batches")
          .select("id, batch_code")
          .eq("org_id", profile.org_id)
          .in("batch_code", batchCodes)
      : { data: [] as Array<{ id: string; batch_code: string }> };

    const intakeIdByBatchCode = new Map<string, string>();
    (intakeRows ?? []).forEach((row) => {
      intakeIdByBatchCode.set(row.batch_code, row.id);
    });

    const intakeIds = Array.from(new Set((intakeRows ?? []).map((row) => row.id)));
    const { data: linkedFlocks } = intakeIds.length
      ? await supabase
          .from("flocks")
          .select("intake_batch_id, current_count")
          .eq("org_id", profile.org_id)
          .in("intake_batch_id", intakeIds)
      : { data: [] as Array<{ intake_batch_id: string | null; current_count: number | null }> };

    const flockAgg = new Map<string, { flockTotal: number; chicksTotal: number }>();
    (linkedFlocks ?? []).forEach((flock) => {
      const intakeBatchId = flock.intake_batch_id;
      if (!intakeBatchId) return;
      const prev = flockAgg.get(intakeBatchId) ?? { flockTotal: 0, chicksTotal: 0 };
      flockAgg.set(intakeBatchId, {
        flockTotal: prev.flockTotal + 1,
        chicksTotal: prev.chicksTotal + (flock.current_count ?? 0),
      });
    });

    const mapped = batchRows.map((row) => {
      const intakeBatchId = intakeIdByBatchCode.get(row.batch_code);
      const agg = intakeBatchId ? flockAgg.get(intakeBatchId) : undefined;
      const flockTotal = agg?.flockTotal ?? 0;
      const chicksPerFlock = flockTotal > 0 ? Math.round((agg?.chicksTotal ?? 0) / flockTotal) : 0;
      return {
        ...row,
        flock_total: flockTotal,
        total_chicks: agg?.chicksTotal ?? 0,
        chicks_per_flock: chicksPerFlock,
      };
    }) as BatchRow[];
    setRows(mapped);
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
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("batches")
      .update({ batch_code: nextCode })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Batch updated.");
      await loadRows();
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
    const supabase = createClient();
    const { error: archiveError } = await supabase
      .from("batches")
      .update({ status: "archived" })
      .eq("id", row.id);
    if (archiveError) {
      setError(archiveError.message);
    } else {
      setSuccess("Batch archived.");
      await loadRows();
    }
    setActionLoadingId(null);
    setMenuOpenId(null);
  };

  const onDeleteBatch = async (row: BatchRow) => {
    const ok = window.confirm(`Delete batch ${row.batch_code}? This cannot be undone.`);
    if (!ok) {
      setMenuOpenId(null);
      return;
    }
    setActionLoadingId(row.id);
    setError(null);
    setSuccess(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("batches").delete().eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("Batch deleted.");
      await loadRows();
    }
    setActionLoadingId(null);
    setMenuOpenId(null);
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
    void loadRows();
  }, [scope.farmId, scope.houseId, scope.flockId]);

  const onCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    if (!scope.branchId || !scope.farmId || !scope.houseId || !scope.flockId) {
      setError("Select branch, farm, house, and flock in scope filters first.");
      setLoading(false);
      return;
    }
    const houseValid = filteredHouses.some((h) => h.id === scope.houseId);
    const flockValid = filteredFlocks.some((f) => f.id === scope.flockId && f.house_id === scope.houseId);
    if (!houseValid || !flockValid) {
      setError("Hierarchy validation failed. Check farm/house/flock selection.");
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

    const totalCount = Number(formData.get("total_count"));
    const purchaseCost = Number(formData.get("purchase_cost_per_bird") ?? 0);
    const transport = Number(formData.get("transport_cost") ?? 0);
    const other = Number(formData.get("other_cost") ?? 0);
    const totalBatchCost = purchaseCost * totalCount + transport + other;

    const { error: insertError } = await supabase.from("batches").insert({
      org_id: profile.org_id,
      branch_id: scope.branchId,
      farm_id: scope.farmId,
      house_id: scope.houseId,
      flock_id: scope.flockId,
      batch_code: formData.get("batch_code")?.toString().trim(),
      source: (formData.get("source")?.toString().trim() as "internal_transfer" | "external_purchase") ?? "external_purchase",
      supplier_name: formData.get("supplier_name")?.toString().trim() || null,
      purchase_date: formData.get("purchase_date")?.toString() || null,
      placement_date: formData.get("placement_date")?.toString(),
      age_at_placement_days: Number(formData.get("age_at_placement_days")) || null,
      male_count: Number(formData.get("male_count")) || 0,
      female_count: Number(formData.get("female_count")) || 0,
      total_count: totalCount,
      purchase_cost_per_bird: purchaseCost || null,
      transport_cost: transport || 0,
      other_cost: other || 0,
      total_batch_cost: totalBatchCost,
      notes: formData.get("notes")?.toString().trim() || null,
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
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Batches</p>
        <h2 className="text-2xl font-semibold text-forest-900">Batch Management</h2>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Create Batch</h3>
        <p className="mt-1 text-sm text-forest-600">
          Scope selected: {scope.branchId ? "Branch set" : "Branch missing"} / {scope.farmId ? "Farm set" : "Farm missing"} / {scope.houseId ? "House set" : "House missing"} / {scope.flockId ? "Flock set" : "Flock missing"}
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <input name="batch_code" required placeholder="Batch code" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <select name="source" className="h-11 rounded-xl border border-sand-200 px-3 text-sm">
            <option value="external_purchase">External Purchase</option>
            <option value="internal_transfer">Internal Transfer</option>
          </select>
          <input name="supplier_name" placeholder="Supplier name" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="purchase_date" type="date" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="placement_date" type="date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="age_at_placement_days" type="number" placeholder="Age at placement (days)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="male_count" type="number" placeholder="Male count" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="female_count" type="number" placeholder="Female count" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="total_count" type="number" required placeholder="Total count" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="purchase_cost_per_bird" type="number" step="0.01" placeholder="Purchase cost per bird" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="transport_cost" type="number" step="0.01" placeholder="Transport cost" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <input name="other_cost" type="number" step="0.01" placeholder="Other cost" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
          <textarea name="notes" placeholder="Notes" className="md:col-span-2 min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm" />
          {error ? <p className="md:col-span-2 rounded-xl border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-sm text-ember-500">{error}</p> : null}
          {success ? <p className="md:col-span-2 rounded-xl border border-leaf-500/40 bg-leaf-500/10 px-3 py-2 text-sm text-leaf-500">{success}</p> : null}
          <button type="submit" disabled={loading} className="md:col-span-2 rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60">
            {loading ? "Saving..." : "Create Batch"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Recent Batches</h3>
        <div className="mt-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
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
                  <td className="px-2 py-2 text-forest-700">{row.placement_date}</td>
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
