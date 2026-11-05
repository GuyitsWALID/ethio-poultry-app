import {getAccessContext, isAccessResponse} from "@/lib/access-context";
import {ReportEvidenceError} from "@/lib/report-evidence";
import {loadReportEvidence} from "@/lib/report-evidence.server";

export async function GET(request: Request) {
  const headers = {"Cache-Control": "private, no-store", Vary: "Cookie"};
  const ctx = await getAccessContext({tenant: true});
  if (isAccessResponse(ctx)) {ctx.headers.set("Cache-Control", headers["Cache-Control"]); return ctx;}
  const query = new URL(request.url).searchParams;
  const section = query.get("section");
  if (section !== "health" && section !== "finance") return Response.json({code: "INVALID_REPORT_SECTION"}, {status: 400, headers});
  try {
    const result = await loadReportEvidence(ctx, section, {dateFrom: query.get("date_from") || "", dateTo: query.get("date_to") || "", branchId: query.get("branch_id") || "", farmId: query.get("farm_id") || "", houseId: query.get("house_id") || "", flockId: query.get("flock_id") || "", batchId: query.get("batch_id") || ""});
    return Response.json(result, {headers});
  } catch (error) {
    const invalidRange = error instanceof Error && error.message === "INVALID_REPORT_RANGE";
    return Response.json({code: error instanceof ReportEvidenceError ? error.code : invalidRange ? "INVALID_REPORT_RANGE" : "REPORT_LOAD_FAILED"}, {status: error instanceof ReportEvidenceError ? error.status : invalidRange ? 400 : 500, headers});
  }
}
