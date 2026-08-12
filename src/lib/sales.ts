import { createClient } from "@supabase/supabase-js";

import { hasCapability } from "@/lib/permissions";
import { type AppRole } from "@/lib/roles";
import { getAccessContext,isAccessResponse } from "@/lib/access-context";
import type { Database } from "@/types/supabase";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export type SalesContext = {
  userId: string;
  orgId: string;
  role: AppRole;
  canView: boolean;
  canMutate: boolean;
  allowedFarmIds: Set<string>;
  supportSessionId:string|null;
};

export type DailySalesRecord = {
  id: string;
  org_id: string;
  branch_id: string | null;
  farm_id: string | null;
  house_id: string | null;
  flock_id: string | null;
  batch_id: string | null;
  sale_date: string;
  product_category: "egg" | "bird" | "training" | "equipment_medicine" | "consultancy" | "package";
  product_label: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gross_amount: number;
  paid_amount: number;
  balance_due: number;
  payment_method: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

type FarmRow = Pick<Database["public"]["Tables"]["farms"]["Row"], "id" | "branch_id" | "org_id">;
type HouseRow = Pick<Database["public"]["Tables"]["houses"]["Row"], "id" | "farm_id" | "branch_id" | "org_id">;
type FlockRow = Pick<Database["public"]["Tables"]["flocks"]["Row"], "id" | "farm_id" | "house_id" | "org_id" | "batch_id">;
type BatchRow = Pick<
  Database["public"]["Tables"]["batches"]["Row"],
  "id" | "branch_id" | "farm_id" | "house_id" | "org_id"
>;

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

export async function getSalesContext(): Promise<SalesContext | Response> {
  const access=await getAccessContext({tenant:true});if(isAccessResponse(access))return access;const role=access.role;const support=Boolean(access.supportSessionId);
  if (!support&&!hasCapability(role, "tenant:view")) return json({ error: "Sales access is required." }, 403);
  const now = new Date().toISOString();
  const farmAccessRes = role === "farm_manager"
    ? await supabaseAdmin.from("user_farm_access").select("farm_id").eq("profile_id", access.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`)
    : support?await supabaseAdmin.from("farms").select("id").eq("org_id",access.orgId):{ data: [] };

  return {
    userId: access.userId,
    orgId: access.orgId,
    role,
    canView: support||hasCapability(role, "tenant:view"),
    canMutate: support||hasCapability(role, "farm:operate"),
    allowedFarmIds: new Set((farmAccessRes.data ?? []).map((row) => "farm_id" in row?row.farm_id:row.id)),
    supportSessionId:access.supportSessionId,
  };
}

export function hasScopedAccess(ctx: SalesContext, record: { branch_id?: string | null; farm_id?: string | null }) {
  if (ctx.role !== "farm_manager") return true;
  if (ctx.allowedFarmIds.size === 0) return false;
  return Boolean(record.farm_id && ctx.allowedFarmIds.has(record.farm_id));
}

export async function resolveSaleScope(
  ctx: SalesContext,
  input: {
    branch_id?: string | null;
    farm_id?: string | null;
    house_id?: string | null;
    flock_id?: string | null;
    batch_id?: string | null;
    require_farm?: boolean;
  }
) {
  let branchId = input.branch_id || null;
  let farmId = input.farm_id || null;
  let houseId = input.house_id || null;
  const flockId = input.flock_id || null;
  const batchId = input.batch_id || null;

  if (batchId) {
    const { data } = await supabaseAdmin
      .from("batches")
      .select("id, branch_id, farm_id, house_id, org_id")
      .eq("id", batchId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (!data) return { error: "Batch is not available in this organization." };
    const batch = data as BatchRow;
    branchId = batch.branch_id;
    farmId = farmId ?? batch.farm_id;
    houseId = houseId ?? batch.house_id;
  }

  if (flockId) {
    const { data } = await supabaseAdmin
      .from("flocks")
      .select("id, farm_id, house_id, org_id, batch_id")
      .eq("id", flockId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (!data) return { error: "Flock is not available in this organization." };
    const flock = data as FlockRow;
    if (batchId && flock.batch_id !== batchId) return { error: "Flock is not linked to the selected batch." };
    farmId = flock.farm_id;
    houseId = flock.house_id;
  }

  if (houseId) {
    const { data } = await supabaseAdmin
      .from("houses")
      .select("id, farm_id, branch_id, org_id")
      .eq("id", houseId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (!data) return { error: "House is not available in this organization." };
    const house = data as HouseRow;
    farmId = house.farm_id;
    branchId = house.branch_id;
  }

  if (farmId) {
    const { data } = await supabaseAdmin
      .from("farms")
      .select("id, branch_id, org_id")
      .eq("id", farmId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (!data) return { error: "Farm is not available in this organization." };
    const farm = data as FarmRow;
    branchId = farm.branch_id;
  }

  if (!farmId && input.require_farm !== false) return { error: "Select at least a farm, flock, or batch for poultry sales." };
  if (!farmId && branchId) {
    const { data } = await supabaseAdmin.from("branches").select("id, org_id").eq("id", branchId).eq("org_id", ctx.orgId).maybeSingle();
    if (!data) return { error: "Branch is not available in this organization." };
  }
  if (!farmId) return { branch_id: branchId, farm_id: null, house_id: null, flock_id: null, batch_id: null };
  if (!hasScopedAccess(ctx, { branch_id: branchId, farm_id: farmId })) {
    return { error: "You do not have access to record sales for this scope." };
  }

  return { branch_id: branchId, farm_id: farmId, house_id: houseId, flock_id: flockId, batch_id: batchId };
}

export function applySalesFilters<T extends { sale_date: string; product_category: string; branch_id: string | null; farm_id: string | null; house_id: string | null; flock_id: string | null; batch_id: string | null }>(
  rows: T[],
  params: URLSearchParams
) {
  const from = params.get("date_from");
  const to = params.get("date_to");
  const productCategory = params.get("product_category");
  const branchId = params.get("branch_id");
  const farmId = params.get("farm_id");
  const houseId = params.get("house_id");
  const flockId = params.get("flock_id");
  const batchId = params.get("batch_id");

  return rows.filter((row) => {
    if (from && row.sale_date < from) return false;
    if (to && row.sale_date > to) return false;
    if (productCategory && row.product_category !== productCategory) return false;
    if (branchId && row.branch_id !== branchId) return false;
    if (farmId && row.farm_id !== farmId) return false;
    if (houseId && row.house_id !== houseId) return false;
    if (flockId && row.flock_id !== flockId) return false;
    if (batchId && row.batch_id !== batchId) return false;
    return true;
  });
}

export function periodKey(date: string, period: "day" | "week" | "month" | "quarter") {
  const parsed = new Date(`${date}T00:00:00Z`);
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  if (period === "day") return date;
  if (period === "month") return `${year}-${String(month).padStart(2, "0")}`;
  if (period === "quarter") return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;

  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return parsed.toISOString().slice(0, 10);
}
