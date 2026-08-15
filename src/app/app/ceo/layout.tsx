import { redirect } from "next/navigation";

import { normalizeRole, routeForRole } from "@/lib/roles";
import { createClient } from "@/utils/supabase/server";

export default async function CeoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const rawRole = profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role;

  const isCeoRole = normalizeRole(rawRole) === "ceo";

  if (!isCeoRole) {
    redirect(routeForRole(rawRole));
  }

  return <>{children}</>;
}
