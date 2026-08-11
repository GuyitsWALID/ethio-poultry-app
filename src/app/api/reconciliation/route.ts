import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { getReconciliationDashboard } from "@/lib/reconciliation-service";

export async function GET(request: Request) {
  const context = await getAccessContext({ tenant: true });
  if (isAccessResponse(context)) return context;

  const url = new URL(request.url);
  const dashboard = await getReconciliationDashboard(
    context,
    url.searchParams.get("refresh") === "1",
  );

  return Response.json(dashboard);
}
