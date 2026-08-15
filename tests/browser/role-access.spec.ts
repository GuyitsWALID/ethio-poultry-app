import { expect, test, type Page } from "@playwright/test";

type Credentials = { email: string; password: string };
const required = process.env.E2E_REQUIRE_ROLE_CREDENTIALS === "true";

function credentials(prefix: "CEO" | "FARM_MANAGER" | "SYSTEM_ADMIN"): Credentials | null {
  const email = process.env[`E2E_${prefix}_EMAIL`]?.trim();
  const password = process.env[`E2E_${prefix}_PASSWORD`]?.trim();
  return email && password ? { email, password } : null;
}

const ceo = credentials("CEO");
const farmManager = credentials("FARM_MANAGER");
const systemAdmin = credentials("SYSTEM_ADMIN");
const adminCode = process.env.E2E_ADMIN_ACCESS_CODE?.trim();

if (required) {
  const missing = [
    !ceo && "E2E_CEO_EMAIL/E2E_CEO_PASSWORD",
    !farmManager && "E2E_FARM_MANAGER_EMAIL/E2E_FARM_MANAGER_PASSWORD",
    !systemAdmin && "E2E_SYSTEM_ADMIN_EMAIL/E2E_SYSTEM_ADMIN_PASSWORD",
    !adminCode && "E2E_ADMIN_ACCESS_CODE",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Required role browser credentials are missing: ${missing.join(", ")}`);
}

async function tenantLogin(page: Page, account: Credentials) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("anonymous users are denied application and API access", async ({ page }) => {
  const contextResponse = await page.request.get("/api/me/context");
  expect(contextResponse.status()).toBe(401);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test.describe("CEO authorization journey", () => {
  test.skip(!ceo, "Set E2E CEO credentials to run this role journey.");

  test("CEO sees oversight but cannot perform routine farm entry", async ({ page }) => {
    await tenantLogin(page, ceo!);
    await expect(page).toHaveURL(/\/app\/ceo/);
    await expect(page.getByRole("heading", { name: /See the whole operation/i })).toBeVisible();

    expect((await page.request.get("/api/ceo/dashboard")).status()).toBe(200);
    const routineMutation = await page.request.post("/api/inventory/daily-usage", {
      data: { flock_id: "not-used", record: {} },
    });
    expect(routineMutation.status()).toBe(403);
    expect((await page.request.get("/api/admin/overview")).status()).toBe(403);
  });
});

test.describe("Farm Manager authorization journey", () => {
  test.skip(!farmManager, "Set E2E Farm Manager credentials to run this role journey.");

  test("Farm Manager sees assigned operations and is denied executive governance", async ({ page }) => {
    await tenantLogin(page, farmManager!);
    await expect(page).toHaveURL(/\/app\/farm-manager/);
    await expect(page.getByRole("heading", { name: "Production control room" })).toBeVisible();

    expect((await page.request.get("/api/farm-manager/dashboard")).status()).toBe(200);
    expect((await page.request.get("/api/ceo/dashboard")).status()).toBe(403);
    expect((await page.request.post("/api/governance/assignments", { data: {} })).status()).toBe(403);
  });
});

test.describe("System Administrator authorization journey", () => {
  test.skip(!systemAdmin || !adminCode, "Set E2E System Administrator credentials and gate code to run this role journey.");

  test("System Administrator stays in the platform console without tenant access", async ({ page }) => {
    const gate = await page.request.post("/api/admin/gate", { data: { code: adminCode } });
    expect(gate.status()).toBe(200);
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(systemAdmin!.email);
    await page.getByLabel("Password").fill(systemAdmin!.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole("heading", { name: "Organization onboarding" })).toBeVisible();

    expect((await page.request.get("/api/admin/overview")).status()).toBe(200);
    expect((await page.request.get("/api/ceo/dashboard")).status()).toBe(403);
    await page.goto("/app/ceo");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });
});
