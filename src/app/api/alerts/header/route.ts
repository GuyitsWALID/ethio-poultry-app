import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { loadActionDesk } from "@/lib/accountable-actions";

export async function GET() {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return context;
    const desk = await loadActionDesk(context, {header: true});
    return Response.json({alerts: desk.actions, total: desk.page?.total ?? desk.actions.length}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (error: unknown) {
    void error;
    return Response.json({error: "Alerts could not be loaded. Refresh and try again."}, {status: 500, headers: {"Cache-Control": "private, no-store"}});
  }
}
