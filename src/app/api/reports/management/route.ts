import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { createManagementReportSchedule, generateManagementReport, getManagementReportCenter, setManagementReportScheduleActive } from "@/lib/management-reports";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "The report request could not be completed.";
  const status = message.includes("Only the tenant CEO") || message.includes("outside your access") || message.includes("access is required") ? 403 : message.includes("not found") ? 404 : 400;
  return Response.json({ error_code: status === 403 ? "REPORT_SCOPE_DENIED" : status === 404 ? "REPORT_UNAVAILABLE" : "REPORT_REQUEST_FAILED" }, { status, headers: {"Cache-Control": "private, no-store"} });
}

export async function GET(request: Request) {
  const access = await getAccessContext({ tenant: true }); if (isAccessResponse(access)) return access;
  try { return Response.json(await getManagementReportCenter(access, new URL(request.url).searchParams.get("cursor")), {headers: {"Cache-Control": "private, no-store"}}); } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const access = await getAccessContext({ tenant: true }); if (isAccessResponse(access)) return access;
  try {
    const body = await request.json();
    const headers = {"Cache-Control": "private, no-store"};
    if (body.action === "create_schedule") return Response.json(await createManagementReportSchedule(access, body.schedule), { status: 201, headers });
    if (body.action === "set_active") return Response.json(await setManagementReportScheduleActive(access, String(body.scheduleId ?? ""), Boolean(body.active)), {headers});
    if (body.action === "run_now") return Response.json(await generateManagementReport(access, new URL(request.url).origin, body.report ?? {}), { status: 201, headers });
    return Response.json({ error_code: "REPORT_ACTION_INVALID" }, { status: 400, headers });
  } catch (error) { return failure(error); }
}
