import { FarmKpiDashboard } from "@/components/farm-kpi-dashboard";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Analytics</p>
        <h2 className="mt-2 text-2xl font-semibold text-forest-900">Farm KPI analytics</h2>
        <p className="mt-2 text-sm text-forest-600">
          Detailed production, mortality, feed, flock comparison, and quality visualizations for management review.
        </p>
      </div>

      <FarmKpiDashboard mode="management" depth="analytics" />
    </div>
  );
}
