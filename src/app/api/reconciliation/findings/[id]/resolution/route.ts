import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { loadFindingResolution } from "@/lib/reconciliation-resolution";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return context;
    const { id } = await params;
    return Response.json(await loadFindingResolution(context, id));
  } catch (error: unknown) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : 500;
    return Response.json({ error: error instanceof Error ? error.message : "Resolution guidance could not be loaded." }, { status });
  }
}
