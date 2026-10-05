// Presentation-only Chromium regression. Real React/intl/filter modules; mocked
// transport and Next navigation. Does not claim database authorization coverage.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
const repo = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(repo, "package.json"));
const {build} = require("esbuild");
const {chromium, expect} = require("@playwright/test");
const navigation = `
import {useSyncExternalStore} from 'react';
const subscribe=cb=>{window.addEventListener('routechange',cb);return()=>window.removeEventListener('routechange',cb)};
export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname,()=>'/app/reports');
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));
`;
const entry = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {NextIntlClientProvider} from 'next-intl';
import {FarmScopeProvider} from './src/components/farm-scope-context';
import {ReportsWorkspace} from './src/components/reports/consolidated-report-workspace';
import {ReportAnalyticsHandoff} from './src/components/reports/report-analytics-handoff';
import en from './messages/en.json';import am from './messages/am.json';
for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);queueMicrotask(()=>window.dispatchEvent(new Event('routechange')))}}
const params=new URLSearchParams(location.search);const role=params.get('role')==='manager'?'farm_manager':'ceo';
function App(){const [locale,setLocale]=useState(localStorage.getItem('test-locale')||'en');return <NextIntlClientProvider locale={locale} messages={locale==='am'?am:en} timeZone='Africa/Addis_Ababa'><button onClick={()=>{localStorage.setItem('test-locale','am');setLocale('am')}}>Amharic</button><FarmScopeProvider viewerRole={role} todayWorkspaceEnabled={params.get('enabled')!=='false'}>{params.get('handoff')?<ReportAnalyticsHandoff section='feed'><p>Legacy analytics</p></ReportAnalyticsHandoff>:<ReportsWorkspace/>}</FarmScopeProvider></NextIntlClientProvider>}
createRoot(document.getElementById('root')).render(<App/>);
`;
const bundled = await build({stdin: {contents: entry, resolveDir: repo, loader: "tsx"}, bundle: true, write: false, jsx: "automatic", platform: "browser", define: {"process.env.NODE_ENV": '"development"'}, plugins: [{name: "next-test-adapters", setup(builder) {
  builder.onResolve({filter: /^next\/(navigation|link)$/}, args => ({path: args.path, namespace: "mock"}));
  builder.onResolve({filter: /branch-report-workspace$/}, () => ({path: "legacy", namespace: "mock"}));
  builder.onLoad({filter: /.*/, namespace: "mock"}, args => ({contents: args.path === "next/navigation" ? navigation : args.path === "legacy" ? "export function BranchReportWorkspace(){return 'Advanced history workspace'}" : "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}", resolveDir: repo}));
}}]});
const css = await require("postcss")([require("tailwindcss")(path.join(repo, "tailwind.config.ts"))]).process(await readFile(path.join(repo, "src/app/globals.css"), "utf8"), {from: path.join(repo, "src/app/globals.css")});
const browser = await chromium.launch({headless: true});
try {
  for (const viewport of [{width: 768, height: 1024}, {width: 1024, height: 768}]) {
    const page = await browser.newPage({viewport});
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    let reject = false;
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      const role = page.url().includes("role=manager") ? "farm_manager" : "ceo";
      const json = value => route.fulfill({json: value});
      if (url.pathname === "/api/me/context") return json({orgId: "org", userId: role, role});
      if (url.pathname === "/api/scope/options") return json({branches: [], farms: [{id: "farm", name: "Pilot farm", branch_id: "b"}], houses: [{id: "house", name: "Layer house", farm_id: "farm"}], flocks: [{id: "flock", flock_code: "Layer A", farm_id: "farm", house_id: "house", batch_id: "batch"}], batches: [{id: "batch", batch_code: "Pilot batch", farm_id: "farm", house_id: "house", branch_id: "b", status: "active"}]});
      if (url.pathname.startsWith("/api/") && reject) return route.fulfill({status: 403, json: {code: "REPORT_SCOPE_DENIED"}});
      if (url.pathname === "/api/operations-analytics") return json({summary: {current: {eggs: 12345, hdep: 90, marketableRate: 97, recordCoveragePct: 100}}, farms: []});
      if (url.pathname === "/api/feed/control") return json({kpis: {fcr: {value: 1.8}, feedVariance: {actualKg: 200}}, meta: {confidence: "Actual"}});
      if (url.pathname === "/api/mortality/dashboard") return json({summary: {officialDeaths: 7, unexplainedDeaths: 0}, causes: []});
      if (url.pathname === "/api/sales/analytics") return json({kpis: {revenue: 54321, paid: 50000, balanceDue: 4321, estimatedProfit: 4000}, charts: {daily: []}});
      if (url.pathname === "/api/inventory/workspace") return json({warehouses: [{id: "store", name: "Pilot store"}], selectedWarehouse: {name: "Pilot store"}, items: [{name: "Feed", unit: "kg", currentBalance: 987, feedUsage: 13}]});
      if (url.pathname === "/api/reports/evidence") return json({dateFrom: "2026-09-01", dateTo: "2026-09-30", expenseTotal: 1250, items: url.searchParams.get("section") === "health" ? [{kind: "treatment", label: "Vet review", date: "2026-09-20", context: "Layer A"}, {kind: "vaccination", label: "Newcastle", date: "2026-09-21", context: "Layer A"}] : [{kind: "expense", label: "Transport", date: "2026-09-20", context: "Pilot farm", amount: 1250}, {kind: "period", label: "", date: "2026-09-01", endDate: "2026-09-30", status: "locked", context: "Pilot farm", amount: 1250, unallocated: 0, warnings: 0}]});
      return route.fulfill({contentType: "text/html", body: '<html><body><div id="root"></div></body></html>'});
    });
    const mount = async search => {await page.goto(`http://reports.test/app/reports?${search}`); await page.addStyleTag({content: css.css}); await page.addScriptTag({content: bundled.outputFiles[0].text});};
    await mount("role=manager&filter_view=1&filter_page_dateFrom=2026-09-01&filter_page_dateTo=2026-09-30");
    const nav = page.getByRole("navigation", {name: "Report sections"});
    await expect(page.getByText("12,345", {exact: true})).toBeVisible();
    await nav.getByRole("button", {name: "Feed and FCR", exact: true}).click();
    await expect(nav.getByRole("button", {name: "Feed and FCR", exact: true})).toHaveAttribute("aria-pressed", "true");
    await page.locator("label").filter({hasText: /^Batch/}).locator("select").selectOption("batch");
    await expect(page.getByText("1.8 kg/kg", {exact: true})).toBeVisible();
    await nav.getByRole("button", {name: "Health and deaths", exact: true}).click();
    await expect(page.getByText("Treatment · Vet review", {exact: true})).toBeVisible();
    await expect(page.getByText("Vaccination completed · Newcastle", {exact: true})).toBeVisible();
    await nav.getByRole("button", {name: "Stock and usage", exact: true}).click();
    await expect(page.getByText("987 kg", {exact: true})).toBeVisible();
    await nav.getByRole("button", {name: "Sales and finance", exact: true}).click();
    await expect(page.getByText("Expense · Transport", {exact: true})).toBeVisible();
    await expect(page.getByText("Locked", {exact: true})).toBeVisible();
    for (const button of await nav.getByRole("button").all()) assert.ok((await button.boundingBox()).height >= 44);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    reject = true; await page.getByRole("button", {name: "Refresh report", exact: true}).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("Expense · Transport", {exact: true})).toHaveCount(0);
    reject = false; await page.getByRole("button", {name: "Amharic", exact: true}).click();
    await expect(page.getByRole("navigation", {name: "የሪፖርት ክፍሎች"})).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => localStorage.removeItem("test-locale"));
    await mount("role=manager&handoff=1");
    await expect(page.getByText("Legacy analytics", {exact: true})).toHaveCount(0);
    await expect(page.getByRole("link")).toHaveAttribute("href", /filter_page_report=feed/);
    for (const search of ["role=manager&handoff=1&finding=exact", "role=manager&handoff=1&feed_target=feed_history", "role=manager&handoff=1&enabled=false", "handoff=1"]) {
      await mount(search); await expect(page.getByText("Legacy analytics", {exact: true})).toBeVisible();
    }
    await mount("role=manager&enabled=false"); await expect(page.getByText("Advanced history workspace")).toBeVisible();
    assert.deepEqual(errors, []);
    console.log(`PASS: ${viewport.width}x${viewport.height}, five report sections, nonzero evidence, scope handoff, Amharic, errors, correction and rollback.`);
    await page.close();
  }
} finally {await browser.close();}
