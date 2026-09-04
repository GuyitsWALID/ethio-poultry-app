import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { getManagementReportRun, renderManagementReportCsv, renderManagementReportHtml } from "@/lib/management-reports";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext({ tenant: true }); if (isAccessResponse(access)) return access;
  try {
    const { id } = await context.params; const run = await getManagementReportRun(access, id);
    const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "html";
    const body = format === "csv" ? renderManagementReportCsv(run) : renderManagementReportHtml(run);
    const safeName = String(run.report_name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "management-report";
    return new Response(body, { headers: { "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="${safeName}-${run.period_to}.${format}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Report download failed." }, { status: 404 }); }
}
