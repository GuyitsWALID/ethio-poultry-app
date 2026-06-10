import { createClient } from "@supabase/supabase-js";

import { getCurrentAlerts } from "@/lib/current-alerts";
import type { Database } from "@/types/supabase";
import { createClient as createAuthedClient } from "@/utils/supabase/server";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET() {
  try {
    const supabase = await createAuthedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return new Response(JSON.stringify({ alerts: [] }), { status: 200 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.org_id) return new Response(JSON.stringify({ alerts: [] }), { status: 200 });

    const alerts = await getCurrentAlerts(supabaseAdmin, profile.org_id);
    return new Response(JSON.stringify({ alerts: alerts.slice(0, 30) }), { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
