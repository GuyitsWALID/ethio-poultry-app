import {expect, test} from "@playwright/test";
import {buildHistoryHref, historyCategories, historyPeriod} from "../../src/lib/history/contracts";
import messages from "../../messages/en.json";
import am from "../../messages/am.json";

test.skip(new URL(process.env.APP_BASE_URL || "http://localhost:3000").hostname !== "ethio-poultry-app-staging.walidmurad65.workers.dev", "Dedicated staging check only");
for (const role of ["CEO", "FARM_MANAGER"] as const) {
  test(`History reads authorized existing evidence for staging ${role}`, async ({page}) => {
    test.setTimeout(180_000);
    const email = process.env[`E2E_${role}_EMAIL`], password = process.env[`E2E_${role}_PASSWORD`];
    expect(Boolean(email && password), "Dedicated staging accounts required; do not provision or change rollout to pass").toBe(true);
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\/(ceo|farm-manager|today)/);
    const get = async (url: string) => {
      try {return await page.request.get(url);}
      catch {throw new Error("History staging read transport failed; credentials withheld.");}
    };
    const range = historyPeriod(90);
    let selected: {kind: string; id: string} | undefined;
    for (const category of historyCategories) {
      const response = await get(`/api/history/records?${new URLSearchParams({category, ...range})}`);
      expect(response.status(), `Authorized History category ${category}`).toBe(200);
      expect(response.headers()["cache-control"]).toContain("no-store");
      const body = await response.json();
      expect(body.items.length).toBeLessThanOrEqual(50);
      if (category === "daily") selected = body.items[0];
    }
    expect(selected, "Populated Daily Record evidence required; do not create business records to pass").toBeTruthy();
    const href = buildHistoryHref({category: "daily", ...range}, selected);
    await page.goto(href);
    const workspace = page.getByRole("region", {name: new RegExp(`^(${messages.History.title}|${am.History.title})$`)});
    await expect(workspace.getByRole("alert")).toHaveCount(0);
    await expect(workspace.getByRole("heading", {level: 2, name: new RegExp(`^(${messages.History.kinds.daily_record}|${am.History.kinds.daily_record})$`)}).filter({visible: true})).toBeVisible();
    await expect(page).toHaveURL(/\/app\/history\?/);
    await page.reload();
    await expect(workspace.getByRole("heading", {level: 2, name: new RegExp(`^(${messages.History.kinds.daily_record}|${am.History.kinds.daily_record})$`)}).filter({visible: true})).toBeVisible();
    const detail = await get(`/api/history/records/${selected!.kind}/${selected!.id}`);
    expect(detail.status()).toBe(200);
    expect(detail.headers()["cache-control"]).toContain("no-store");
    if (role === "FARM_MANAGER") {
      const options = await get("/api/scope/options");
      expect(options.status()).toBe(200);
      const batch = (await options.json()).batches.find((row: {status: string}) => row.status === "active");
      expect(batch, "An existing authorized active batch is required; do not create one to pass").toBeTruthy();
      for (const [locale, width, height] of [["en", 1024, 768], ["am", 768, 1024]] as const) {
        const copy = locale === "am" ? am : messages;
        await page.context().addCookies([{name: "preferred_locale", value: locale, url: process.env.APP_BASE_URL!}]);
        await page.setViewportSize({width, height});
        const query = new URLSearchParams({filter_view: "1", filter_farmId: batch.farm_id, filter_batchId: batch.id, feed_target: "template_management"});
        await page.goto(`/app/feeding-log?${query}`);
        await expect(page.locator("main").getByRole("heading", {level: 1, name: copy.Navigation.templates, exact: true})).toBeVisible();
        await expect(page.locator("main").getByLabel(copy.ManagerDestinations.batch)).toHaveValue(batch.id);
        await expect(page.locator("#feed-template-management")).toBeVisible();
        await expect(page.locator("#today-feed-sessions, #feed-history")).toHaveCount(0);
        const links = page.getByRole("navigation", {name: copy.ManagerDestinations.related});
        await expect(links.getByRole("link", {name: copy.Navigation.history, exact: true})).toHaveAttribute("href", /\/app\/history\?/);
        await expect(links.getByRole("link", {name: copy.Navigation.performance, exact: true})).toHaveAttribute("href", /\/app\/reports\?/);
        query.delete("filter_batchId"); query.set("batch_id", batch.id);
        await page.goto(`/app/feeding-log?${query}`);
        await expect(page.getByRole("alert").filter({hasText: copy.ManagerDestinations.noBatch})).toBeVisible();
        await expect(page.locator("#feed-template-management")).toHaveCount(0);
      }
    }
  });
}
