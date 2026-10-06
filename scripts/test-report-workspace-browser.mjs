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
const router={push:url=>history.pushState(null,'',url)};export const useRouter=()=>router;
`;
const entry = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {NextIntlClientProvider} from 'next-intl';
import {FarmScopeProvider} from './src/components/farm-scope-context';
import {ReportsWorkspace} from './src/components/reports/consolidated-report-workspace';
import {ReportAnalyticsHandoff} from './src/components/reports/report-analytics-handoff';
import FeedControlPage from './src/app/app/feeding-log/page';
import {AppSidebar} from './src/components/app-sidebar';
import en from './messages/en.json';import am from './messages/am.json';
for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);queueMicrotask(()=>window.dispatchEvent(new Event('routechange')))}}
const params=new URLSearchParams(location.search);const role=params.get('role')==='manager'?'farm_manager':'ceo';
function App(){const [locale,setLocale]=useState(localStorage.getItem('test-locale')||'en');return <NextIntlClientProvider locale={locale} messages={locale==='am'?am:en} timeZone='Africa/Addis_Ababa'><button onClick={()=>{localStorage.setItem('test-locale','am');setLocale('am')}}>Amharic</button><FarmScopeProvider viewerRole={role} todayWorkspaceEnabled={params.get('enabled')!=='false'}>{params.get('sidebar')?<AppSidebar viewerRole={role} todayWorkspaceEnabled={params.get('enabled')!=='false'} mobileOpen/>:params.get('legacyFeed')?<FeedControlPage/>:params.get('handoff')?<ReportAnalyticsHandoff section='feed'><p>Legacy analytics</p></ReportAnalyticsHandoff>:<ReportsWorkspace/>}</FarmScopeProvider></NextIntlClientProvider>}
createRoot(document.getElementById('root')).render(<App/>);
`;
const bundled = await build({stdin: {contents: entry, resolveDir: repo, loader: "tsx"}, bundle: true, write: false, jsx: "automatic", platform: "browser", define: {"process.env.NODE_ENV": '"development"'}, plugins: [{name: "next-test-adapters", setup(builder) {
  builder.onResolve({filter: /^next\/(navigation|link)$/}, args => ({path: args.path, namespace: "mock"}));
  builder.onResolve({filter: /branch-report-workspace$/}, () => ({path: "legacy", namespace: "mock"}));
  builder.onResolve({filter: /\/(record-check-correction-banner|farm-scope-filters|sign-out-button)$/}, args => ({path: args.path.split('/').at(-1), namespace: "stub"}));
  builder.onLoad({filter: /.*/, namespace: "stub"}, args => ({contents: `export function ${args.path === 'record-check-correction-banner' ? 'RecordCheckCorrectionBanner' : args.path === 'farm-scope-filters' ? 'FarmScopeFilters' : 'SignOutButton'}(){return null}`, resolveDir: repo}));
  builder.onLoad({filter: /.*/, namespace: "mock"}, args => ({contents: args.path === "next/navigation" ? navigation : args.path === "legacy" ? "export function BranchReportWorkspace(){return 'Advanced history workspace'}" : "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}", resolveDir: repo}));
}}]});
const css = await require("postcss")([require("tailwindcss")(path.join(repo, "tailwind.config.ts"))]).process(await readFile(path.join(repo, "src/app/globals.css"), "utf8"), {from: path.join(repo, "src/app/globals.css")});
const browser = await chromium.launch({headless: true});
// Authorized metadata fixtures only. No writes; real Feed and Sidebar renderers.
function feedFixture(batchId) {
  const name = batchId === 'old-batch' ? 'Historical feed plan' : 'Current feed plan';
  const row = {week_number: 1, age_day_start: 7, age_day_end: 13, feed_intake_std_g_per_head: 90, feed_intake_recommended_g_per_head: 95, target_weight_min_g: 300, target_weight_max_g: 400, feed_type_plan: 'layer_feed', light_on_time: '06:00', light_off_time: '18:00'};
  const metric = {value: 100, unit: '%', status: 'Available'};
  return {
    meta: {batchId, today: '2026-10-06', dateFrom: '2026-10-01', dateTo: '2026-10-06', refreshedAt: '2026-10-06T08:00:00Z', confidence: 'Actual', sources: {}},
    batch: {batch_code: batchId === 'old-batch' ? 'Old batch' : 'Pilot batch', ageDays: 10, totalBirds: 100, flockTypes: ['layer']},
    today: {flocks: [{id: 'flock', flock_code: 'Layer A', flock_type: 'layer', current_count: 100, plannedKg: 9, actualKg: 0, varianceKg: -9, variancePct: -100, closeStatus: 'open', sessions: [{id: null, session_name: 'First feeding', session_time: '07:00', planned_feed_kg: 9, actual_feed_kg: null, feeders_count: 1, status: 'planned', feed_item_id: null, warehouse_id: null, feed_type: 'layer_feed', notes: null}]}]},
    kpis: {planCompletion: metric, feedVariance: metric, feedPerBirdDay: metric, stockCover: metric, weight: metric, fcr: metric, coverage: {...metric, coveredDays: 1, expectedDays: 1, legacyDays: 0}},
    trends: {daily: [{date: '2026-10-06', plannedKg: 9, actualKg: 0, openingBirds: 100, source: 'sessions'}]},
    inventory: {balances: [], totalOnHand: 0, estimatedValue: 0}, financials: {feedCostEtb: 0, costCoveragePct: 100, leftoversKg: 0, leftoverPct: 0, confidence: 'Actual'},
    template: {id: 'plan', name, source_type: 'manual', rows: [row], currentTarget: row}, templateVersions: [{id: 'version', name, source_type: 'manual', is_active: true, created_at: '2026-10-01T08:00:00Z'}], suggestedRows: [row],
    tasks: [], milestones: [], nextCheck: {displayStatus: 'None'}, exceptions: [], settings: {warningVariancePct: 5, criticalVariancePct: 10},
    permissions: {canManage: true, canConfigure: false, canRecordWeight: false, templateChangeMode: 'governance'},
  };
}
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
      if (url.pathname === "/api/scope/options") return json({branches: [], farms: [{id: "farm", name: "Pilot farm", branch_id: "b"}], houses: [{id: "house", name: "Layer house", farm_id: "farm"}], flocks: [{id: "flock", flock_code: "Layer A", farm_id: "farm", house_id: "house", batch_id: "batch"}], batches: [{id: "batch", batch_code: "Pilot batch", farm_id: "farm", house_id: "house", branch_id: "b", status: "active"}, {id: 'old-batch', batch_code: 'Old batch', farm_id: 'farm', house_id: 'house', branch_id: 'b', status: 'closed'}]});
      if (url.pathname.startsWith("/api/") && reject) return route.fulfill({status: 403, json: {code: "REPORT_SCOPE_DENIED"}});
      if (url.pathname === "/api/operations-analytics") return json({summary: {current: {eggs: 12345, hdep: 90, marketableRate: 97, recordCoveragePct: 100}}, farms: []});
      if (url.pathname === "/api/feed/control") return json(page.url().includes('legacyFeed') ? feedFixture(url.searchParams.get('batch_id')) : {kpis: {fcr: {value: 1.8}, feedVariance: {actualKg: 200}}, meta: {confidence: "Actual"}});
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
    await mount('role=manager&sidebar=1');
    const primary = page.getByRole('navigation', {name: 'Primary navigation'});
    await expect(primary.getByRole('link', {name: 'Today', exact: true})).toBeVisible();
    await expect(primary.getByRole('link', {name: 'Manager Dashboard', exact: true})).toHaveCount(0);
    await mount('role=manager&sidebar=1&enabled=false');
    await expect(primary.getByRole('link', {name: 'Manager Dashboard', exact: true})).toBeVisible();
    await expect(primary.getByRole('link', {name: 'Today', exact: true})).toHaveCount(0);
    await mount('sidebar=1');
    await expect(primary.getByRole('link', {name: 'Command Center', exact: true})).toBeVisible();
    const feedQuery = 'role=manager&legacyFeed=1&filter_view=1&filter_batchId=batch';
    await mount(feedQuery);
    await expect(page.getByRole('link', {name: "Open today's feeding", exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Add session', exact: true})).toHaveCount(0);
    await page.getByRole('button', {name: /Template management and versions/}).click();
    await expect(page.getByRole('textbox', {name: 'Template name', exact: true})).toHaveValue('Current feed plan');
    await expect(page.getByRole('button', {name: 'Submit template for CEO approval'})).toBeVisible();
    for (const target of ['feed_target=template_management', 'governance_request=exact&feed_target=template_management', 'finding=exact&feed_target=today_sessions', 'feed_target=feed_history']) {
      await mount(`role=manager&legacyFeed=1&filter_view=1&filter_batchId=old-batch&${target}`);
      await expect(page.locator('header select')).toHaveValue('old-batch');
      await expect(page.locator('#feed-template-management')).toContainText('Historical feed plan');
      if (target.includes('template_management')) await expect(page.getByRole('textbox', {name: 'Template name', exact: true})).toHaveValue('Historical feed plan');
      if (target.includes('finding=')) await expect(page.getByRole('button', {name: 'Add session', exact: true})).toBeVisible();
      if (target === 'feed_target=feed_history') await expect(page.locator('#feed-history details')).toHaveAttribute('open', '');
    }
    await mount(`${feedQuery}&enabled=false`);
    await expect(page.getByRole('button', {name: 'Add session', exact: true})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Control metrics', exact: true})).toBeVisible();
    await expect(page.getByRole('link', {name: "Open today's feeding", exact: true})).toHaveCount(0);
    assert.deepEqual(errors, []);
    console.log(`PASS: ${viewport.width}x${viewport.height}, reports, Amharic, Feed configuration/exact historical targets, routine-entry and navigation rollback.`);
    await page.close();
  }
} finally {await browser.close();}
