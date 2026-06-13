import { createClient } from "@supabase/supabase-js";

import { normalizeRole, type AppRole } from "@/lib/roles";
import type { Database } from "@/types/supabase";
import { createClient as createAuthedClient } from "@/utils/supabase/server";

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
  allowedBranchIds: Set<string>;
  allowedFarmIds: Set<string>;
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
  product_category: "egg" | "bird";
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
  const supabase = await createAuthedClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!profile?.org_id) return json({ error: "Profile is missing organization access." }, 403);

  const role = normalizeRole(profile.role);
  const [branchAccessRes, farmAccessRes] =
    role === "farm_manager"
      ? await Promise.all([
          supabaseAdmin.from("user_branch_access").select("branch_id").eq("profile_id", user.id),
          supabaseAdmin.from("user_farm_access").select("farm_id").eq("profile_id", user.id),
        ])
      : [{ data: [] }, { data: [] }];

  return {
    userId: user.id,
    orgId: profile.org_id,
    role,
    canView: ["ceo", "system_admin", "super_admin", "store_keeper", "farm_manager"].includes(role),
    canMutate: role === "farm_manager",
    allowedBranchIds: new Set((branchAccessRes.data ?? []).map((row) => row.branch_id)),
    allowedFarmIds: new Set((farmAccessRes.data ?? []).map((row) => row.farm_id)),
  };
}

export function hasScopedAccess(ctx: SalesContext, record: { branch_id?: string | null; farm_id?: string | null }) {
  if (ctx.role !== "farm_manager") return true;
  if (ctx.allowedBranchIds.size + ctx.allowedFarmIds.size === 0) return false;
  return Boolean(
    (record.farm_id && ctx.allowedFarmIds.has(record.farm_id)) ||
      (record.branch_id && ctx.allowedBranchIds.has(record.branch_id))
  );
}

export async function resolveSaleScope(
  ctx: SalesContext,
  input: {
    branch_id?: string | null;
    farm_id?: string | null;
    house_id?: string | null;
    flock_id?: string | null;
    batch_id?: string | null;
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

  if (!farmId) return { error: "Select at least a farm, flock, or batch for the sale." };
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
