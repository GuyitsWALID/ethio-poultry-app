import {expect, test} from "@playwright/test";
import {loadReport, reportSections, type ReportInput} from "../../src/lib/report-workspace";
import {formatEtb, formatNumber} from "../../src/i18n/formats";
import messages from "../../messages/en.json";

const stagingHost = "ethio-poultry-app-staging.walidmurad65.workers.dev";
test.skip(new URL(process.env.APP_BASE_URL || "http://localhost:3000").hostname !== stagingHost, "Dedicated staging check only");

for (const role of ["CEO", "FARM_MANAGER"] as const) {
  test(`Populated staging Reports preserve ${role} source totals`, async ({page}) => {
    test.setTimeout(240_000);
    // Playwright transport errors can include authenticated Cookie headers.
    // Keep failures explicit without writing session credentials to CI logs.
    const get=async(url:string)=>{
      try{return await page.request.get(url);}
      catch{throw new Error(`Staging read transport failed: ${url.split("?")[0]}`);}
    };
    const email = process.env[`E2E_${role}_EMAIL`];
    const password = process.env[`E2E_${role}_PASSWORD`];
    expect(Boolean(email && password), "Dedicated staging credentials must exist").toBe(true);
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/(ceo|farm-manager|today)/);
    const contextResponse = await get("/api/me/context");
    expect(contextResponse.status()).toBe(200);
    const context = await contextResponse.json();
    expect(context.role).toBe(role === "CEO" ? "ceo" : "farm_manager");
    if (role === "FARM_MANAGER") expect(context.todayWorkspaceEnabled, "Do not enable rollout automatically to pass a test").toBe(true);
    const optionsResponse = await get("/api/scope/options");
    expect(optionsResponse.status()).toBe(200);
    const options = await optionsResponse.json();
    expect(options.farms.length, "Populated assigned-farm scope required").toBeGreaterThan(0);
    const farmId = role === "FARM_MANAGER" ? options.farms[0].id as string : undefined;
    const to = new Date().toISOString().slice(0, 10);
    const start = new Date(`${to}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 89);
    const input: ReportInput = {dateFrom: start.toISOString().slice(0, 10), dateTo: to, farmId, month: to.slice(0, 7)};
    const read = async (url: string) => {
      const response = await get(url);
      expect(response.status(), `Authorized source ${url.split("?")[0]}`).toBe(200);
      if (url.startsWith("/api/reports/evidence")) expect(response.headers()["cache-control"]).toContain("no-store");
      return response.json();
    };
    const stock = await read(`/api/inventory/workspace?month=${input.month}`);
    if (role === "FARM_MANAGER") {
      const accessResponse=await get("/api/me/warehouse-access");
      expect(accessResponse.status()).toBe(200);
      expect(accessResponse.headers()["cache-control"]).toContain("no-store");
      const access=await accessResponse.json();
      for (const warehouse of stock.warehouses) {
        const effective=access.warehouses.find((row: {id:string})=>row.id===warehouse.id);
        expect(effective, "Stock and effective-access readers must agree").toBeTruthy();
        expect(effective.access_source).toBe(warehouse.farm_id?"farm_assignment":"warehouse_assignment");
      }
      const denied=await get(`/api/governance/assignments/handover?farm_id=${farmId}&replacement_id=${context.userId}`);
      expect(denied.status(), "Farm Managers cannot initiate CEO handover").toBe(403);
    }
    input.warehouseId = stock.warehouses[0]?.id;
    const batches = options.batches.filter((batch: {farm_id: string}) => !farmId || batch.farm_id === farmId);
    expect(batches.length, "Populated feed batch required").toBeGreaterThan(0);
    // Select existing consumption evidence, not an arbitrary empty new batch.
    for (const batch of batches.slice(0, 10)) {
      input.batchId = batch.id;
      const feed = await loadReport("feed", input, read);
      if ((feed?.metrics.find(metric => metric.key === "feedKg")?.value || 0) > 0) break;
    }
    // Exercise the unified workspace, while retaining independent source checks.
    const performanceParams = new URLSearchParams({date_from: input.dateFrom, date_to: input.dateTo});
    if (farmId) performanceParams.set("farm_id", farmId);
    const performance = await read(`/api/reports/performance?${performanceParams}`);
    const canonical = await read(`/api/operations-analytics?${performanceParams}`);
    expect(performance.sections.production.metrics.find((m: {key: string}) => m.key === "eggs").value).toBe(canonical.summary.current.eggs);
    for (const section of reportSections) {
      const source = await loadReport(section, {...input, batchId: section === "feed" ? input.batchId : undefined}, read);
      expect(source).not.toBeNull();
    }
    const views = ["overview", "production", "feeding", "health", "stock", "salesCosts", "saved"] as const;
    const query = new URLSearchParams({filter_view: "1", filter_dateFrom: input.dateFrom, filter_dateTo: input.dateTo});
    if (farmId) query.set("filter_farmId", farmId);
    await page.goto(`/app/reports?${query}`);
    await page.getByRole("group", {name: /^(Language|ቋንቋ)$/}).getByRole("button", {name: "EN", exact: true}).click({timeout: 30_000});
    for (const view of views) {
      await page.getByRole("button", {name: messages.FarmPerformance.views[view], exact: true}).click();
      await expect(page).toHaveURL(/\/app\/reports/);
      // Next's route announcer is an empty global alert, not a report failure.
      await expect(page.locator("main").getByRole("alert"), `No error in ${view}`).toHaveText([]);
      if (view === "overview" || view === "saved") continue;
      for (const metric of performance.sections[view].metrics) {
        const label = messages.FarmPerformance.labels[metric.key as keyof typeof messages.FarmPerformance.labels] ?? messages.FarmPerformance.unavailable;
        const number = metric.value === null ? messages.FarmPerformance.unavailable : metric.unit === "ETB" ? formatEtb(metric.value, "en") : formatNumber(metric.value, "en");
        const card = page.locator("dt").filter({hasText: label}).first().locator("..");
        await expect(card.locator("dd").first()).toContainText(number);
      }
    }
    // Keep populated acceptance strict: unavailable is not zero or a passing fixture.
    expect(performance.sections.production.metrics.find((m: {key: string}) => m.key === "eggs").value, "Populated staging egg evidence is required").toBeGreaterThan(0);
    // Unknown targets cannot act as grants. No assignments are changed here.
    const unknown = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    for (const section of ["health", "finance"]) {
      const denied = await get(`/api/reports/evidence?section=${section}&date_from=${input.dateFrom}&date_to=${to}&farm_id=${unknown}`);
      expect(denied.status()).toBe(403);
      expect(denied.headers()["cache-control"]).toContain("no-store");
    }
    // Report an incomplete staging fixture after exercising the other sections;
    // never grant a warehouse assignment or weaken authorization to pass.
    expect(stock.warehouses.length, "Dedicated staging manager needs an existing authorized warehouse for populated stock acceptance").toBeGreaterThan(0);
  });
}
