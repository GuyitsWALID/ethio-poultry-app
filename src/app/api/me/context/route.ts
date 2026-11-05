import { createClient } from "@supabase/supabase-js";

import { normalizeRole } from "@/lib/roles";
import { createClient as createAuthedClient } from "@/utils/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const serverConfigurationError = !supabaseUrl || !serviceRoleKey
  ? "The server database connection is not configured for this deployment."
  : null;
const supabaseAdmin = createClient(
  supabaseUrl ?? "https://unconfigured.invalid",
  serviceRoleKey ?? "unconfigured-service-role-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  try {
    if (serverConfigurationError) {
      return privateJson({ error: serverConfigurationError, code: "SERVER_CONFIGURATION_ERROR" }, 503);
    }
    const supabase = await createAuthedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return privateJson({ error: "Unauthorized" }, 401);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role, is_active, preferred_locale")
      .eq("id", user.id)
      .maybeSingle();

    const getOrganization = async (orgId: string | null | undefined) => {
      if (!orgId) return null;
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("name,today_workspace_enabled")
        .eq("id", orgId)
        .maybeSingle();
      return org ?? null;
    };

    if (profile?.org_id && profile.is_active && normalizeRole(profile.role)) {
      let effectiveOrgId = profile.org_id;
      let supportSession: { id: string; target_org_id: string; expires_at: string } | null = null;
      if (normalizeRole(profile.role) === "system_admin") {
        const now = new Date().toISOString();
        const { data } = await supabaseAdmin.from("break_glass_sessions").select("id,target_org_id,expires_at").eq("administrator_id", user.id).is("revoked_at", null).lte("started_at", now).gt("expires_at", now).order("expires_at", { ascending: false }).limit(1).maybeSingle();
        supportSession = data;
        if (data) effectiveOrgId = data.target_org_id;
      }
      const organization = await getOrganization(effectiveOrgId);
      return privateJson(
        {
          userId: user.id,
          orgId: effectiveOrgId,
          orgName: organization?.name ?? null,
          todayWorkspaceEnabled: Boolean(organization?.today_workspace_enabled),
          role: normalizeRole(profile.role),
          preferredLocale: profile.preferred_locale === "am" ? "am" : "en",
          supportSessionId: supportSession?.id ?? null,
          supportExpiresAt: supportSession?.expires_at ?? null,
        }
      );
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from("profiles")
      .select("org_id, role, is_active, preferred_locale")
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfileError) {
      return privateJson({ error: adminProfileError.message }, 500);
    }

    const organization = await getOrganization(adminProfile?.org_id);
    return privateJson(
      {
        userId: user.id,
        orgId: adminProfile?.org_id ?? null,
        orgName: organization?.name ?? null,
        todayWorkspaceEnabled: Boolean(organization?.today_workspace_enabled),
        role: adminProfile?.is_active ? normalizeRole(adminProfile?.role) : null,
        preferredLocale: adminProfile?.preferred_locale === "am" ? "am" : "en",
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return privateJson({ error: message }, 500);
  }
}
