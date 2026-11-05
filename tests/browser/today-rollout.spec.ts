import {expect, test, type Page} from "@playwright/test";

const email = process.env.E2E_CEO_EMAIL;
const password = process.env.E2E_CEO_PASSWORD;
if (process.env.E2E_REQUIRE_ROLE_CREDENTIALS === "true" && (!email || !password)) throw new Error("CEO browser credentials required");
test.skip(!email || !password, "CEO browser credentials required");

async function login(page: Page) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.locator('input[name="password"]').fill(password!);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app\/ceo/, {timeout: 60_000});
}

for (const viewport of [{width: 768, height: 1024}, {width: 1024, height: 768}]) {
  test(`CEO rollout controls and readable history ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    let enabled = false;
    const events: Record<string, unknown>[] = [];
    await page.route("**/api/ceo/feature-flags/today-workspace", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        enabled = body.enabled;
        events.unshift({sequence: events.length + 1, enabled, actorName: "Pilot CEO", source: "ceo", reason: body.reason, occurredAt: "2026-10-05T09:00:00Z", releaseReference: null});
        await route.fulfill({json: {today_workspace_enabled: enabled, changed: true}});
      } else await route.fulfill({json: {enabled, events}});
    });
    await login(page);
    await page.goto("/app/ceo/setup");
    await page.getByRole("group", {name: "Language"}).getByRole("button", {name: "EN", exact: true}).click();
    const panel = page.getByRole("region", {name: "Today workspace"});
    const enable = panel.getByRole("button", {name: "Enable Today", exact: true});
    await expect(enable).toBeDisabled();
    await panel.getByLabel("Reason for change").fill("abc");
    await expect(enable).toBeDisabled();
    await panel.getByLabel("Reason for change").fill("Pilot approved for isolated farm");
    await enable.click();
    await expect(panel.getByRole("button", {name: "Disable Today", exact: true})).toBeDisabled();
    await expect(panel.getByText("Pilot approved for isolated farm", {exact: true})).toBeVisible();
    await expect(panel.getByText(/Pilot CEO/)).toBeVisible();
    await panel.getByLabel("Reason for change").fill("Return to previous manager pages");
    await panel.getByRole("button", {name: "Disable Today", exact: true}).click();
    await expect(panel.getByText("Return to previous manager pages", {exact: true})).toBeVisible();
    await expect(panel.getByRole("button", {name: "Enable Today", exact: true})).toBeDisabled();
    await page.getByRole("group", {name: "Language"}).getByRole("button", {name: "አማ", exact: true}).click();
    const amPanel = page.getByRole("region", {name: "የዛሬ ሥራ ገጽ"});
    await expect(amPanel.getByRole("heading", {name: "የቅርብ ጊዜ ለውጦች"})).toBeVisible();
    const time = amPanel.locator("time").first();
    await expect(time).toHaveAttribute("datetime", "2026-10-05T09:00:00Z");
    await expect(time).not.toContainText("2026");
    await page.getByRole("group").filter({has: page.getByRole("button", {name: "EN", exact: true})}).getByRole("button", {name: "EN", exact: true}).click();
  });
}

test("load/save failures preserve reason and require status refresh", async ({page}) => {
  let failLoad = true;
  await page.route("**/api/ceo/feature-flags/today-workspace", async (route) => {
    if (route.request().method() === "POST") await route.fulfill({status: 500, json: {code: "ROLLOUT_SAVE_FAILED"}});
    else if (failLoad) await route.fulfill({status: 500, json: {code: "ROLLOUT_LOAD_FAILED"}});
    else await route.fulfill({json: {enabled: false, events: []}});
  });
  await login(page);
  await page.goto("/app/ceo/setup");
  await page.getByRole("group").filter({has: page.getByRole("button", {name: "EN", exact: true})}).getByRole("button", {name: "EN", exact: true}).click();
  const panel = page.getByRole("region", {name: "Today workspace"});
  await expect(panel.getByRole("alert")).toContainText("Could not load");
  await expect(panel.getByRole("button", {name: "Enable Today"})).toBeDisabled();
  failLoad = false;
  await panel.getByRole("button", {name: "Refresh rollout status"}).click();
  await panel.getByLabel("Reason for change").fill("Keep my reason after rejection");
  await panel.getByRole("button", {name: "Enable Today"}).click();
  await expect(panel.getByRole("alert")).toContainText("Your reason is kept");
  await expect(panel.getByLabel("Reason for change")).toHaveValue("Keep my reason after rejection");
  await expect(panel.getByRole("button", {name: "Enable Today"})).toBeDisabled();
});
