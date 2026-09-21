import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("locale preference is restricted to CEO and Farm Manager profiles", async () => {
  const route = await read("../src/app/api/me/locale/route.ts");
  assert.match(route, /context\.role !== "ceo" && context\.role !== "farm_manager"/);
  assert.match(route, /preferred_locale: body\.locale/);
  assert.match(route, /preferred_locale/);
  assert.match(route, /private, no-store/);
});

test("the switch persists a device fallback and updates the client provider immediately", async () => {
  const [provider, control] = await Promise.all([
    read("../src/i18n/locale-provider.tsx"),
    read("../src/components/locale-switch.tsx"),
  ]);
  assert.match(provider, /localStorage\.setItem/);
  assert.match(provider, /window\.dispatchEvent/);
  assert.match(provider, /useSyncExternalStore/);
  assert.match(provider, /addEventListener\(LOCALE_CHANGE_EVENT, onStoreChange\)/);
  assert.match(provider, /isAppLocale\(saved\) \? saved : initialLocale/);
  assert.match(control, /\/api\/me\/locale/);
  assert.match(control, /role !== "ceo" && role !== "farm_manager"/);
});
