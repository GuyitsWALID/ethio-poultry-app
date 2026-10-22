// Render the real workspace against explicit fixtures. This is not staging acceptance.
import assert from "node:assert/strict";
import {readFile, mkdir} from "node:fs/promises";
import path from "node:path";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
const repo = path.resolve(import.meta.dirname, ".."), require = createRequire(path.join(repo, "package.json"));
const {build} = require("esbuild"), {chromium, expect} = require("@playwright/test");
const baseline = process.argv.includes("--baseline");
// Pin the pre-redesign checkpoint so later local commits do not change the baseline.
const baselineRef = "a32aa4e";
// Share the existing real-provider harness, without changing its assertions.
const harness = await readFile(path.join(repo, "scripts/test-farm-performance-browser.mjs"), "utf8");
const navigation = harness.match(/const navigation = `([^`]+)`;/)[1];
const entry = harness.match(/const entry = `([^`]+)`;/)[1];
const bundle = await build({stdin: {contents: entry, resolveDir: repo, loader: "tsx"}, bundle: true, write: false, jsx: "automatic", platform: "browser", define: {"process.env.NODE_ENV": '"development"'}, plugins: [{name: "test-navigation", setup(b) {
  if (baseline) b.onLoad({filter: /farm-performance-workspace\.tsx$/}, () => ({contents: execFileSync("git", ["show", `${baselineRef}:src/components/reports/farm-performance-workspace.tsx`], {cwd: repo, encoding: "utf8"}), loader: "tsx", resolveDir: path.join(repo, "src/components/reports")}));
  b.onResolve({filter: /^next\/(navigation|link)$/}, args => ({path: args.path, namespace: "test"}));
  b.onResolve({filter: /branch-report-workspace$/}, () => ({path: "legacy", namespace: "test"}));
  b.onLoad({filter: /.*/, namespace: "test"}, args => ({contents: args.path === "next/navigation" ? navigation : args.path === "legacy" ? "export function BranchReportWorkspace(){return null}" : "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}", resolveDir: repo}));
}}]});
const cssSource = baseline ? execFileSync("git", ["show", `${baselineRef}:src/app/globals.css`], {cwd: repo, encoding: "utf8"}) : await readFile(path.join(repo, "src/app/globals.css"), "utf8");
const css = await require("postcss")([require("tailwindcss")(path.join(repo, "tailwind.config.ts"))]).process(cssSource, {from: path.join(repo, "src/app/globals.css")});
const days = Array.from({length: 30}, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
const metric = (key, value, unit, previous = value === null ? null : value * .94) => ({key, value, unit, previous, delta: value === null ? null : value - previous, deltaPct: null, state: value === null ? "missing" : "available", explanation: "RECORDED_TOTAL"});
const series = (key, unit, f) => ({key, unit, points: days.map((date, i) => ({date, value: f(i)}))});
const section = (metrics, series = [], rows = [], breakdowns = []) => ({state: "available", metrics, series, rows, breakdowns, coverage: {recorded: 57, expected: 60, percent: 95}, explanations: ["PARTIAL_DAILY_RECORDS"], evidenceHref: "/app/history"});
const fixture = {schemaVersion: 1, meta: {dateFrom: days[0], dateTo: days.at(-1), previousFrom: "2026-09-01", previousTo: "2026-09-30", days: 30, scopeLabel: "Uno farm", timezone: "Africa/Addis_Ababa", generatedAt: "2026-10-31T00:00:00Z"}, options: {warehouses: []}, concerns: [{key: "coverage", severity: "watch", evidenceHref: "/app/history"}], sections: {
  production: section([metric("eggs", 42580, "eggs"), metric("hdep", 88.7, "%"), metric("marketableRate", 97.1, "%")], [series("eggs", "eggs", i => i === 10 ? null : 1350 + Math.round(Math.sin(i / 3) * 110) + i * 4), series("hdep", "%", i => 85 + Math.sin(i / 4) * 4), series("hdepTarget", "%", () => 91), series("marketableRate", "%", i => 96 + Math.sin(i / 4))], [{label: "Layer A", unit: "%", values: {primary: 89, target: 91}}, {label: "Layer B", unit: "%", values: {primary: 86, target: 90}}, {label: "Broiler C", unit: "g", date: days[28], values: {primary: 1980, target: 2100}}], [{key: "eggQuality", unit: "eggs", rows: [{label: "normal", value: 41345}, {label: "broken", value: 810}, {label: "dirty", value: 425}]}]),
  feeding: section([metric("sessionActualKg", 5680, "kg"), metric("sessionPlannedKg", 5800, "kg"), metric("feedPerBirdGrams", 118, "g/bird/day"), metric("layerFcr", 2.1, "kg/kg"), metric("growthFcr", null, "kg/kg"), metric("closedFeedDays", 57, "flock-days")], [series("session_actual", "kg", i => 180 + Math.round(Math.sin(i / 2) * 12)), series("session_planned", "kg", () => 194), series("feedPerBirdGrams", "g/bird/day", i => 115 + Math.sin(i / 3) * 8)], [], [{key: "feedTypes", unit: "kg", rows: [{label: "Layer ration", value: 4420}, {label: "Grower ration", value: 1260}]}, {key: "sessionStatus", unit: "sessions", rows: [{label: "completed", value: 172}, {label: "missed", value: 3}, {label: "unfinished", value: 5}]}]),
  health: section([metric("deaths", 19, "birds"), metric("culls", 7, "birds"), metric("treatment", 4, "events"), metric("vaccination", 2, "events"), metric("disease", 1, "events")], [series("deaths", "birds", i => i % 4 === 0 ? 2 : 0), series("culls", "birds", i => i % 7 === 0 ? 1 : 0)], [], [{key: "recordedDeathCauses", unit: "birds", rows: [{label: "Unknown", value: 12}, {label: "Recorded disease", value: 7}]}]),
  stock: section([metric("estimatedPeriodEndValue", 184500, "ETB"), metric("currentLowStockItems", 2, "items")], [], ["Layer feed", "Grower feed", "Packaging"].map((label, i) => ({label, context: "Uno farm store", unit: i < 2 ? "kg" : "pieces", values: {opening: 1200 - i * 200, periodEnd: 950 - i * 100, current: 860 - i * 100, received: 600, consumption: 850 - i * 100}}))),
  salesCosts: section([metric("revenue", 452800, "ETB"), metric("paid", 382800, "ETB"), metric("balanceDue", 70000, "ETB"), metric("expenses", 126400, "ETB"), metric("estimatedProfit", 58300, "ETB")], [series("revenue", "ETB", i => i % 3 === 0 ? 32000 + i * 100 : 8000), series("paid", "ETB", i => i % 3 === 0 ? 24000 + i * 100 : 6000), series("balanceDue", "ETB", i => i % 3 === 0 ? 8000 : 2000)], [], [{key: "expenseCategories", unit: "ETB", rows: [{label: "Feed", value: 86400}, {label: "Transport", value: 18000}, {label: "Labour", value: 16000}, {label: "Other", value: 6000}]}]),
}};
fixture.sections.production.rows[0].values.feedPerBirdGrams = 118;
fixture.sections.production.rows[0].values.hdep = 89;
fixture.sections.production.rows[1].values.feedPerBirdGrams = 121;
fixture.sections.production.rows[1].values.hdep = 86;
const output = path.join(repo, "test-results/performance-redesign"); await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true});
try {
  for (const width of [1440, 768, 390]) {
    const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: "reduce"});
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {if (message.type() === "error") errors.push(message.text());});
    let failed = false;
    await page.route("**/*", async route => {
      const url = new URL(route.request().url()); assert.equal(route.request().method(), "GET");
      if (url.pathname.endsWith(".ttf")) return route.fulfill({contentType: "font/ttf", body: await readFile(path.join(repo, "src/app/fonts", path.basename(url.pathname)))});
      if (url.pathname === "/api/me/context") return route.fulfill({json: {orgId: "org", userId: "manager", role: "farm_manager"}});
      if (url.pathname === "/api/scope/options") return route.fulfill({json: {branches: [], farms: [{id: "farm", name: "Uno farm"}], houses: [], flocks: [], batches: []}});
      if (url.pathname === "/api/reports/performance") {const data = structuredClone(fixture); if (failed) data.sections.feeding = {...data.sections.feeding, state: "failed", metrics: [], series: [], breakdowns: [], rows: []}; return route.fulfill({json: data});}
      if (url.pathname === "/api/reports/management") return route.fulfill({json: {runs: [], nextCursor: null, capabilities: {canSchedule: false, canGenerate: false}, schedules: [], recipients: []}});
      return route.fulfill({contentType: "text/html", body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main style="max-width:1600px;margin:auto;padding:24px"><div id="root"></div></main></body></html>'});
    });
    await page.goto("http://performance.test/app/reports?filter_view=1&filter_page_dateFrom=2026-10-01&filter_page_dateTo=2026-10-30");
    await page.addStyleTag({content: '@font-face{font-family:Plex;src:url(/IBMPlexSans-Variable.ttf)}@font-face{font-family:Fraunces;src:url(/Fraunces-Variable.ttf)}:root{--font-sans:Plex;--font-display:Fraunces}'+css.css});
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    const nav = page.getByRole("navigation", {name: "Farm performance", exact: true});
    if (baseline) {
      await expect(page.getByText("42,580", {exact: false}).first()).toBeVisible(); await page.evaluate(() => document.fonts.ready);
      await page.screenshot({path: path.join(output, `before-overview-${width}.png`)});
      await nav.getByRole("button", {name: "Feeding", exact: true}).click();
      await page.getByRole("img").first().scrollIntoViewIfNeeded();
      await page.screenshot({path: path.join(output, `before-feeding-${width}.png`)});
      await page.close(); continue;
    }
    await expect(page.locator(".performance-evidence")).toBeVisible(); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path: path.join(output, `overview-${width}.png`)});
    const styles = new Set(await page.locator("[data-visual]").evaluateAll(nodes => nodes.map(node => node.dataset.visual)));
    for (const name of ["Production", "Feeding", "Health", "Stock", "Sales & costs"]) {
      await nav.getByRole("button", {name, exact: true}).click();
      await expect(page.locator(".performance-plot").first()).toBeVisible();
      for (const value of await page.locator("[data-visual]").evaluateAll(nodes => nodes.map(node => node.dataset.visual))) styles.add(value);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${name}: overflow`);
      if (width === 1440) {await page.locator(".performance-plots").scrollIntoViewIfNeeded(); await page.screenshot({path: path.join(output, `${name.replaceAll(" ", "-")}.png`)}); if (name === "Production") await page.locator('[data-visual="scatter"]').screenshot({path: path.join(output, "flock-comparison.png")});}
    }
    for (const style of ["area", "donut", "plan", "target", "ranking", "columns", "losses", "scatter"]) assert.ok(styles.has(style), style);
    failed = true; await nav.getByRole("button", {name: "Feeding", exact: true}).click();
    await expect(page.locator(".performance-section-error")).toContainText("This source could not be read");
    await expect(page.locator(".performance-plot")).toHaveCount(0);
    failed = false; await page.locator(".performance-section-error").getByRole("button", {name: "Refresh results"}).click();
    await expect(page.locator('[data-visual="plan"]')).toBeVisible();
    await nav.getByRole("button", {name: "Overview", exact: true}).click();
    await page.getByRole("button", {name: "Amharic", exact: true}).click();
    await expect(page.getByRole("heading", {name: "የእርሻ አፈጻጸም", exact: true})).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path: path.join(output, `am-overview-${width}.png`)});
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}: all eight visual styles, five topics, source failure/retry, English/Amharic, no overflow or business writes`);
    await page.close();
  }
} finally {await browser.close();}
