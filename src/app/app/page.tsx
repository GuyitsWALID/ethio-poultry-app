import { redirect } from "next/navigation";
import { getAuthRedirectPath } from "@/lib/auth-routing";

export default async function AppEntryPage() {
  redirect(await getAuthRedirectPath());
}
