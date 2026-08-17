import "server-only";

import { z } from "zod";

import { type AccessContext, governanceAdmin } from "@/lib/access-context";
import { recordAuditEvent } from "@/lib/audit-ledger";

const inventoryCategories = [
  "feed",
  "medicine",
  "vaccine",
  "vitamin",
  "supplement",
  "equipment",
  "spare_parts",
  "packaging",
  "miscellaneous",
] as const;

const itemSchema = z.object({
  name: z.string().trim().min(2, "Enter an item name.").max(120),
  category: z.enum(inventoryCategories),
  unit: z.string().trim().min(1, "Enter a unit of measure.").max(40),
  reorderLevel: z.number().finite().nonnegative("Reorder level cannot be negative."),
  unitCost: z.number().finite().nonnegative("Unit cost cannot be negative."),
});

export class InventoryCatalogError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function assignedWarehouseIds(ctx: AccessContext) {
  if (ctx.role !== "farm_manager") return null;
  const now = new Date().toISOString();
  const { data, error } = await governanceAdmin
    .from("user_warehouse_access")
    .select("warehouse_id")
    .eq("org_id", ctx.orgId)
    .eq("profile_id", ctx.userId)
    .is("revoked_at", null)
    .lte("starts_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`);
  if (error) throw new InventoryCatalogError(error.message, 500);
  return [...new Set((data ?? []).map((row) => String(row.warehouse_id)))];
}

export async function getInventoryCatalog(ctx: AccessContext) {
  if (!ctx.supportSessionId && ctx.role !== "ceo" && ctx.role !== "farm_manager") {
    throw new InventoryCatalogError("Inventory access is not available for this role.", 403);
  }

  const warehouseIds = await assignedWarehouseIds(ctx);
  const itemsQuery = governanceAdmin
    .from("inventory_items")
    .select("id,name,category,unit,reorder_level,unit_cost")
    .eq("org_id", ctx.orgId)
    .order("name");

  let ledgerQuery = governanceAdmin
    .from("stock_ledger")
    .select("item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,flock_id,reference_doc,supplier_name,invoice_number,procurement_type,notes")
    .eq("org_id", ctx.orgId)
    .order("transaction_date", { ascending: false })
    .limit(10000);

  if (warehouseIds !== null) {
    if (warehouseIds.length === 0) {
      const itemsResult = await itemsQuery;
      if (itemsResult.error) throw new InventoryCatalogError(itemsResult.error.message, 500);
      return { items: itemsResult.data ?? [], ledger: [], warehouseAssignmentRequired: true };
    }
    ledgerQuery = ledgerQuery.in("warehouse_id", warehouseIds);
  }

  const [itemsResult, ledgerResult] = await Promise.all([itemsQuery, ledgerQuery]);
  if (itemsResult.error) throw new InventoryCatalogError(itemsResult.error.message, 500);
  if (ledgerResult.error) throw new InventoryCatalogError(ledgerResult.error.message, 500);
  return {
    items: itemsResult.data ?? [],
    ledger: ledgerResult.data ?? [],
    warehouseAssignmentRequired: false,
  };
}

export async function createInventoryItem(ctx: AccessContext, input: unknown) {
  if (ctx.role !== "farm_manager" && !ctx.supportSessionId) {
    throw new InventoryCatalogError("Only a Farm Manager with an assigned warehouse can add catalogue items.", 403);
  }
  const warehouseIds = await assignedWarehouseIds(ctx);
  if (!ctx.supportSessionId && (!warehouseIds || warehouseIds.length === 0)) {
    throw new InventoryCatalogError("Ask the CEO to assign you a warehouse before adding or moving inventory.", 403);
  }

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) throw new InventoryCatalogError(parsed.error.issues[0]?.message ?? "Invalid inventory item.");
  const values = parsed.data;
  const { data, error } = await governanceAdmin
    .from("inventory_items")
    .insert({
      org_id: ctx.orgId,
      name: values.name,
      category: values.category,
      unit: values.unit,
      reorder_level: values.reorderLevel,
      unit_cost: values.unitCost,
    })
    .select("id,name,category,unit,reorder_level,unit_cost")
    .single();
  if (error) {
    if (error.code === "23505") throw new InventoryCatalogError("An inventory item with this name already exists.", 409);
    throw new InventoryCatalogError(error.message, error.code === "42501" ? 403 : 400);
  }

  await recordAuditEvent(ctx, {
    eventType: "inventory.catalogue_item.created",
    operation: "insert",
    entityTable: "inventory_items",
    entityId: String(data.id),
    reason: `Added ${data.name} to the inventory catalogue.`,
    after: data,
  });
  return { item: data };
}
