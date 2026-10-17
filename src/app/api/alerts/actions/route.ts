import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { loadActionDesk, refreshActionDesk } from "@/lib/accountable-actions";
import {ZodError} from "zod";

export async function GET(request: Request) {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return context;
    const params = new URL(request.url).searchParams;
    return Response.json(await loadActionDesk(context, {cursor: params.get("cursor") ?? undefined, target: params.get("action_id") ?? undefined}), {headers: {"Cache-Control": "private, no-store"}});
  } catch (error: unknown) {
    const invalid = error instanceof ZodError || error instanceof SyntaxError;
    return Response.json({error: invalid ? "This alert link or page cursor is invalid. Open Alerts again." : "The action desk could not be loaded. Refresh and try again."},
      {status: invalid ? 400 : 500, headers: {"Cache-Control": "private, no-store"}});
  }
}

export async function POST() {
  const context = await getAccessContext({tenant: true});
  if (isAccessResponse(context)) return context;
  if (context.role !== "ceo" && context.role !== "farm_manager" && !context.supportSessionId)
    return Response.json({error: "Operational access is required."}, {status: 403});
  try {
    await refreshActionDesk(context);
    return Response.json({refreshed: true}, {headers: {"Cache-Control": "private, no-store"}});
  } catch {
    return Response.json({error: "Alerts could not finish checking sources. Existing work has been kept. Refresh and try again."}, {status: 503, headers: {"Cache-Control": "private, no-store"}});
  }
}
