import {expect, test} from "@playwright/test";
import {presentReport, type ReportSection} from "../../src/lib/report-workspace";

const email = process.env.E2E_CEO_EMAIL;
const password = process.env.E2E_CEO_PASSWORD;
if (process.env.E2E_REQUIRE_ROLE_CREDENTIALS === "true" && (!email || !password)) throw new Error("CEO browser credentials required");
test.skip(!email || !password, "CEO browser credentials required");

for (const viewport of [{width: 768, height: 1024}, {width: 1024, height: 768}]) {
  test(`Reports read-only sections and localization ${viewport.width}x${viewport.height}`, async ({page}) => {
    // Local Next dev compiles the authenticated routes on first navigation.
    // Allow compilation time without changing assertion/retry timeouts.
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/ceo/, {timeout: 60_000});
    // Browser layout uses real authentication; deterministic reader fixtures
    // isolate presentation. These checks are not live database authorization tests.
    await page.route("**/api/operations-analytics?**", route => route.fulfill({json: {summary: {current: {eggs: 12345, hdep: 91.7, marketableRate: 98, recordCoveragePct: 100}}, farms: [{name: "Pilot farm", hdep: 91.7, feedPerBirdGrams: 110, recordCoveragePct: 100}]}}));
    await page.route("**/api/mortality/dashboard?**", route => route.fulfill({json: {summary: {officialDeaths: 7, mortalityPerThousand: .15, unexplainedDeaths: 0}, dataTrust: {coveragePct: 100}, causes: [{cause: "Heat stress", deaths: 7}]}}));
    await page.route("**/api/sales/analytics?**", route => route.fulfill({json: {kpis: {revenue: 54321, paid: 53000, balanceDue: 1321, estimatedProfit: 4000, marginStatus: "estimated"}, charts: {daily: []}}}));
    await page.route("**/api/reports/evidence?**", route => route.fulfill({json: {dateFrom: "2026-09-01", dateTo: "2026-09-30", expenseTotal: 1250, items: new URL(route.request().url()).searchParams.get("section") === "health" ? [{kind: "treatment", label: "Vet review", date: "2026-09-20", context: "Pilot flock"}, {kind: "vaccination", label: "Newcastle", date: "2026-09-21", context: "Pilot flock"}] : [{kind: "expense", label: "Transport", date: "2026-09-20", context: "Pilot farm", amount: 1250}, {kind: "period", label: "", date: "2026-09-01", endDate: "2026-09-30", context: "Pilot farm", status: "locked", amount: 1250, unallocated: 0, warnings: 0}]}}));
    await page.route("**/api/inventory/workspace?**", route => route.fulfill({json: {warehouses: [{id: "store-a", name: "Pilot store"}], selectedWarehouse: {id: "store-a", name: "Pilot store"}, items: [{name: "Feed", unit: "kg", currentBalance: 987, received: 1000, feedUsage: 13, dailyUsage: 0, healthUsage: 0, vaccineUsage: 0, stockValue: 20000}]}}));
    await page.goto("/app/reports");
    await page.getByRole("group", {name: "Language"}).getByRole("button", {name: "EN", exact: true}).click();
    const nav = page.getByRole("navigation", {name: "Report sections"});
    await expect(nav.getByRole("button")).toHaveCount(5);
    await expect(page.getByText("12,345", {exact: true})).toBeVisible();
    for (const name of ["Feed and FCR", "Health and deaths", "Stock and usage", "Sales and finance"]) {
      await nav.getByRole("button", {name, exact: true}).click();
      await expect(nav.getByRole("button", {name, exact: true})).toHaveAttribute("aria-pressed", "true");
      await expect(page).toHaveURL(/\/app\/reports/);
    }
    await expect(page.getByText(/54,321/)).toBeVisible();
    await nav.getByRole("button", {name: "Stock and usage", exact: true}).click();
    await expect(page.getByText("987 kg", {exact: true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("group", {name: "Language"}).getByRole("button", {name: "አማ", exact: true}).click();
    await expect(page.getByRole("navigation", {name: "የሪፖርት ክፍሎች"}).getByRole("button", {name: "ምርት", exact: true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole("navigation", {name: "የሪፖርት ክፍሎች"})).toBeVisible();
  });
}

test("Reports source readers retain live local CEO/assigned-manager scope", async ({page}) => {
  const host = new URL(process.env.APP_BASE_URL || "http://localhost:3000").hostname;
  test.skip(!["localhost", "127.0.0.1"].includes(host), "Isolated local fixture only; use populated tenant checks for staging");
  const managerEmail = process.env.E2E_FARM_MANAGER_EMAIL;
  const managerPassword = process.env.E2E_FARM_MANAGER_PASSWORD;
  test.skip(!managerEmail || !managerPassword, "Assigned manager credentials required");
  test.setTimeout(180_000);
  const farmId = "12000000-0000-4000-8000-000000000003";
  const warehouseId = "12000000-0000-4000-8000-000000000005";
  const readers: Array<[ReportSection, string]> = [
    ["production", "/api/operations-analytics?date_from=2026-10-01&date_to=2026-10-05"],
    ["health", "/api/mortality/dashboard?date_from=2026-10-01&date_to=2026-10-05"],
    ["finance", "/api/sales/analytics?date_from=2026-10-01&date_to=2026-10-05"],
    ["stock", `/api/inventory/workspace?month=2026-10&warehouse_id=${warehouseId}`],
  ];
  const signIn = async (account: string, secret: string) => {
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(account);
    await page.locator('input[name="password"]').fill(secret);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/(ceo|farm-manager|today)/, {timeout: 60_000});
  };
  await signIn(email!, password!);
  const ceoReports = new Map<ReportSection, unknown>();
  for (const [section, url] of readers) {
    const response = await page.request.get(url);
    expect(response.status()).toBe(200);
    ceoReports.set(section, presentReport(section, await response.json()));
  }
  // New context means no CEO cookie can remain during the manager checks.
  await page.context().clearCookies();
  await signIn(managerEmail!, managerPassword!);
  for (const [section, url] of readers) {
    const response = await page.request.get(section === "stock" ? url : `${url}&farm_id=${farmId}`);
    expect(response.status()).toBe(200);
    const view = presentReport(section, await response.json());
    const ceoView = ceoReports.get(section) as ReturnType<typeof presentReport>;
    // Isolated local fixture has one farm/store, so both scopes must agree.
    expect(view.metrics).toEqual(ceoView.metrics);
    expect(view.rows).toEqual(ceoView.rows);
  }
  const denied = await page.request.get("/api/inventory/workspace?month=2026-10&warehouse_id=12000000-0000-4000-8000-000000000099");
  expect(denied.status()).toBe(403);
  const deniedFarm = await page.request.get("/api/operations-analytics?date_from=2026-10-01&date_to=2026-10-05&farm_id=12000000-0000-4000-8000-000000000099");
  expect(deniedFarm.status()).toBe(403);
});
