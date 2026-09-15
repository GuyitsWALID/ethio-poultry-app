import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { transitionFinding } from "@/lib/reconciliation-service";
import { createClient } from "@/utils/supabase/server";

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
    if (payload.action === "accept_exception") {
      if (context.role !== "ceo") throw new Error("CEO authority is required for this decision.");
      const note = typeof payload.note === "string" ? payload.note.trim() : "";
      const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
      if (note.length < 8) throw new Error("A note of at least eight characters is required.");
      if (!evidence.length) throw new Error("A supporting reference is required for an exception.");
      const auth = await createClient();
      const { data: finding, error } = await auth.rpc("accept_reconciliation_exception", { p_finding_id: id, p_note: note, p_evidence: evidence });
      if (error) throw new Error(error.message);
      return Response.json({ finding });
    }
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
