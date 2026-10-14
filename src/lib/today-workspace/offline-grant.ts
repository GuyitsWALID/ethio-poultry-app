import "server-only";
import {governanceAdmin, type AccessContext} from "@/lib/access-context";
import type {TodayWorkspace} from "./contracts";

// Call only after the workspace has passed tenant, role and assignment checks.
export async function attachOfflineGrant(context: AccessContext, workspace: TodayWorkspace, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Africa/Addis_Ababa",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type,part.value]));
  const today = `${value.year}-${value.month}-${value.day}`;
  if (context.role !== "farm_manager" || workspace.workDate !== today || workspace.operatingDay.status !== "open") return;
  const assignment = await governanceAdmin.from("user_farm_access").select("expires_at")
    .eq("org_id",context.orgId).eq("profile_id",context.userId).eq("farm_id",workspace.farm.id)
    .is("revoked_at",null).lte("starts_at",now.toISOString())
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`).maybeSingle();
  const dayEnd = `${today}T21:00:00.000Z`;
  if (!assignment.error && assignment.data) workspace.offlineAccess = {
    tenantId:context.orgId,userId:context.userId,farmId:workspace.farm.id,
    flockIds:workspace.flocks.filter(flock=>flock.canRecord!==false).map(flock=>flock.id),
    workDate:today,issuedAt:now.toISOString(),
    expiresAt:assignment.data.expires_at && Date.parse(assignment.data.expires_at)<Date.parse(dayEnd) ? assignment.data.expires_at : dayEnd,
  };
}
