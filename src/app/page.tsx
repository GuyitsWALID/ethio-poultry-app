import { redirect } from "next/navigation";
import { getAuthRedirectPath } from "@/lib/auth-routing";

export default async function Home() {
  redirect(await getAuthRedirectPath());
}
