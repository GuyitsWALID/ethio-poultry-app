import { AppSidebar } from "@/components/app-sidebar";
import { FarmScopeProvider } from "@/components/farm-scope-context";
import { FarmScopeFilters } from "@/components/farm-scope-filters";
import { SignOutButton } from "@/components/sign-out-button";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <FarmScopeProvider>
      <div className="min-h-screen bg-sand-50">
        <div className="flex min-h-screen">
          <AppSidebar />

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
                <SignOutButton />
              </div>
            </header>

            <div className="px-6 pt-6 lg:px-10">
              <FarmScopeFilters />
            </div>
            <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
          </div>
        </div>
      </div>
    </FarmScopeProvider>
  );
}
