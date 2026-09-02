import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F8F6] text-[#0B1714]">
      <div className="min-h-screen lg:flex">
        <AdminSidebar />
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 hidden items-center justify-between border-b border-[#D7E7DF] bg-[#F5F8F6]/90 px-8 py-4 backdrop-blur-xl lg:flex">
            <div><p className="text-[9px] font-semibold uppercase tracking-[.22em] text-[#587A6B]">Platform operations</p><p className="mt-1 text-sm font-semibold text-[#0B1714]">Administrator control room</p></div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#587A6B]"><span className="h-2 w-2 rounded-full bg-emerald-500" />Authenticated · platform scope</div>
          </header>
          <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-8 xl:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
