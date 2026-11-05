import { routeForRole } from "@/lib/roles";
import {governanceAdmin} from "@/lib/access-context";
import { createClient } from "@/utils/supabase/server";

export async function getAuthRedirectPath(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "/auth/sign-in";
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,org_id")
    .eq("id", user.id)
    .maybeSingle();

  const resolvedRole = profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role;
  if (resolvedRole === "farm_manager" && profile?.org_id) {
    const {data: organization} = await governanceAdmin
      .from("organizations")
      .select("today_workspace_enabled")
      .eq("id", profile.org_id)
      .maybeSingle();
    if (organization?.today_workspace_enabled) return "/app/today";
  }
  return routeForRole(resolvedRole);
}
