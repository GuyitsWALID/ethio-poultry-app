import {getAccessContext, isAccessResponse} from "@/lib/access-context";
import {parsePerformanceInput, PerformanceError} from "@/lib/farm-performance";
import {ReportEvidenceError} from "@/lib/report-evidence";
import {loadFarmPerformance} from "@/lib/farm-performance.server";

export async function GET(request: Request) {
  const headers = {"Cache-Control": "private, no-store", Vary: "Cookie"};
  const started = Date.now();
  let status = 200;
  let failedSections: string[] = [];
  try {
    const ctx = await getAccessContext({tenant: true});
    if (isAccessResponse(ctx)) {
      status = ctx.status;
      return Response.json({code: status === 401 ? "REPORT_SESSION_EXPIRED" : status === 403 ? "REPORT_SCOPE_DENIED" : "REPORT_LOAD_FAILED"}, {status, headers});
    }
    const input = parsePerformanceInput(new URL(request.url).searchParams);
    const result = await loadFarmPerformance(ctx, input);
    failedSections = Object.entries(result.sections).filter(([, section]) => section.state === "failed").map(([key]) => key);
    return Response.json(result, {headers});
  } catch (error) {
    status = error && typeof error === "object" && "status" in error ? Number(error.status) : 500;
    const safeStatus = [400, 401, 403, 409, 500, 503].includes(status) ? status : 500;
    const code = safeStatus >= 500 ? "REPORT_LOAD_FAILED" : error instanceof PerformanceError || error instanceof ReportEvidenceError ? error.code : "REPORT_LOAD_FAILED";
    return Response.json({code}, {status: safeStatus, headers});
  } finally {
    console.info("performance.read", {status, durationMs: Date.now() - started, failedSections});
  }
}
