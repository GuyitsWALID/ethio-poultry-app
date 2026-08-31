import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { loadSystemHealth } from "@/lib/platform-observability";

export async function GET() {
  const access = await getAccessContext();
  if (isAccessResponse(access)) return access;
  if (access.role !== "system_admin") return Response.json({ error: "System Administrator access required." }, { status: 403 });

  try {
    return Response.json(await loadSystemHealth(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "System health could not be evaluated." }, { status: 500 });
  }
}
