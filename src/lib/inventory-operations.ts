import "server-only";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";

import { type AccessContext, canAccessWarehouse, governanceAdmin } from "@/lib/access-context";
import { recordAuditEvent } from "@/lib/audit-ledger";
import { ensureFreshReconciliation } from "@/lib/reconciliation-service";
import { listInventoryWarehouses } from "@/lib/warehouse-management";

const categories = ["feed", "medicine", "vaccine", "vitamin", "supplement", "equipment", "spare_parts", "packaging", "miscellaneous"] as const;
const openingRow = z.object({
  name: z.string().trim().min(2).max(120), category: z.enum(categories), unit: z.string().trim().min(1).max(40),
  openingQuantity: z.number().finite().nonnegative(), unitCost: z.number().finite().nonnegative(), reorderLevel: z.number().finite().nonnegative(),
});
const openingInput = z.object({ warehouseId: z.string().uuid(), openedOn: z.string().date(), idempotencyKey: z.string().trim().min(8).max(160), rows: z.array(openingRow).min(1).max(150) });
const countInput = z.object({ warehouseId: z.string().uuid(), countedOn: z.string().date(), idempotencyKey: z.string().trim().min(8).max(160), notes: z.string().trim().max(500).nullable().optional(), rows: z.array(z.object({ itemId: z.string().uuid(), countedQuantity: z.number().finite().nonnegative() })).min(1).max(500) });
const receiptInput = z.object({
  warehouseId:z.string().uuid(), itemId:z.string().uuid().nullable().optional(),
  newItem:openingRow.pick({name:true,category:true,unit:true,reorderLevel:true}).nullable().optional(),
  quantity:z.number().finite().positive(), unitCost:z.number().finite().nonnegative(), transactionDate:z.string().date(),
  procurementType:z.enum(["monthly","emergency","miscellaneous"]), supplierName:z.string().trim().max(160).nullable().optional(),
  invoiceNumber:z.string().trim().max(120).nullable().optional(), notes:z.string().trim().max(500).nullable().optional(),
  idempotencyKey:z.string().trim().min(8).max(160),
}).refine(value=>Boolean(value.itemId)!==Boolean(value.newItem),"Choose either an existing item or enter one new item.");

export class InventoryOperationsError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

type Ledger = { item_id:string; warehouse_id:string; transaction_type:string; quantity:number; unit_cost:number|null; transaction_date:string; source_kind:string|null; source_key:string|null; reference_doc:string|null; notes:string|null };
type Item = { id:string; name:string; category:string; unit:string; reorder_level:number|null; unit_cost:number|null };

function delta(row: Pick<Ledger,"transaction_type"|"quantity">) {
  const quantity = Number(row.quantity);
  if (row.transaction_type === "issue" || row.transaction_type === "transfer_out") return -Math.abs(quantity);
  if (row.transaction_type === "adjustment") return quantity;
  return Math.abs(quantity);
}
function sourceLabel(kind:string|null, type:string) {
  if (kind === "feed_day_close") return "Feed day close";
  if (kind === "daily_record_usage") return "Daily supplies";
  if (kind === "health_treatment") return "Treatment";
  if (kind === "vaccination_completion") return "Vaccination";
  if (kind === "warehouse_opening_balance") return "Opening balance";
  if (type === "receipt") return "Purchase";
  if (type.startsWith("transfer")) return "Warehouse transfer";
  if (type === "return") return "Return";
  if (type === "adjustment") return "Approved correction";
  return type === "issue" ? "Stock use" : "Inventory movement";
}
function monthBounds(month:string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new InventoryOperationsError("Month must use YYYY-MM.");
  const start=`${month}-01`; const value=new Date(`${start}T00:00:00Z`); value.setUTCMonth(value.getUTCMonth()+1);
  return { start, next:value.toISOString().slice(0,10) };
}

