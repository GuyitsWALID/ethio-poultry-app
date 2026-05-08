"use client";

import { useEffect, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type BatchRow = {
  id: string;
  batch_code: string;
  placement_date: string;
  source: "internal_transfer" | "external_purchase";
  total_count: number;
  flock_id: string;
};

export default function BatchesPage() {
  const { scope, filteredFarms, filteredHouses, filteredFlocks } = useFarmScope();
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRows = async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id) return;

    let q = supabase
      .from("batches")
      .select("id, batch_code, placement_date, source, total_count, flock_id")
      .eq("org_id", profile.org_id)
      .order("placement_date", { ascending: false })
      .limit(50);
    if (scope.farmId) q = q.eq("farm_id", scope.farmId);
    if (scope.houseId) q = q.eq("house_id", scope.houseId);
    if (scope.flockId) q = q.eq("flock_id", scope.flockId);
    const { data } = await q;
    setRows((data ?? []) as BatchRow[]);
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
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Batch</th>
                <th className="px-2 py-2">Placement</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Total Count</th>
                <th className="px-2 py-2">Flock ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-sand-100">
                  <td className="px-2 py-2 font-medium text-forest-900">{row.batch_code}</td>
                  <td className="px-2 py-2 text-forest-700">{row.placement_date}</td>
                  <td className="px-2 py-2 text-forest-700">{row.source}</td>
                  <td className="px-2 py-2 text-forest-700">{row.total_count}</td>
                  <td className="px-2 py-2 text-forest-700">{row.flock_id}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-sm text-forest-600">No batches found for current scope.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
