export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f8f6f2_55%,_#efe9dd_100%)] grain">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
            Ethiopoultry
          </p>
          <h1 className="text-2xl font-semibold font-[var(--font-display)] text-forest-900">
            Management System
          </h1>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-forest-700 md:flex">
          {[
            "Modules",
            "Workflow",
            "Security",
            "Contact",
          ].map((item) => (
            <button key={item} className="hover:text-forest-900" type="button">
              {item}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button
            className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700 transition hover:border-forest-900/40"
            type="button"
          >
            Request demo
          </button>
          <button
            className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 transition hover:bg-forest-700"
            type="button"
          >
            Start building
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">
        <section className="grid gap-10 pb-16 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.35em] text-forest-500">
              Poultry ops, simplified
            </p>
            <h2 className="text-4xl font-semibold font-[var(--font-display)] text-forest-900 sm:text-5xl">
              Ethiopoultry Management System
            </h2>
            <p className="text-lg text-forest-700">
              Run daily poultry operations with clarity. Track flocks, feed,
              health, inventory, and accounting from one modern workspace built
              for Ethiopian farms.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                className="rounded-full bg-forest-900 px-6 py-3 text-sm text-sand-50 transition hover:bg-forest-700"
                type="button"
              >
                See the platform
              </button>
              <button
                className="rounded-full border border-forest-900/20 px-6 py-3 text-sm text-forest-700 transition hover:border-forest-900/40"
                type="button"
              >
                Talk to an expert
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Daily records", value: "< 3 min" },
                { label: "Auto KPIs", value: "Live" },
                { label: "Multi-branch", value: "Ready" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-sand-200 bg-white/80 p-4 shadow-sm"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-forest-500">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-forest-900">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-sand-200 bg-white/90 p-6 shadow-lg">
            <div className="rounded-2xl border border-sand-100 bg-sand-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-forest-500">
                Live farm pulse
              </p>
              <div className="mt-4 grid gap-4">
                {[
                  { label: "Mortality", value: "1.2%", tone: "text-ember-500" },
                  { label: "Feed intake", value: "3.4t", tone: "text-amber-500" },
                  { label: "Egg output", value: "+8.6%", tone: "text-leaf-500" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-forest-800">
                      {item.label}
                    </span>
                    <span className={`text-xs font-semibold ${item.tone}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-forest-900 px-5 py-6 text-sand-50">
              <p className="text-sm text-sand-200">Alert center</p>
              <p className="mt-2 text-lg font-semibold">
                Low feed stock in House 4
              </p>
              <p className="mt-2 text-xs text-sand-200">
                Reorder within 5 days to avoid production dip.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-t border-sand-200 py-16" id="modules">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-forest-500">
                Modules
              </p>
              <h3 className="text-2xl font-semibold font-[var(--font-display)] text-forest-900">
                Everything a poultry farm runs on
              </h3>
            </div>
            <button
              className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
              type="button"
            >
              View roadmap
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Flock lifecycle",
                text: "Register, track, and analyze every flock from placement to sale.",
              },
              {
                title: "Daily operations",
                text: "Fast daily records with auto-calculated KPIs and alerts.",
              },
              {
                title: "Inventory and feed",
                text: "Real-time stock, expiry tracking, and issue-to-flock costing.",
              },
              {
                title: "Health and biosecurity",
                text: "Vaccination schedules, treatment logs, and vet diagnostics.",
              },
              {
                title: "Accounting core",
                text: "Automatic journals and farm-level P&L from every action.",
              },
              {
                title: "Reports and analytics",
                text: "FCR, mortality, HDEP, and profitability dashboards.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-sand-200 bg-white/90 p-6 shadow-sm"
              >
                <h4 className="text-lg font-semibold text-forest-900">
                  {card.title}
                </h4>
                <p className="mt-3 text-sm text-forest-600">{card.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="grid gap-6 border-t border-sand-200 py-16 lg:grid-cols-[1fr_1.2fr]"
          id="workflow"
        >
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-forest-500">
              Workflow
            </p>
            <h3 className="text-2xl font-semibold font-[var(--font-display)] text-forest-900">
              Daily operations in four focused steps
            </h3>
            <p className="text-sm text-forest-600">
              The system mirrors how farm teams work today, but replaces manual
              spreadsheets with instant KPI insights.
            </p>
          </div>
          <div className="grid gap-4">
            {[
              {
                step: "1",
                title: "Capture daily data",
                text: "Record feed, mortality, egg count, and water by house.",
              },
              {
                step: "2",
                title: "System calculates KPIs",
                text: "FCR, mortality rate, and HDEP update automatically.",
              },
              {
                step: "3",
                title: "Alerts highlight risks",
                text: "Low stock and performance dips surface instantly.",
              },
              {
                step: "4",
                title: "Decide and act",
                text: "Managers see what to fix before losses compound.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="flex gap-4 rounded-2xl border border-sand-200 bg-white/90 p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-900 text-sm font-semibold text-sand-50">
                  {step.step}
                </div>
                <div>
                  <h4 className="text-base font-semibold text-forest-900">
                    {step.title}
                  </h4>
                  <p className="mt-2 text-sm text-forest-600">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 border-t border-sand-200 py-16" id="security">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-sand-200 bg-white/90 p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-forest-900">
                Built for multi-branch control
              </h3>
              <p className="mt-3 text-sm text-forest-600">
                Role-based access, branch-level reporting, and clear audit trails
                keep every farm aligned and accountable.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-forest-700">
                {[
                  "RLS-ready data model",
                  "Branch and farm level permissions",
                  "Offline-ready daily entry workflows",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2"
                  >
                    <span className="h-2 w-2 rounded-full bg-leaf-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-sand-200 bg-forest-900 p-6 text-sand-50 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-200">
                Ready for scale
              </p>
              <h3 className="mt-3 text-2xl font-semibold">
                Data-driven poultry decisions
              </h3>
              <p className="mt-3 text-sm text-sand-200">
                Replace guesswork with real-time production, cost, and
                profitability insight at every house and flock.
              </p>
              <button
                className="mt-6 rounded-full bg-sand-50 px-5 py-2 text-sm text-forest-900"
                type="button"
              >
                Schedule a walkthrough
              </button>
            </div>
          </div>
        </section>

        <section
          className="rounded-[28px] border border-sand-200 bg-white/90 p-8 text-center shadow-lg"
          id="contact"
        >
          <h3 className="text-2xl font-semibold font-[var(--font-display)] text-forest-900">
            Build your farm operations hub
          </h3>
          <p className="mt-3 text-sm text-forest-600">
            Start with daily operations, then activate inventory, health, and
            accounting modules as you grow.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <button
              className="rounded-full bg-forest-900 px-6 py-3 text-sm text-sand-50"
              type="button"
            >
              Get started
            </button>
            <button
              className="rounded-full border border-forest-900/20 px-6 py-3 text-sm text-forest-700"
              type="button"
            >
              Download one-pager
            </button>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 pt-8 text-xs text-forest-500">
        Ethiopoultry Management System - Built for Ethiopian poultry farms
      </footer>
    </div>
  );
}
