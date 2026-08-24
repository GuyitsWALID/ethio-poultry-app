import { NextRequest } from "next/server";

import { getSalesContext, json, supabaseAdmin } from "@/lib/sales";
import { governanceAdmin } from "@/lib/access-context";

const VALID_TRANSACTION_TYPES = new Set(["issue", "return", "adjustment", "transfer"]);

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
    if (!ctx.canMutate) {
      return json({ error: "You do not have access to record stock movements." }, 403);
    }

    const body = await request.json();
    const itemId = cleanText(body.item_id);
    const warehouseId = cleanText(body.warehouse_id);
    const transactionType = cleanText(body.transaction_type);
    const destinationWarehouseId = cleanText(body.destination_warehouse_id);
    const quantity = numberFrom(body.quantity);

    if (!itemId) return json({ error: "Select an inventory item." }, 400);
    if (!warehouseId) return json({ error: "Select a source warehouse." }, 400);
    const activeWarehouse=async(id:string)=>{const {data}=await governanceAdmin.from("warehouses").select("id").eq("id",id).eq("org_id",ctx.orgId).eq("status","active").maybeSingle();return Boolean(data)};
    if(!await activeWarehouse(warehouseId))return json({error:"The source warehouse is inactive or outside this organization."},400);
    const now=new Date().toISOString();const assigned=async(id:string)=>{if(ctx.supportSessionId)return true;const {data}=await governanceAdmin.from("user_warehouse_access").select("id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).eq("warehouse_id",id).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();return Boolean(data)};
    if(!await assigned(warehouseId))return json({error:"An active assignment to the source warehouse is required."},403);
    if (!transactionType || !VALID_TRANSACTION_TYPES.has(transactionType)) {
      return json({ error: "Select a valid stock transaction type." }, 400);
    }
    if (quantity === 0 || (transactionType !== "adjustment" && quantity < 0)) {
      return json({ error: "Quantity must be greater than zero; adjustments may be positive or negative." }, 400);
    }
    if (transactionType === "transfer" && !destinationWarehouseId) {
      return json({ error: "Select a destination warehouse for the transfer." }, 400);
    }
    if(transactionType==="transfer"&&destinationWarehouseId&&!await assigned(destinationWarehouseId))return json({error:"An active assignment to the destination warehouse is required."},403);
    if(transactionType==="transfer"&&destinationWarehouseId&&!await activeWarehouse(destinationWarehouseId))return json({error:"The destination warehouse is inactive or outside this organization."},400);
    const idempotencyKey=cleanText(body.idempotency_key);
    if(!idempotencyKey)return json({error:"A stock action request identity is required."},400);
    const { data, error } = await supabaseAdmin.rpc("record_assigned_inventory_movement", {
      p_actor_id: ctx.userId,
      p_item_id: itemId,
      p_warehouse_id: warehouseId,
      p_transaction_type: transactionType,
      p_quantity: quantity,
      p_unit_cost: numberFrom(body.unit_cost),
      p_transaction_date: cleanText(body.transaction_date) ?? new Date().toISOString().slice(0, 10),
      p_destination_warehouse_id: destinationWarehouseId,
      p_notes: cleanText(body.notes),
      p_idempotency_key:idempotencyKey,
    });

    if (error) return json({ error: error.message }, errorStatus(error.code));
    return json({ movement: data }, 201);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
