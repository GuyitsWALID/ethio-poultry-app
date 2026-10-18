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
    const range = historyPeriod(90);
    let selected: {kind: string; id: string} | undefined;
    for (const category of historyCategories) {
      let response;
      try {response = await page.request.get(`/api/history/records?${new URLSearchParams({category, ...range})}`);}
      catch {throw new Error(`History staging read transport failed: ${category}; credentials withheld.`);}
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
    const detail = await page.request.get(`/api/history/records/${selected!.kind}/${selected!.id}`);
    expect(detail.status()).toBe(200);
    expect(detail.headers()["cache-control"]).toContain("no-store");
  });
}
