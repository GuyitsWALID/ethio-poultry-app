import { getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";
import { getCurrentAlerts } from "@/lib/current-alerts";
import { getReconciliationAlerts } from "@/lib/reconciliation-service";
import { getGovernanceAlerts } from "@/lib/governance-workflow";

export async function GET() {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return Response.json({ alerts: [] });
    const [current, reconciliation, governance] = await Promise.all([
      getCurrentAlerts(governanceAdmin, context.orgId),
      getReconciliationAlerts(context),
      getGovernanceAlerts(context),
    ]);
    const alerts = [...governance, ...reconciliation, ...current].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    return new Response(JSON.stringify({ alerts: alerts.slice(0, 30) }), { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
