import {expect, test} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {build} from "esbuild";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider} from "next-intl";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import en from "../../messages/en.json";
import am from "../../messages/am.json";

test.use({channel: process.platform === "win32" ? "chrome" : undefined, video: "off", trace: "off"});

test("real calendar filters remain readable in narrow containers and tablet layouts", async ({page}, testInfo) => {
  const bundle = await build({entryPoints: ["src/components/operation-date-input.tsx"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic"});
  const calendarModule = {exports: {}} as {exports: {OperationDateInput?: React.ComponentType<Record<string, unknown>>}};
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(`${process.cwd()}/package.json`), calendarModule, calendarModule.exports);
  const DateInput = calendarModule.exports.OperationDateInput!;
  const css = await postcss([tailwindcss(), autoprefixer()]).process(await readFile("src/app/globals.css", "utf8"), {from: "src/app/globals.css"});
  for (const [locale, messages] of [["en", en], ["am", am]] as const) {
    const date = (name: string) => React.createElement(DateInput, {value: "2026-10-30", name, className: "h-12 w-full rounded-xl border px-3 text-sm"});
    // next-intl requires children in its typed provider props for static rendering.
    // eslint-disable-next-line react/no-children-prop
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale, messages, timeZone: "Africa/Addis_Ababa", children:
      React.createElement("main", {className: "p-5"},
        React.createElement("div", {className: "performance-filter-grid"},
          React.createElement("label", {className: "grid gap-2"}, messages.FarmPerformance.from, date("from")),
          React.createElement("label", {className: "grid gap-2"}, messages.FarmPerformance.to, date("to")),
          React.createElement("label", {className: "grid gap-2"}, messages.FarmPerformance.farm, React.createElement("select", {className: "min-h-12 min-w-0 w-full border"}, React.createElement("option", {}, messages.FarmPerformance.all)))),
        React.createElement("section", {style: {width: "180px", marginTop: "24px"}}, date("narrow")))}));
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({width, height: 1024});
      await page.setContent(`<!doctype html><html lang="${locale}"><head><style>${css.css}</style></head><body>${html}</body></html>`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (locale === "am") {
        const groups = page.locator(".operation-date-input");
        await expect(groups).toHaveCount(3);
        for (const group of await groups.all()) {
          const controls = group.locator("select");
          for (const control of await controls.all()) {
            const box = (await control.boundingBox())!;
            expect(box.height).toBeGreaterThanOrEqual(48);
            // Reserve readable text width after native arrow and horizontal padding.
            expect(box.width).toBeGreaterThanOrEqual(72);
          }
          await expect(group.locator('input[type="hidden"]')).toHaveValue("2026-10-30");
        }
        const narrow = groups.last();
        const first = (await narrow.locator("select").nth(0).boundingBox())!;
        const second = (await narrow.locator("select").nth(1).boundingBox())!;
        expect(second.y).toBeGreaterThan(first.y + first.height);
        if (width === 768) await page.screenshot({path: testInfo.outputPath("amharic-date-filters-tablet.png"), fullPage: true});
      } else {
        await expect(page.locator('input[type="date"]')).toHaveCount(3);
      }
    }
  }
});
