import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { getReconciliationDashboard } from "@/lib/reconciliation-service";
import {getLocale, getTranslations} from "next-intl/server";

export async function GET(request: Request) {
  const context = await getAccessContext({ tenant: true });
  if (isAccessResponse(context)) return context;

  const url = new URL(request.url);
  const locale = await getLocale();
  const t = await getTranslations("ReconciliationEvidence");
  const dashboard = await getReconciliationDashboard(
    context,
    url.searchParams.get("refresh") === "1",
    {locale, translate: (key, values) => t.has((key) as Parameters<typeof t>[0]) ? t((key) as Parameters<typeof t>[0], values) : undefined},
  );

  return Response.json(dashboard);
}
