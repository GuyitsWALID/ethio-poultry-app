import { recordOperationalEvidence, tokenMatches } from "@/lib/platform-observability";

export async function POST(request: Request) {
  const expected = process.env.MONITORING_INGEST_TOKEN?.trim();
  if (!expected) return Response.json({ error: "Monitoring evidence intake is not configured." }, { status: 503 });

  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!provided || !(await tokenMatches(provided, expected))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await recordOperationalEvidence(await request.json());
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid monitoring evidence.";
    return Response.json({ error: message }, { status: 400 });
  }
}
