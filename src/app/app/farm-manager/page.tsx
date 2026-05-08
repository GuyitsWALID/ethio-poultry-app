const operationsCards = [
  { label: "Active Farms", value: "6", note: "2 with expansion plans" },
  { label: "Open Health Cases", value: "11", note: "4 need review today" },
  { label: "Low Stock Items", value: "17", note: "5 critical SKUs" },
  { label: "Feed Days Left", value: "18", note: "Main risk: Bishoftu" },
];

export default function FarmManagerDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Unified Operations Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold text-forest-900">Farm manager command center</h2>
        <p className="mt-2 text-sm text-forest-600">
          Farm operations, veterinary monitoring, and inventory control in one workflow.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {operationsCards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-forest-900">{card.value}</p>
            <p className="mt-2 text-xs text-forest-600">{card.note}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Farm Operations</h3>
          <ul className="mt-4 space-y-3 text-sm text-forest-700">
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">Approve farm transfer requests.</li>
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">Close daily records before 7 PM.</li>
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">Review high mortality alerts.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Veterinary Actions</h3>
          <ul className="mt-4 space-y-3 text-sm text-forest-700">
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">Validate vaccine cold-chain logs.</li>
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">Follow up suspected coccidiosis case.</li>
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">Submit weekly biosecurity summary.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Store & Inventory</h3>
          <ul className="mt-4 space-y-3 text-sm text-forest-700">
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">Release pending feed dispatches.</li>
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">Confirm incoming medicine GRNs.</li>
            <li className="rounded-xl border border-sand-200 bg-sand-50 p-3">Reconcile damaged stock report.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
