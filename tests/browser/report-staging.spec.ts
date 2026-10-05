import {expect, test} from "@playwright/test";
import {buildReportHref, loadReport, reportSections, type ReportInput} from "../../src/lib/report-workspace";
import {formatEtb, formatNumber} from "../../src/i18n/formats";
import messages from "../../messages/en.json";

const stagingHost = "ethio-poultry-app-staging.walidmurad65.workers.dev";
test.skip(new URL(process.env.APP_BASE_URL || "http://localhost:3000").hostname !== stagingHost, "Dedicated staging check only");

for (const role of ["CEO", "FARM_MANAGER"] as const) {
  test(`Populated staging Reports preserve ${role} source totals`, async ({page}) => {
    test.setTimeout(240_000);
    const email = process.env[`E2E_${role}_EMAIL`];
    const password = process.env[`E2E_${role}_PASSWORD`];
    expect(Boolean(email && password), "Dedicated staging credentials must exist").toBe(true);
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/(ceo|farm-manager|today)/);
    const contextResponse = await page.request.get("/api/me/context");
    expect(contextResponse.status()).toBe(200);
    const context = await contextResponse.json();
    expect(context.role).toBe(role === "CEO" ? "ceo" : "farm_manager");
    if (role === "FARM_MANAGER") expect(context.todayWorkspaceEnabled, "Do not enable rollout automatically to pass a test").toBe(true);
    const optionsResponse = await page.request.get("/api/scope/options");
    expect(optionsResponse.status()).toBe(200);
    const options = await optionsResponse.json();
    expect(options.farms.length, "Populated assigned-farm scope required").toBeGreaterThan(0);
    const farmId = role === "FARM_MANAGER" ? options.farms[0].id as string : undefined;
    const to = new Date().toISOString().slice(0, 10);
    const start = new Date(`${to}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 89);
    const input: ReportInput = {dateFrom: start.toISOString().slice(0, 10), dateTo: to, farmId, month: to.slice(0, 7)};
    const read = async (url: string) => {
      const response = await page.request.get(url);
      expect(response.status(), `Authorized source ${url.split("?")[0]}`).toBe(200);
      if (url.startsWith("/api/reports/evidence")) expect(response.headers()["cache-control"]).toContain("no-store");
      return response.json();
    };
    const stock = await read(`/api/inventory/workspace?month=${input.month}`);
    input.warehouseId = stock.warehouses[0]?.id;
    const batches = options.batches.filter((batch: {farm_id: string}) => !farmId || batch.farm_id === farmId);
    expect(batches.length, "Populated feed batch required").toBeGreaterThan(0);
    // Select existing consumption evidence, not an arbitrary empty new batch.
    for (const batch of batches.slice(0, 10)) {
      input.batchId = batch.id;
      const feed = await loadReport("feed", input, read);
      if ((feed?.metrics.find(metric => metric.key === "feedKg")?.value || 0) > 0) break;
    }
    await page.goto(buildReportHref("production", {...input, batchId: undefined}));
    await page.getByRole("group", {name: /^(Language|ቋንቋ)$/}).getByRole("button", {name: "EN", exact: true}).click({timeout: 30_000});
    for (const section of reportSections) {
      const selected = {...input, batchId: section === "feed" ? input.batchId : undefined};
      const expected = await loadReport(section, selected, read);
      expect(expected).not.toBeNull();
      await page.goto(buildReportHref(section, selected));
      const pane = page.getByRole("region", {name: messages.ReportWorkspace.sections[section], exact: true});
      await expect(pane).toHaveAttribute("aria-busy", "false");
      await expect(pane.getByRole("alert")).toHaveCount(0);
      for (const metric of expected!.metrics) {
        const value = metric.value === null ? messages.ReportWorkspace.unavailable : metric.unit === "ETB" ? formatEtb(metric.value, "en") : `${formatNumber(metric.value, "en")}${metric.unit ? ` ${metric.unit}` : ""}`;
        const label = pane.getByText(messages.ReportWorkspace.metrics[metric.key], {exact: true}).first();
        await expect(label.locator("..").getByText(value, {exact: true})).toBeVisible();
      }
      if (section === "production") expect(expected!.metrics.find(metric => metric.key === "eggs")!.value).toBeGreaterThan(0);
      if (section === "feed") expect(expected!.metrics.find(metric => metric.key === "feedKg")!.value).toBeGreaterThan(0);
      if (section === "stock" && input.warehouseId) expect(expected!.rows.length).toBeGreaterThan(0);
      if (section === "stock" && !input.warehouseId) expect(expected!.rows).toHaveLength(0);
      if (section === "finance") expect(expected!.metrics.find(metric => metric.key === "revenue")!.value).toBeGreaterThan(0);
    }
    // Unknown targets cannot act as grants. No assignments are changed here.
    const unknown = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    for (const section of ["health", "finance"]) {
      const denied = await page.request.get(`/api/reports/evidence?section=${section}&date_from=${input.dateFrom}&date_to=${to}&farm_id=${unknown}`);
      expect(denied.status()).toBe(403);
      expect(denied.headers()["cache-control"]).toContain("no-store");
    }
    // Report an incomplete staging fixture after exercising the other sections;
    // never grant a warehouse assignment or weaken authorization to pass.
    expect(stock.warehouses.length, "Dedicated staging manager needs an existing authorized warehouse for populated stock acceptance").toBeGreaterThan(0);
  });
}
