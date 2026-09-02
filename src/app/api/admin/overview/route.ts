import { getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";

export async function GET() {
  try {
    const access = await getAccessContext();
    if (isAccessResponse(access)) return access;
    if (access.role !== "system_admin") return Response.json({ message: "System Administrator access required." }, { status: 403 });

    const [organizationResult, profileResult] = await Promise.all([
      governanceAdmin.from("organizations").select("id,name,plan,branch_count,primary_location,created_at").order("created_at", { ascending: false }),
      governanceAdmin.from("profiles").select("id,org_id,full_name,role,is_active"),
    ]);
    if (organizationResult.error || profileResult.error) {
      return Response.json({ message: organizationResult.error?.message ?? profileResult.error?.message ?? "Unable to load platform overview." }, { status: 500 });
    }

    const organizations = organizationResult.data ?? [];
    const profiles = profileResult.data ?? [];
    const activeOrgIds = new Set(profiles.filter((profile) => profile.is_active).map((profile) => profile.org_id));
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return Response.json({
      totalOrganizations: organizations.length,
      activeOrganizations: activeOrgIds.size,
      totalUsers: profiles.length,
      newOrganizations30d: organizations.filter((organization) => new Date(organization.created_at).getTime() >= cutoff).length,
      organizations: organizations.map((organization) => {
        const members = profiles.filter((profile) => profile.org_id === organization.id);
        const ceo = members.find((profile) => profile.role === "ceo" && profile.is_active);
        return {
          id: organization.id,
          name: organization.name,
          plan: organization.plan,
          branchCount: organization.branch_count,
          location: organization.primary_location,
          createdAt: organization.created_at,
          userCount: members.length,
          activeUserCount: members.filter((profile) => profile.is_active).length,
          ceoName: ceo?.full_name ?? null,
          status: members.some((profile) => profile.is_active) ? "active" : "inactive",
        };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return Response.json({ message: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}
