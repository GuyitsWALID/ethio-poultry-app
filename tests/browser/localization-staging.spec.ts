import {expect, test} from "@playwright/test";
import en from "../../messages/en.json";
import am from "../../messages/am.json";
import fixture from "../fixtures/staging-reports.json";

test.skip(new URL(process.env.APP_BASE_URL || "http://localhost:3000").hostname !== "ethio-poultry-app-staging.walidmurad65.workers.dev", "Dedicated staging accounts only");

for (const role of ["CEO", "FARM_MANAGER"] as const) {
  test(`Localized operational screens and tablet layouts: ${role}`, async ({page}) => {
    test.setTimeout(300_000);
    const email = process.env[`E2E_${role}_EMAIL`];
    const password = process.env[`E2E_${role}_PASSWORD`];
    expect(Boolean(email && password), "Dedicated staging credentials required").toBe(true);
    const errors: string[] = [];
    page.on("pageerror", () => errors.push("Browser runtime error"));
    page.on("console", message => {
      if (/MISSING_MESSAGE|FORMATTING_ERROR/.test(message.text())) errors.push("Translation lookup or formatting error");
    });
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/(ceo|farm-manager|today)/);
    const contextResponse = await page.request.get("/api/me/context");
    expect(contextResponse.status()).toBe(200);
    const context = await contextResponse.json();
    expect(context.orgName).toBe(fixture.organizationName);
    expect(context.role).toBe(role === "CEO" ? "ceo" : "farm_manager");
    expect(context.todayWorkspaceEnabled, "Do not change rollout to pass localization checks").toBe(true);
    const originalLocale = context.preferredLocale === "am" ? "am" : "en";
    const query = new URLSearchParams({filter_view: "1", filter_preset: "custom", filter_dateFrom: fixture.dateFrom, filter_dateTo: fixture.dateTo, filter_page_dateFrom: fixture.dateFrom, filter_page_dateTo: fixture.dateTo});
    try {
      for (const locale of ["en", "am"] as const) {
        const copy = locale === "am" ? am : en;
        await page.goto(`/app/reports?${query}`);
        await page.getByRole("group", {name: /^(Language|ቋንቋ)$/}).getByRole("button", {name: locale === "am" ? "አማ" : "EN", exact: true}).click();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect.poll(async () => {
          const response = await page.request.get("/api/me/context");
          return response.ok() ? (await response.json()).preferredLocale : null;
        }).toBe(locale);
        const navigation = page.getByRole("navigation", {name: copy.FarmPerformance.title, exact: true});
        for (const viewport of [{width: 768, height: 1024}, {width: 1024, height: 768}]) {
          await page.setViewportSize(viewport);
          await expect(navigation).toBeVisible();
          for (const view of ["overview", "production", "feeding", "health", "stock", "salesCosts", "saved"] as const) {
            const button = navigation.getByRole("button", {name: copy.FarmPerformance.views[view], exact: true});
            await button.focus();
            await expect(button).toBeFocused();
            await button.click();
            await expect(button).toHaveAttribute("aria-pressed", "true");
            await expect(page.locator('[aria-live="polite"][aria-busy]').last()).toHaveAttribute("aria-busy", "false");
            expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
            await expect(page.locator(".performance-section-error")).toHaveCount(0);
            await expect(page.locator("main").getByRole("alert")).toHaveText([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
          }
          if (locale === "am") {
            const calendars = page.getByRole("group", {name: copy.Calendar.ethiopian, exact: true});
            await expect(calendars.first()).toBeVisible();
            expect(await calendars.count()).toBeGreaterThanOrEqual(2);
          }
        }
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(navigation).toBeVisible();
        const routes = [
          ["/app/governance", copy.OperationUI.approveTheReasonThenCorrectTheExactRecordOnce],
          ["/app/reconciliation", copy.OperationUI.seeWhatDoesNotAgreeAndExactlyWhereToFix],
          ["/app/health", copy.OperationUI.keepEveryPreventiveActionOnTheRunway],
          ["/app/sales", copy.OperationUI.turnEverySaleIntoCollectedCashAndProtectedMargin],
        ];
        for (const [url, heading] of routes) {
          await page.goto(url);
          await expect(page.getByRole("heading", {name: heading, exact: true}).first()).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
          await expect(page.locator("body")).not.toContainText(/(?:OperationUI|OperationCharts|RecordCheckGuidance|LegacyReports)\.[A-Za-z]/);
        }
      }
      expect(errors).toEqual([]);
    } finally {
      // Restore the test account preference; never create or correct business records.
      const restored = await page.request.patch("/api/me/locale", {data: {locale: originalLocale}});
      expect(restored.ok(), "Restore original test-account language").toBe(true);
    }
  });
}
