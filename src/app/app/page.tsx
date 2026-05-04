export default function AppHome() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
          Overview
        </p>
        <h2 className="text-2xl font-semibold text-forest-900">
          Operations overview
        </h2>
        <p className="mt-2 text-sm text-forest-600">
          Cross-farm summary, live alerts, and executive KPIs.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {["Active farms", "Open alerts", "Net margin"].map((title) => (
          <div
            key={title}
            className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">
              {title}
            </p>
            <p className="mt-3 text-2xl font-semibold text-forest-900">--</p>
            <p className="mt-2 text-xs text-forest-500">Data pending setup</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">
            Farm comparisons
          </h3>
          <p className="mt-2 text-sm text-forest-600">
            Compare productivity, mortality, and profit per farm.
          </p>
        </div>
        <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">
            KPI highlights
          </h3>
          <p className="mt-2 text-sm text-forest-600">
            FCR, feed cost per egg, profit per flock, and P&L summaries.
          </p>
        </div>
      </div>
    </div>
  );
}