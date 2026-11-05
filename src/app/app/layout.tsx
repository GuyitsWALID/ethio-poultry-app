import { AppShell } from "@/components/app-shell";
import { FarmScopeProvider } from "@/components/farm-scope-context";
import { getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await getAccessContext({ tenant: true });
  const viewerRole = isAccessResponse(access) ? null : access.role;
  const organization = !isAccessResponse(access)
    ? await governanceAdmin.from("organizations").select("today_workspace_enabled").eq("id", access.orgId).maybeSingle()
    : {data: null};
  const todayWorkspaceEnabled = Boolean(organization.data?.today_workspace_enabled);

  return (
    <FarmScopeProvider viewerRole={viewerRole} todayWorkspaceEnabled={todayWorkspaceEnabled}>
      <AppShell viewerRole={viewerRole} todayWorkspaceEnabled={todayWorkspaceEnabled}>{children}</AppShell>
    </FarmScopeProvider>
  );
}
