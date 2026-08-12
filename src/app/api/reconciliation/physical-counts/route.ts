import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { recordPhysicalCount } from "@/lib/reconciliation-service";

export async function POST(request: Request) {
  const context = await getAccessContext({ tenant: true });
  if (isAccessResponse(context)) return context;

  const payload = await request.json().catch(() => null);
  if (!payload) return Response.json({ error: "Physical count details are required." }, { status: 400 });

  try {
    const count = await recordPhysicalCount(context, {
      warehouseId: String(payload.warehouseId ?? ""),
      itemId: String(payload.itemId ?? ""),
      countDate: String(payload.countDate ?? ""),
      countedQuantity: Number(payload.countedQuantity),
      notes: typeof payload.notes === "string" ? payload.notes : null,
      evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    });
    return Response.json({ count }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not record the physical count." },
      { status: 400 },
    );
  }
}
