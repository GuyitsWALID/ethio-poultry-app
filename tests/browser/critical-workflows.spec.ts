import { expect, test, type APIResponse, type Page } from "@playwright/test";

type Credentials = { email: string; password: string };
type RuntimeMonitor = { assertClean: () => void };

const required = process.env.E2E_REQUIRE_ROLE_CREDENTIALS === "true";

function credentials(prefix: "CEO" | "FARM_MANAGER"): Credentials | null {
  const email = process.env[`E2E_${prefix}_EMAIL`]?.trim();
  const password = process.env[`E2E_${prefix}_PASSWORD`]?.trim();
  return email && password ? { email, password } : null;
}

const ceo = credentials("CEO");
const farmManager = credentials("FARM_MANAGER");

if (required) {
  const missing = [
    !ceo && "E2E_CEO_EMAIL/E2E_CEO_PASSWORD",
    !farmManager && "E2E_FARM_MANAGER_EMAIL/E2E_FARM_MANAGER_PASSWORD",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Required critical-workflow credentials are missing: ${missing.join(", ")}`);
}

async function tenantLogin(page: Page, account: Credentials) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/(ceo|farm-manager)/);
}

function monitorRuntime(page: Page): RuntimeMonitor {
  const failures: string[] = [];

  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console error: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    const isApplicationApi = url.pathname.startsWith("/api/");
    const isSupabaseRest = url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/rest/v1/");
    if (isApplicationApi || isSupabaseRest) failures.push(`${response.status()} ${url.pathname}`);
  });

  return {
    assertClean: () => expect(failures, failures.join("\n")).toEqual([]),
  };
}

async function expectOk(response: APIResponse) {
  expect(response.status(), response.url()).toBe(200);
}

async function settle(page: Page) {
  await page.waitForTimeout(750);
}

test.describe("Farm Manager critical workflows", () => {
  test.skip(!farmManager, "Set E2E Farm Manager credentials to run critical workflows.");

  test.beforeEach(async ({ page }) => {
    await tenantLogin(page, farmManager!);
  });

  test("warehouse inventory loads assigned stock and its governed job forms", async ({ page }) => {
    const runtime = monitorRuntime(page);
    await page.goto("/app/inventory");
    await expect(page.getByRole("heading", { name: /Know what is on the shelf/i })).toBeVisible();

    const catalogResponse = await page.request.get("/api/inventory/catalog");
    const warehousesResponse = await page.request.get("/api/inventory/warehouses");
    await expectOk(catalogResponse);
    await expectOk(warehousesResponse);
    expect((await catalogResponse.json()).items).toEqual(expect.any(Array));
    const assignedWarehouses = (await warehousesResponse.json()).warehouses as unknown[];
    expect(assignedWarehouses).toEqual(expect.any(Array));

    const warehouse = page.getByLabel("Working warehouse");
    await expect(warehouse).toBeVisible();
    if (assignedWarehouses.length) {
      await expect.poll(async () => warehouse.locator("option").count()).toBeGreaterThan(1);
      if (!(await warehouse.inputValue())) await warehouse.selectOption({ index: 1 });
      await expect(page.getByRole("heading", { name: "Current stock and automatic usage" })).toBeVisible();
      await page.getByRole("button", { name: /Receive stock/i }).click();
      await expect(page.getByRole("heading", { name: /Receive stock into/i })).toBeVisible();
      await expect(page.getByRole("button", { name: "New item" })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "No active warehouse is assigned" })).toBeVisible();
      await expect(warehouse.locator("option")).toHaveCount(1);
    }
    runtime.assertClean();
  });

  test("daily, feed, and health workspaces load their governed operational options", async ({ page }) => {
    const runtime = monitorRuntime(page);

    await page.goto("/app/daily-records");
    await expect(page.getByRole("heading", { name: /Close the day with a record you can trust/i })).toBeVisible();
    await expectOk(await page.request.get("/api/inventory/catalog"));
    await expectOk(await page.request.get("/api/inventory/warehouses"));

    await page.goto("/app/feeding-log");
    await expect(page.getByRole("heading", { name: /Feed Control|No active batch is available/i })).toBeVisible();

    await page.goto("/app/health");
    await expect(page.getByRole("heading", { name: /Keep every preventive action on the runway/i })).toBeVisible();
    await expectOk(await page.request.get("/api/health/events"));
    await page.getByRole("button", { name: "Record treatment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record illness treatment" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Warehouse")).toBeVisible();
    await expect(dialog.getByLabel("Medicine")).toBeVisible();
    runtime.assertClean();
  });

  test("sales entry derives branch and exposes scoped farm lineage selectors", async ({ page }) => {
    const runtime = monitorRuntime(page);
    await page.goto("/app/sales");
    await expect(page.getByRole("heading", { name: /Turn every sale into collected cash/i })).toBeVisible();
    await expectOk(await page.request.get("/api/sales/records"));
    await expectOk(await page.request.get("/api/sales/analytics"));

    await page.getByRole("button", { name: "Record today's sale" }).click();
    const dialog = page.getByRole("dialog", { name: "Record a new sale" });
    await expect(dialog).toBeVisible();
    for (const label of ["Farm", "House", "Flock", "Batch"]) {
      await expect(dialog.locator("label").filter({ hasText: new RegExp(`^${label}`) }).first()).toBeVisible();
    }
    await expect(dialog.locator("label").filter({ hasText: /^Branch/ })).toHaveCount(0);
    await expect(dialog.getByText(/Branch is derived automatically/i)).toBeVisible();
    runtime.assertClean();
  });

  test("flock and batch lifecycle data cannot silently collapse into an empty workspace", async ({ page }) => {
    const runtime = monitorRuntime(page);
    await page.goto("/app/flocks");
    await expect(page.getByRole("heading", { name: "Flocks & batches", level: 1 }).first()).toBeVisible();
    await expectOk(await page.request.get("/api/flocks/workspace"));
    await expect(page.getByRole("heading", { name: "Batch-to-flock lineage" })).toBeVisible();
    await page.getByRole("button", { name: "Flock registry" }).click();
    await expect(page.getByRole("heading", { name: "Flock registry" })).toBeVisible();
    runtime.assertClean();
  });

  test("governance and Record Checks load readable, actionable review queues", async ({ page }) => {
    const runtime = monitorRuntime(page);
    await page.goto("/app/governance");
    await expect(page.getByRole("heading", { name: /Approve the reason, then correct the exact record once/i })).toBeVisible();
    await expectOk(await page.request.get("/api/governance/desk"));
    const auditResponse = await page.request.get("/api/governance/audit");
    await expectOk(auditResponse);
    const audit = await auditResponse.json();
    expect(audit.integrity).toBeNull();
    expect(audit.events).toEqual(expect.any(Array));
    expect(JSON.stringify(audit.events)).not.toMatch(/event_hash|entity_id|before_values|after_values/);
    await expect(page.getByRole("button", { name: "Refresh desk" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Permanent change history" })).toBeVisible();

    const reconciliationResponse = await page.request.get("/api/reconciliation");
    if (reconciliationResponse.status() === 200) {
      await page.goto("/app/reconciliation");
      await expect(page.getByRole("heading", { name: /See what does not agree/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /item(s)? in this view/i })).toBeVisible();
    } else {
      expect(reconciliationResponse.status(), "An unassigned Farm Manager must be denied without a server error.").toBe(403);
    }
    runtime.assertClean();
  });
});

test.describe("CEO oversight workflows", () => {
  test.skip(!ceo, "Set E2E CEO credentials to run executive workflow coverage.");

  test("CEO can inspect governance, inventory oversight, and Record Checks without mutation controls", async ({ page }) => {
    await tenantLogin(page, ceo!);
    const runtime = monitorRuntime(page);

    await page.goto("/app/governance");
    await expect(page.getByRole("heading", { name: /Approve the reason, then correct the exact record once/i })).toBeVisible();
    await expectOk(await page.request.get("/api/governance/desk"));
    const auditResponse = await page.request.get("/api/governance/audit");
    await expectOk(auditResponse);
    const audit = await auditResponse.json();
    expect(audit.integrity).toMatchObject({ valid: true });
    expect(audit.events).toEqual(expect.any(Array));
    expect(JSON.stringify(audit.events)).not.toMatch(/event_hash|entity_id|before_values|after_values/);
    await expect(page.getByRole("heading", { name: "Permanent change history" })).toBeVisible();
    await expect(page.getByText("History verified", { exact: true })).toBeVisible();

    await page.goto("/app/inventory");
    await expect(page.getByRole("heading", { name: /Know what is on the shelf/i })).toBeVisible();
    const warehousesResponse = await page.request.get("/api/inventory/warehouses");
    await expectOk(warehousesResponse);
    const warehouses = (await warehousesResponse.json()).warehouses as unknown[];
    expect(warehouses).toEqual(expect.any(Array));
    if (warehouses.length) {
      await expect.poll(async () => page.getByLabel("Working warehouse").locator("option").count()).toBeGreaterThan(1);
    } else {
      await expect(page.getByRole("heading", { name: "No active warehouse is assigned" })).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Inventory jobs" })).toHaveCount(0);

    await page.goto("/app/reconciliation");
    await expect(page.getByRole("heading", { name: /See what does not agree/i })).toBeVisible();
    await expectOk(await page.request.get("/api/reconciliation"));
    await settle(page);
    runtime.assertClean();
  });
});
