import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-sand-50">
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-sand-200 bg-white/80 px-6 py-4 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
                Admin Console
              </p>
              <p className="text-lg font-semibold text-forest-900">
                Ethiopoultry Platform Operations
              </p>
            </div>
          </header>
          <main className="px-6 py-8 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
