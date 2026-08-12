import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { transitionFinding } from "@/lib/reconciliation-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAccessContext({ tenant: true });
  if (isAccessResponse(context)) return context;

  const { id } = await params;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.action !== "string") {
    return Response.json({ error: "A valid finding action is required." }, { status: 400 });
  }

  try {
    const finding = await transitionFinding(
      context,
      id,
      payload.action,
      typeof payload.note === "string" ? payload.note : "",
      Array.isArray(payload.evidence) ? payload.evidence : [],
    );
    return Response.json({ finding });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update the finding." },
      { status: 400 },
    );
  }
}