export async function loadInventoryWorkspace(ctx:AccessContext, warehouseId:string|null, month:string) {
  if (!ctx.supportSessionId && ctx.role !== "ceo" && ctx.role !== "farm_manager") throw new InventoryOperationsError("Inventory access is not available for this role.",403);
  const warehouseData=await listInventoryWarehouses(ctx); const active=warehouseData.warehouses.filter(row=>row.status==="active");
  const selected=warehouseId ? active.find(row=>row.id===warehouseId) : active.length===1 ? active[0] : null;
  if (warehouseId && !selected) throw new InventoryOperationsError("The selected warehouse is inactive or outside your assignment.",403);
  const {start,next}=monthBounds(month);
  if (!selected) return { meta:{role:ctx.role,month,canOperate:ctx.role==="farm_manager"||Boolean(ctx.supportSessionId),canManage:ctx.role==="ceo",warehouseRequired:active.length>0}, warehouses:active, selectedWarehouse:null, catalogItems:[], items:[], movements:[], latestCountSession:null, expenses:[], recurringTemplates:[] };

  const db=governanceAdmin as any;
  const [itemsResult,ledgerResult,countsResult,sessionResult,costsResult,templatesResult,initializationResult]=await Promise.all([
    governanceAdmin.from("inventory_items").select("id,name,category,unit,reorder_level,unit_cost").eq("org_id",ctx.orgId).order("name"),
    governanceAdmin.from("stock_ledger").select("item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date,source_kind,source_key,reference_doc,notes").eq("org_id",ctx.orgId).eq("warehouse_id",selected.id).order("transaction_date",{ascending:false}).limit(20000),
    governanceAdmin.from("inventory_physical_counts").select("item_id,count_date,ledger_quantity,counted_quantity,variance,notes,created_at").eq("org_id",ctx.orgId).eq("warehouse_id",selected.id).order("count_date",{ascending:false}).limit(5000),
    db.from("inventory_count_sessions").select("id,count_month,counted_on,status,notes,created_at").eq("org_id",ctx.orgId).eq("warehouse_id",selected.id).order("count_month",{ascending:false}).limit(12),
    db.from("cost_entries").select("id,entry_date,entry_kind,category,description,amount,supplier_name,invoice_number,recurring_template_id,confirmation_month").eq("org_id",ctx.orgId).eq("warehouse_id",selected.id).gte("entry_date",start).lt("entry_date",next).order("entry_date",{ascending:false}),
    db.from("recurring_cost_templates").select("id,category,description,default_amount,supplier_name,is_active").eq("org_id",ctx.orgId).eq("warehouse_id",selected.id).eq("is_active",true).order("description"),
    db.from("warehouse_inventory_initializations").select("id,opened_on,row_count,created_at").eq("org_id",ctx.orgId).eq("warehouse_id",selected.id).maybeSingle(),
  ]);
  const failure=[itemsResult,ledgerResult,countsResult,sessionResult,costsResult,templatesResult,initializationResult].find(result=>result.error)?.error;
  if(failure) throw new InventoryOperationsError(failure.message,500);
  const items=(itemsResult.data??[]) as Item[]; const ledger=(ledgerResult.data??[]) as Ledger[];
  const latestCounts=new Map<string,any>(); for(const count of countsResult.data??[]) if(!latestCounts.has(String(count.item_id))) latestCounts.set(String(count.item_id),count);
  const stockRows=items.map(item=>{
    const rows=ledger.filter(row=>row.item_id===item.id); const before=rows.filter(row=>row.transaction_date<start).reduce((sum,row)=>sum+delta(row),0); const during=rows.filter(row=>row.transaction_date>=start&&row.transaction_date<next);
    const bucket=(test:(row:Ledger)=>boolean)=>during.filter(test).reduce((sum,row)=>sum+Math.abs(delta(row)),0);
    const current=rows.reduce((sum,row)=>sum+delta(row),0); const latest=latestCounts.get(item.id)??null;
    const received=bucket(row=>row.transaction_type==="receipt"||row.transaction_type==="opening_balance");
    const feed=bucket(row=>row.source_kind==="feed_day_close"); const daily=bucket(row=>row.source_kind==="daily_record_usage");
    const health=bucket(row=>row.source_kind==="health_treatment"); const vaccine=bucket(row=>row.source_kind==="vaccination_completion");
    const transfers=during.filter(row=>row.transaction_type.startsWith("transfer")||row.transaction_type==="adjustment"||row.transaction_type==="return").reduce((sum,row)=>sum+delta(row),0);
    return {...item,carriedOpening:before,received,feedUsage:feed,dailyUsage:daily,healthUsage:health,vaccineUsage:vaccine,transfersAndAdjustments:transfers,currentBalance:current,latestCount:latest?{date:latest.count_date,quantity:Number(latest.counted_quantity),variance:Number(latest.variance)}:null,reorderStatus:current<=0?"out":current<=Number(item.reorder_level??0)?"reorder":"healthy",stockValue:current*Number(item.unit_cost??0)};
  }).filter(row=>row.currentBalance!==0||ledger.some(entry=>entry.item_id===row.id));
  const movements=ledger.slice(0,40).map(row=>({...row,quantity:Number(row.quantity),displayQuantity:delta(row),sourceLabel:sourceLabel(row.source_kind,row.transaction_type),itemName:items.find(item=>item.id===row.item_id)?.name??"Inventory item"}));
  return {meta:{role:ctx.role,month,canOperate:ctx.role==="farm_manager"||Boolean(ctx.supportSessionId),canManage:ctx.role==="ceo",warehouseRequired:true},warehouses:active,selectedWarehouse:selected,initialization:initializationResult.data??null,catalogItems:items,items:stockRows,movements,latestCountSession:(sessionResult.data??[])[0]??null,expenses:costsResult.data??[],recurringTemplates:templatesResult.data??[]};
}

