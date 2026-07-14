import { NextRequest } from "next/server";

import { getSalesContext, json, supabaseAdmin } from "@/lib/sales";

const VALID_TRANSACTION_TYPES = new Set(["receipt", "issue", "return", "adjustment", "transfer"]);
const VALID_PROCUREMENT_TYPES = new Set(["monthly", "emergency", "miscellaneous"]);

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberFrom(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function errorStatus(code: string | undefined) {
  if (code === "42501") return 403;
  if (code === "22023" || code === "22P02" || code === "23503" || code === "23514") return 400;
  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!["store_keeper", "farm_manager", "ceo", "system_admin", "super_admin"].includes(ctx.role)) {
      return json({ error: "You do not have access to record stock movements." }, 403);
    }

    const body = await request.json();
    const itemId = cleanText(body.item_id);
    const warehouseId = cleanText(body.warehouse_id);
    const transactionType = cleanText(body.transaction_type);
    const destinationWarehouseId = cleanText(body.destination_warehouse_id);
    const procurementType = cleanText(body.procurement_type);
    const quantity = numberFrom(body.quantity);

    if (!itemId) return json({ error: "Select an inventory item." }, 400);
    if (!warehouseId) return json({ error: "Select a source warehouse." }, 400);
    if (!transactionType || !VALID_TRANSACTION_TYPES.has(transactionType)) {
      return json({ error: "Select a valid stock transaction type." }, 400);
    }
    if (quantity === 0 || (transactionType !== "adjustment" && quantity < 0)) {
      return json({ error: "Quantity must be greater than zero; adjustments may be positive or negative." }, 400);
    }
    if (transactionType === "transfer" && !destinationWarehouseId) {
      return json({ error: "Select a destination warehouse for the transfer." }, 400);
    }
    if (transactionType === "receipt" && (!procurementType || !VALID_PROCUREMENT_TYPES.has(procurementType))) {
      return json({ error: "Select monthly, emergency, or miscellaneous procurement." }, 400);
    }

    const { data, error } = await supabaseAdmin.rpc("record_inventory_movement", {
      p_actor_id: ctx.userId,
      p_item_id: itemId,
      p_warehouse_id: warehouseId,
      p_transaction_type: transactionType,
      p_quantity: quantity,
      p_unit_cost: numberFrom(body.unit_cost),
      p_transaction_date: cleanText(body.transaction_date) ?? new Date().toISOString().slice(0, 10),
      p_destination_warehouse_id: destinationWarehouseId,
      p_branch_id: cleanText(body.branch_id),
      p_farm_id: cleanText(body.farm_id),
      p_house_id: cleanText(body.house_id),
      p_flock_id: cleanText(body.flock_id),
      p_batch_id: cleanText(body.batch_id),
      p_procurement_type: transactionType === "receipt" ? procurementType : null,
      p_supplier_name: cleanText(body.supplier_name),
      p_invoice_number: cleanText(body.invoice_number),
      p_reference_doc: cleanText(body.reference_doc) ?? cleanText(body.invoice_number),
      p_notes: cleanText(body.notes),
    });

    if (error) return json({ error: error.message }, errorStatus(error.code));
    return json({ movement: data }, 201);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
