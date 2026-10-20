import {getAccessContext, isAccessResponse} from "@/lib/access-context";
import {getManagementReportRun, renderManagementReportHtml} from "@/lib/management-reports";

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  const access = await getAccessContext({tenant: true});
  if (isAccessResponse(access)) return access;
  const headers = {"Cache-Control": "private, no-store"};
  try {
    const {id} = await context.params;
    const run = await getManagementReportRun(access, id, true);
    const locale = new URL(request.url).searchParams.get("locale") === "am" ? "am" : "en";
    return Response.json({id: run.id, report_name: run.report_name, period_from: run.period_from, period_to: run.period_to,
      status: run.status, failure_message: run.failure_message, generated_at: run.generated_at, created_at: run.created_at,
      report_version: run.report_version, html: run.status === "completed" ? renderManagementReportHtml(run, locale) : null}, {headers});
  } catch {
    return Response.json({error: "This saved report is unavailable or you no longer have access."}, {status: 404, headers});
  }
}