export async function establishOpeningStock(ctx:AccessContext,input:unknown){
  if(ctx.role!=="farm_manager"&&!ctx.supportSessionId)throw new InventoryOperationsError("Only a Farm Manager can establish opening stock.",403);
  const parsed=openingInput.safeParse(input);if(!parsed.success)throw new InventoryOperationsError(parsed.error.issues[0]?.message??"Opening stock is invalid.");
  if(!ctx.supportSessionId&&!await canAccessWarehouse(ctx,parsed.data.warehouseId))throw new InventoryOperationsError("An active warehouse assignment is required.",403);
  const {data,error}=await (governanceAdmin as any).rpc("initialize_warehouse_inventory",{p_actor_id:ctx.userId,p_warehouse_id:parsed.data.warehouseId,p_opened_on:parsed.data.openedOn,p_rows:parsed.data.rows,p_idempotency_key:parsed.data.idempotencyKey});
  if(error)throw new InventoryOperationsError(error.message,error.code==="42501"?403:error.code==="23505"?409:400);
  await recordAuditEvent(ctx,{eventType:"inventory.opening_stock.established",operation:"insert",entityTable:"warehouse_inventory_initializations",entityId:String(data.initialization_id),reason:"Established opening warehouse stock.",after:data,warehouseId:parsed.data.warehouseId});return data;
}

export async function submitMonthlyCount(ctx:AccessContext,input:unknown){
  if(ctx.role!=="farm_manager"&&!ctx.supportSessionId)throw new InventoryOperationsError("Only a Farm Manager can submit a monthly count.",403);
  const parsed=countInput.safeParse(input);if(!parsed.success)throw new InventoryOperationsError(parsed.error.issues[0]?.message??"Shelf count is invalid.");
  if(!ctx.supportSessionId&&!await canAccessWarehouse(ctx,parsed.data.warehouseId))throw new InventoryOperationsError("An active warehouse assignment is required.",403);
  const {data,error}=await (governanceAdmin as any).rpc("record_inventory_count_session",{p_actor_id:ctx.userId,p_warehouse_id:parsed.data.warehouseId,p_counted_on:parsed.data.countedOn,p_rows:parsed.data.rows,p_notes:parsed.data.notes??null,p_idempotency_key:parsed.data.idempotencyKey});
  if(error)throw new InventoryOperationsError(error.message,error.code==="42501"?403:error.code==="23505"?409:400);
  await recordAuditEvent(ctx,{eventType:"inventory.monthly_count.submitted",operation:"insert",entityTable:"inventory_count_sessions",entityId:String(data.session_id),reason:parsed.data.notes??"Submitted the complete warehouse shelf count.",after:data,warehouseId:parsed.data.warehouseId});
  await ensureFreshReconciliation(ctx,true); return data;
}

export async function receiveInventoryStock(ctx:AccessContext,input:unknown){
  if(ctx.role!=="farm_manager"&&!ctx.supportSessionId)throw new InventoryOperationsError("Only a Farm Manager can receive stock.",403);
  const parsed=receiptInput.safeParse(input);if(!parsed.success)throw new InventoryOperationsError(parsed.error.issues[0]?.message??"The stock receipt is invalid.");
  if(!ctx.supportSessionId&&!await canAccessWarehouse(ctx,parsed.data.warehouseId))throw new InventoryOperationsError("An active warehouse assignment is required.",403);
  const value=parsed.data;
  const {data,error}=await (governanceAdmin as any).rpc("receive_inventory_stock",{
    p_actor_id:ctx.userId,p_warehouse_id:value.warehouseId,p_item_id:value.itemId??null,p_new_item:value.newItem??null,
    p_quantity:value.quantity,p_unit_cost:value.unitCost,p_transaction_date:value.transactionDate,p_procurement_type:value.procurementType,
    p_supplier_name:value.supplierName??null,p_invoice_number:value.invoiceNumber??null,p_notes:value.notes??null,p_idempotency_key:value.idempotencyKey,
  });
  if(error)throw new InventoryOperationsError(error.message,error.code==="42501"?403:error.code==="23505"?409:400);
  await recordAuditEvent(ctx,{eventType:"inventory.stock.received",operation:"insert",entityTable:"stock_ledger",entityId:String(data.movement_id),reason:`Received stock into the assigned warehouse${value.invoiceNumber?` against ${value.invoiceNumber}`:""}.`,after:data,warehouseId:value.warehouseId});
  return data;
}
