import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Farm Manager primary chrome uses catalogs instead of protected English literals", async () => {
  const [sidebar, shell, bell, signOut, localeSwitch, appLayout] = await Promise.all([
    read("../src/components/app-sidebar.tsx"),
    read("../src/components/app-shell.tsx"),
    read("../src/components/header-alert-bell.tsx"),
    read("../src/components/sign-out-button.tsx"),
    read("../src/components/locale-switch.tsx"),
    read("../src/app/app/layout.tsx"),
  ]);

  assert.match(sidebar, /useTranslations\("ManagerNavigation"\)/);
  assert.match(shell, /useTranslations\("PageTitles"\)/);
  assert.match(bell, /useTranslations\("Notifications"\)/);
  assert.match(signOut, /useTranslations\("Common"\)/);
  assert.match(appLayout, /<AppShell viewerRole=\{viewerRole\}>/);
  assert.match(shell, /<LocaleSwitch viewerRole=\{viewerRole\} \/>/);
  assert.match(localeSwitch, /useState<string \| null>\(viewerRole\)/);

  for (const [source, forbidden] of [
    [sidebar, ["Assigned Branch Scope", "Manager Dashboard", "Farm Operations"]],
    [shell, ["Manager dashboard", "Operations workspace", "Open navigation"]],
    [bell, ["Attention and updates", "Needs attention", "Mark all as read", "No recent updates", "Open action desk"]],
    [signOut, ["Signing out…", "Sign out"]],
  ]) {
    for (const phrase of forbidden) assert.doesNotMatch(source, new RegExp(`([\"'\\x60])${phrase}\\1`));
  }
});

test("Today UI code consumes stable message maps rather than server English", async () => {
  const source = await read("../src/i18n/today-copy.ts");
  assert.match(source, /satisfies Record<TodayErrorCode/);
  assert.match(source, /satisfies Record<TodayTask\["code"\]/);
  assert.match(source, /satisfies Record<TodayTaskState/);
  assert.doesNotMatch(source, /There is not enough|Something went wrong|This day is locked/);
});
