import { accessJson, getAccessContext, isAccessResponse } from "@/lib/access-context";
import {
  createInventoryItem,
  getInventoryCatalog,
  InventoryCatalogError,
} from "@/lib/inventory-catalog";

function failure(error: unknown) {
  if (error instanceof InventoryCatalogError) return accessJson({ error: error.message }, error.status);
  return accessJson({ error: error instanceof Error ? error.message : "Inventory catalogue request failed." }, 500);
}

export async function GET() {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  try {
    return accessJson(await getInventoryCatalog(ctx));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  try {
    return accessJson(await createInventoryItem(ctx, await request.json().catch(() => null)), 201);
  } catch (error) {
    return failure(error);
  }
}
