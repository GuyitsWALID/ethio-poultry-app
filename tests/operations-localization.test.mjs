import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("delayed profile locale cannot overwrite a newer explicit language choice", async () => {
  const source = await read("../src/components/locale-switch.tsx");
  assert.match(source, /!selectedLocally\.current && isAppLocale/);
  assert.ok(source.indexOf("selectedLocally.current = true") < source.indexOf("setDeviceLocale(locale)"));
  assert.doesNotMatch(source, /}, \[activeLocale\]\)/);
});

test("governance steps and manager queues use translated labels", async () => {
  const source = await read("../src/components/governance-desk.tsx");
  for (const key of ["readyToFix", "returnedForChanges", "awaitingCEO", "differenceFoundStep", "managerProposesStep", "ceoAuthorizesStep", "managerFixesOnceStep"]) {
    assert.ok(source.includes('ui("' + key + '")'), key);
  }
});

test("physical stock count uses shrinkable controls and tablet columns", async () => {
  const source = await read("../src/app/app/reconciliation/page.tsx");
  assert.ok(source.includes("sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)"));
  assert.ok(source.includes("[&>input]:min-w-0 [&>select]:min-w-0"));
  assert.ok(!source.includes("lg:grid-cols-[1fr_1fr_.7fr_1.5fr_auto]"));
});

test("Alerts and notification settings use bilingual catalogs", async () => {
  const [alerts, settings] = await Promise.all([
    read("../src/app/app/alerts/page.tsx"),
    read("../src/components/notifications/notification-settings-panel.tsx"),
  ]);

  assert.match(alerts, /useTranslations\("AlertsPage"\)/);
  assert.match(settings, /useTranslations\("NotificationSettings"\)/);

  for (const phrase of [
    "Every warning has an owner and a verified finish.",
    "Operational action queue",
    "Complete and send for review",
    "No actions match this view",
  ]) {
    assert.doesNotMatch(alerts, new RegExp(`(["'\\x60])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`));
  }

  for (const phrase of [
    "Choose what interrupts you.",
    "Tasks assigned directly by the CEO always appear.",
    "Save notification preferences",
  ]) {
    assert.doesNotMatch(settings, new RegExp(`(["'\\x60])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`));
  }
});

test("Inventory and warehouse workflows use the bilingual catalog", async () => {
  const inventory = await read("../src/app/app/inventory/page.tsx");

  assert.match(inventory, /useTranslations\("Inventory"\)/);
  assert.match(inventory, /formatEtb\(/);
  assert.match(inventory, /formatNumber\(/);

  for (const phrase of [
    "Current stock and automatic usage",
    "Count every stocked item together",
    "Receive stock into",
    "This records a cost and does not change warehouse stock.",
    "More stock actions",
  ]) {
    assert.doesNotMatch(inventory, new RegExp(`(["'\\x60])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`));
  }
});
