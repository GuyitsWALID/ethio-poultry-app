import Link from "next/link";

const navSections = [
  {
    title: "Executive",
    items: [
      { label: "Overview", href: "/app/admin" },
      { label: "Analytics", href: "/app/analytics" },
      { label: "Reports", href: "/app/reports" },
    ],
  },
  {
    title: "Farm Operations",
    items: [
      { label: "Farms", href: "/app/farms" },
      { label: "Flocks", href: "/app/flocks" },
      { label: "Daily Records", href: "/app/daily-records" },
      { label: "Inventory", href: "/app/inventory" },
      { label: "Health", href: "/app/health" },
      { label: "Alerts", href: "/app/alerts" },
      { label: "Sensors", href: "/app/sensors" },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "CRM", href: "/app/crm" },
      { label: "Sales", href: "/app/sales" },
      { label: "Training", href: "/app/training" },
      { label: "Accounting", href: "/app/accounting" },
    ],
  },
  {
    title: "People & Fleet",
    items: [
      { label: "HR", href: "/app/hr" },
      { label: "Fleet", href: "/app/fleet" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Users & Roles", href: "/app/users" },
      { label: "Settings", href: "/app/settings" },
    ],
  },
];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-sand-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-sand-200 bg-forest-900 text-sand-50 lg:flex">
          <div className="px-6 py-6">
            <p className="text-xs uppercase tracking-[0.3em] text-sand-200">
              Ethiopoultry
            </p>
            <h1 className="mt-2 text-2xl font-semibold font-[var(--font-display)]">
              Management System
            </h1>
          </div>
          <nav className="flex-1 space-y-6 px-4 pb-6 text-sm">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="px-3 text-xs uppercase tracking-[0.25em] text-sand-200">
                  {section.title}
                </p>
                <div className="mt-2 space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sand-100 transition hover:bg-forest-800"
                    >
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-forest-800 px-6 py-4 text-xs text-sand-200">
            Addis Branch · Farm A
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-sand-200 bg-white/80 px-6 py-4 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
                Dashboard
              </p>
              <p className="text-lg font-semibold text-forest-900">
                Ethiopoultry Operations Hub
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-forest-700">
              <button
                className="rounded-full border border-forest-900/20 px-4 py-2"
                type="button"
              >
                Switch farm
              </button>
              <button
                className="rounded-full bg-forest-900 px-4 py-2 text-sand-50"
                type="button"
              >
                New alert
              </button>
            </div>
          </header>

          <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}