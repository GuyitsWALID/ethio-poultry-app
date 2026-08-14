import { accessJson, getAccessContext, isAccessResponse } from "@/lib/access-context";
import { createInventoryWarehouse, listInventoryWarehouses, WarehouseManagementError } from "@/lib/warehouse-management";

function failure(error: unknown) {
  if (error instanceof WarehouseManagementError) return accessJson({ error: error.message }, error.status);
  return accessJson({ error: error instanceof Error ? error.message : "Warehouse setup failed." }, 500);
}

export async function GET() {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  if (!ctx.supportSessionId && ctx.role !== "ceo" && ctx.role !== "farm_manager") return accessJson({ error: "Warehouse access is required." }, 403);
  try {
    return accessJson(await listInventoryWarehouses(ctx));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  try {
    const result = await createInventoryWarehouse(ctx, await request.json().catch(() => null));
    return accessJson(result, 201);
  } catch (error) {
    return failure(error);
  }
}
