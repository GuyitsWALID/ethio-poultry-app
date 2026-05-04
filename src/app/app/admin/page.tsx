export default function AdminOverview() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
          Executive
        </p>
        <h2 className="text-2xl font-semibold text-forest-900">
          Admin and management overview
        </h2>
        <p className="mt-2 text-sm text-forest-600">
          Multi-farm performance, profitability, and risk signals.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {["Profit per farm", "Cost per bird", "Production efficiency"].map(
          (title) => (
            <div
              key={title}
              className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-forest-500">
                {title}
              </p>
              <p className="mt-3 text-2xl font-semibold text-forest-900">--</p>
              <p className="mt-2 text-xs text-forest-500">Configured in KPIs</p>
            </div>
          )
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">
            Farm comparison board
          </h3>
          <p className="mt-2 text-sm text-forest-600">
            Rank farms by profitability, mortality, and feed conversion.
          </p>
        </div>
        <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">
            New farm creation
          </h3>
          <p className="mt-2 text-sm text-forest-600">
            Create branches, farms, and houses from one guided flow.
          </p>
        </div>
      </div>
    </div>
  );
}