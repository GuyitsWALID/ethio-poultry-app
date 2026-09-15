import { ZodError, z } from "zod";

import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { assignReconciliationFinding } from "@/lib/accountable-actions";

const inputSchema = z.object({ ownerId: z.string().uuid(), dueAt: z.string().datetime().optional(), instruction: z.string().trim().min(8).max(1000).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return context;
    const { id } = await params;
    const input = inputSchema.parse(await request.json());
    return Response.json({ action: await assignReconciliationFinding(context, id, input.ownerId, input.dueAt, input.instruction) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "The follow-up could not be assigned.";
    const status = error instanceof ZodError ? 400 : /Only|assigned|active/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 409;
    return Response.json({ error: message }, { status });
  }
}
