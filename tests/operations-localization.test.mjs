import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

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
