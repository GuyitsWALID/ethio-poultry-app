export default function FarmOverview() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
          Farm overview
        </p>
        <h2 className="text-2xl font-semibold text-forest-900">
          Farm performance dashboard
        </h2>
        <p className="mt-2 text-sm text-forest-600">
          KPI summary, house status, and profitability for this farm.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {["Flocks active", "Mortality", "Profit per flock"].map((title) => (
          <div
            key={title}
            className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">
              {title}
            </p>
            <p className="mt-3 text-2xl font-semibold text-forest-900">--</p>
          </div>
        ))}
      </div>
    </div>
  );
}