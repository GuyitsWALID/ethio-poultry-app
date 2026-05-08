const kpis = [
  { label: "Live Birds", value: "128,440", trend: "+3.2% vs last week" },
  { label: "Egg Output / Day", value: "102,380", trend: "+1.1% stable growth" },
  { label: "Open Alerts", value: "14", trend: "-6 critical resolved today" },
  { label: "Net Margin", value: "18.7%", trend: "+0.9% month to date" },
];

const farmRows = [
  { farm: "Addis Farm A", hdep: "91.4%", mortality: "0.38%", feedCost: "ETB 14.2/egg" },
  { farm: "Bishoftu Farm B", hdep: "89.8%", mortality: "0.44%", feedCost: "ETB 14.8/egg" },
  { farm: "Adama Farm C", hdep: "92.2%", mortality: "0.31%", feedCost: "ETB 13.9/egg" },
];

const branchOptions = ["All Branches", "Addis Branch", "Bishoftu Branch", "Adama Branch"];
const farmOptions = ["All Farms", "Addis Farm A", "Bishoftu Farm B", "Adama Farm C"];
const batchOptions = ["All Batches", "BATCH-2026-01", "BATCH-2026-02", "BATCH-2026-03"];
const flockOptions = ["All Flocks", "FLK-LAY-001", "FLK-LAY-002", "FLK-REA-007"];

export default function AdminOverview() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sand-200 bg-gradient-to-r from-forest-900 to-forest-700 p-6 text-sand-50">
        <p className="text-xs uppercase tracking-[0.3em] text-sand-200">Executive Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold">CEO and management control tower</h2>
        <p className="mt-2 text-sm text-sand-100">
          Multi-farm visibility for profitability, production, and operational risk.
        </p>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-forest-900">Executive Scope Filters</h3>
            <p className="text-sm text-forest-600">
              Filter dashboard by branch, farm, batch, and flock.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm text-forest-700">
            Branch
            <select className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900">
              {branchOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-forest-700">
            Farm
            <select className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900">
              {farmOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-forest-700">
            Batch
            <select className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900">
              {batchOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-forest-700">
            Flock
            <select className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900">
              {flockOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">{kpi.label}</p>
            <p className="mt-3 text-3xl font-semibold text-forest-900">{kpi.value}</p>
            <p className="mt-2 text-xs text-forest-600">{kpi.trend}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Farm performance board</h3>
          <p className="mt-1 text-sm text-forest-600">
            Compare production efficiency and mortality across core farms.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-xs uppercase tracking-[0.15em] text-forest-500">
                  <th className="px-2 py-2">Farm</th>
                  <th className="px-2 py-2">HDEP</th>
                  <th className="px-2 py-2">Mortality</th>
                  <th className="px-2 py-2">Feed Cost</th>
                </tr>
              </thead>
              <tbody>
                {farmRows.map((row) => (
                  <tr key={row.farm} className="border-b border-sand-100">
                    <td className="px-2 py-3 font-medium text-forest-900">{row.farm}</td>
                    <td className="px-2 py-3 text-forest-700">{row.hdep}</td>
                    <td className="px-2 py-3 text-forest-700">{row.mortality}</td>
                    <td className="px-2 py-3 text-forest-700">{row.feedCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Priority actions</h3>
          <ul className="mt-4 space-y-3 text-sm text-forest-700">
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">
              Review feed variance in Bishoftu Farm B.
            </li>
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">
              Approve medicine restock for central warehouse.
            </li>
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">
              Confirm training schedule for new farm supervisors.
            </li>
          </ul>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Farm Operations Oversight</h3>
          <p className="mt-2 text-sm text-forest-600">
            Capacity utilization, daily records completion, and transfer status.
          </p>
        </section>
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Veterinary Oversight</h3>
          <p className="mt-2 text-sm text-forest-600">
            Active clinical cases, vaccination execution, and biosecurity gaps.
          </p>
        </section>
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Inventory Oversight</h3>
          <p className="mt-2 text-sm text-forest-600">
            Critical stock watchlist, procurement readiness, and warehouse flow.
          </p>
        </section>
      </div>
    </div>
  );
}
