import { FarmKpiDashboard } from "@/components/farm-kpi-dashboard";

export default function AdminOverview() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sand-200 bg-gradient-to-r from-forest-900 to-forest-700 p-6 text-sand-50">
        <p className="text-xs uppercase tracking-[0.3em] text-sand-200">Executive Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold">CEO and management control tower</h2>
        <p className="mt-2 text-sm text-sand-100">
          General farm KPIs, operational trends, and management alerts across the current scope.
        </p>
      </div>

      <FarmKpiDashboard mode="management" />
    </div>
  );
}
