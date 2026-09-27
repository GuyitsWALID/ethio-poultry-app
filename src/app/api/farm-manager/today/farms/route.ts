import {getAccessContext, governanceAdmin, isAccessResponse} from "@/lib/access-context";

function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {"Cache-Control": "private, no-store"},
  });
}

export async function GET() {
  const access = await getAccessContext({tenant: true});
  if (isAccessResponse(access)) {
    const body = await access.json().catch(() => ({error: "Access could not be verified."}));
    return privateJson(body, access.status);
  }
  if (access.role !== "farm_manager" && !access.supportSessionId) {
    return privateJson({error: "Farm Manager access is required."}, 403);
  }

  const now = new Date().toISOString();
  if (access.supportSessionId) {
    const result = await governanceAdmin.from("farms").select("id,name,branch_id").eq("org_id", access.orgId).order("name");
    if (result.error) return privateJson({error: result.error.message}, 500);
    return privateJson({farms: result.data ?? []});
  }

  const assignments = await governanceAdmin
      .from("user_farm_access")
      .select("farm_id,farms!inner(id,name,branch_id,org_id)")
      .eq("org_id", access.orgId)
      .eq("profile_id", access.userId)
      .eq("farms.org_id", access.orgId)
      .is("revoked_at", null)
      .lte("starts_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("farm_id");

  if (assignments.error) return privateJson({error: assignments.error.message}, 500);
  const farms = (assignments.data ?? []).flatMap((row) => {
    const farm = Array.isArray(row.farms) ? row.farms[0] : row.farms;
    return farm ? [{id: String(farm.id), name: String(farm.name), branch_id: String(farm.branch_id)}] : [];
  });

  return privateJson({farms});
}
