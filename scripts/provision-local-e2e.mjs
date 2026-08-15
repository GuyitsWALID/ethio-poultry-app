import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const password = process.env.LOCAL_E2E_PASSWORD?.trim();
if (!url || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(url)) {
  throw new Error("Local browser fixtures may only be provisioned against localhost Supabase.");
}
if (!serviceKey || !password || password.length < 12) {
  throw new Error("Local service key and LOCAL_E2E_PASSWORD (minimum 12 characters) are required.");
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const orgId = "12000000-0000-4000-8000-000000000001";
const branchId = "12000000-0000-4000-8000-000000000002";
const farmId = "12000000-0000-4000-8000-000000000003";
const houseId = "12000000-0000-4000-8000-000000000004";
const warehouseId = "12000000-0000-4000-8000-000000000005";
const accounts = [
  { key: "CEO", email: "item1-ceo@local.test", name: "Item 1 CEO", role: "ceo" },
  { key: "FARM_MANAGER", email: "item1-farm-manager@local.test", name: "Item 1 Farm Manager", role: "farm_manager" },
  { key: "SYSTEM_ADMIN", email: "item1-system-admin@local.test", name: "Item 1 System Administrator", role: "system_admin" },
];

async function must(operation, label) {
  const result = await operation;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

await must(admin.from("organizations").upsert({ id: orgId, name: "Item 1 Browser Test Organization" }), "organization");
await must(admin.from("branches").upsert({ id: branchId, org_id: orgId, name: "Item 1 Branch" }), "branch");
await must(admin.from("farms").upsert({ id: farmId, org_id: orgId, branch_id: branchId, name: "Item 1 Farm" }), "farm");
await must(admin.from("houses").upsert({ id: houseId, org_id: orgId, branch_id: branchId, farm_id: farmId, name: "Item 1 House", house_type: "layer" }), "house");
await must(admin.from("warehouses").upsert({ id: warehouseId, org_id: orgId, branch_id: branchId, farm_id: farmId, name: "Item 1 Warehouse", type: "farm_store", status: "active" }), "warehouse");

const listed = await must(admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), "list local users");
for (const account of accounts) {
  let user = listed.users.find((candidate) => candidate.email?.toLowerCase() === account.email);
  if (!user) {
    const created = await must(admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { role: account.role, full_name: account.name },
      app_metadata: { role: account.role },
    }), `create ${account.role}`);
    user = created.user;
  } else {
    await must(admin.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: { role: account.role, full_name: account.name },
      app_metadata: { role: account.role },
    }), `refresh ${account.role}`);
  }
  await must(admin.from("profiles").upsert({ id: user.id, org_id: orgId, full_name: account.name, role: account.role, is_active: true }), `${account.role} profile`);
  account.userId = user.id;
}

const manager = accounts.find((account) => account.role === "farm_manager");
const { data: farmAssignment } = await admin.from("user_farm_access").select("id").eq("org_id", orgId).eq("profile_id", manager.userId).eq("farm_id", farmId).maybeSingle();
if (!farmAssignment) await must(admin.from("user_farm_access").insert({ org_id: orgId, profile_id: manager.userId, farm_id: farmId, starts_at: new Date(Date.now() - 60_000).toISOString() }), "farm assignment");
const { data: warehouseAssignment } = await admin.from("user_warehouse_access").select("id").eq("org_id", orgId).eq("profile_id", manager.userId).eq("warehouse_id", warehouseId).maybeSingle();
if (!warehouseAssignment) await must(admin.from("user_warehouse_access").insert({ org_id: orgId, profile_id: manager.userId, warehouse_id: warehouseId, starts_at: new Date(Date.now() - 60_000).toISOString() }), "warehouse assignment");

console.log("Local browser fixtures are ready.");
for (const account of accounts) console.log(`E2E_${account.key}_EMAIL=${account.email}`);
