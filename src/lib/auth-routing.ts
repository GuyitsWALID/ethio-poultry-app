import { routeForRole } from "@/lib/roles";
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
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const resolvedRole = profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role;
  return routeForRole(resolvedRole);
}
