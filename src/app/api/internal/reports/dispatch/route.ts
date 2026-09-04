import { dispatchScheduledManagementReports } from "@/lib/management-reports";
import { tokenMatches } from "@/lib/platform-observability";

export async function POST(request: Request) {
  const expected = process.env.MONITORING_INGEST_TOKEN?.trim();
  if (!expected) return Response.json({ error: "Scheduled reports are not configured." }, { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!provided || !(await tokenMatches(provided, expected))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await dispatchScheduledManagementReports(new URL(request.url).origin)); }
  catch { return Response.json({ error: "Scheduled report dispatch failed." }, { status: 503 }); }
}
