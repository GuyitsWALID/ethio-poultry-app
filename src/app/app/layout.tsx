import { AppShell } from "@/components/app-shell";
import { FarmScopeProvider } from "@/components/farm-scope-context";
import { getAccessContext, isAccessResponse } from "@/lib/access-context";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await getAccessContext({ tenant: true });
  const viewerRole = isAccessResponse(access) ? null : access.role;

  return (
    <FarmScopeProvider>
      <AppShell viewerRole={viewerRole}>{children}</AppShell>
    </FarmScopeProvider>
  );
}
