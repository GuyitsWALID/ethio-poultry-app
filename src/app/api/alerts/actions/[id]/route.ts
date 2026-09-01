import { ZodError } from "zod";

import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { transitionAction } from "@/lib/accountable-actions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return context;
    const { id } = await params;
    const body = await request.json();
    await transitionAction(context, id, body);
    return Response.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "The action could not be updated.";
    const status = error instanceof ZodError ? 400 : /Only|outside|assigned to you|active assignment/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 409;
    return Response.json({ error: message }, { status });
  }
}
