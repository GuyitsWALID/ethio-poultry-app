import { redirect } from "next/navigation";

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

  const rawRole = String(profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role ?? "")
    .trim()
    .toLowerCase();

  const isCeoRole = rawRole === "ceo" || rawRole === "system_admin" || rawRole === "super_admin";

  if (!isCeoRole) {
    if (rawRole === "veterinarian") redirect("/app/health");
    if (rawRole === "store_keeper") redirect("/app/inventory");
    redirect("/app/farm-manager");
  }

  return <>{children}</>;
}
