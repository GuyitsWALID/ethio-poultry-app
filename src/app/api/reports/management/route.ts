import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { createManagementReportSchedule, generateManagementReport, getManagementReportCenter, setManagementReportScheduleActive } from "@/lib/management-reports";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "The report request could not be completed.";
  const status = message.includes("Only the tenant CEO") || message.includes("outside your access") ? 403 : message.includes("not found") ? 404 : 400;
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const access = await getAccessContext({ tenant: true }); if (isAccessResponse(access)) return access;
  try { return Response.json(await getManagementReportCenter(access)); } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const access = await getAccessContext({ tenant: true }); if (isAccessResponse(access)) return access;
  try {
    const body = await request.json();
    if (body.action === "create_schedule") return Response.json(await createManagementReportSchedule(access, body.schedule), { status: 201 });
    if (body.action === "set_active") return Response.json(await setManagementReportScheduleActive(access, String(body.scheduleId ?? ""), Boolean(body.active)));
    if (body.action === "run_now") return Response.json(await generateManagementReport(access, new URL(request.url).origin, body.report ?? {}), { status: 201 });
    return Response.json({ error: "Unknown report action." }, { status: 400 });
  } catch (error) { return failure(error); }
}
