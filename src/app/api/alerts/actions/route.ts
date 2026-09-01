import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { loadActionDesk } from "@/lib/accountable-actions";

export async function GET() {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return context;
    return Response.json(await loadActionDesk(context), { status: 200 });
  } catch (error: unknown) {
    return Response.json({ error: error instanceof Error ? error.message : "The action desk could not be loaded." }, { status: 500 });
  }
}
