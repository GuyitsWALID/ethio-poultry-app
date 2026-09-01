import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { loadActionDesk } from "@/lib/accountable-actions";

export async function GET() {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return Response.json({ alerts: [] });
    const desk = await loadActionDesk(context);
    const alerts = desk.actions.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
    return new Response(JSON.stringify({ alerts: alerts.slice(0, 30) }), { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
