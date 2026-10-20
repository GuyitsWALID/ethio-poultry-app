// Real React/Recharts/intl/scope components, fixture transport. Not staging acceptance.
import assert from "node:assert/strict";
import {readFile, mkdir} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
const repo = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(repo, "package.json"));
const {build} = require("esbuild"), {chromium, expect} = require("@playwright/test");
const navigation = `import {useSyncExternalStore} from 'react';const subscribe=cb=>{window.addEventListener('routechange',cb);window.addEventListener('popstate',cb);return()=>{window.removeEventListener('routechange',cb);window.removeEventListener('popstate',cb)}};export const usePathname=()=>'/app/reports';export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));export const useRouter=()=>({push:url=>history.pushState(null,'',url)});`;
// Use the real locale provider, then reproduce a retained pre-upgrade context
// that has every older namespace but not FarmPerformance.
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {NextIntlClientProvider,useMessages,useLocale} from 'next-intl';import {LocaleProvider,setDeviceLocale} from './src/i18n/locale-provider';import {FarmScopeProvider} from './src/components/farm-scope-context';import {ReportsWorkspace} from './src/components/reports/consolidated-report-workspace';for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);queueMicrotask(()=>window.dispatchEvent(new Event('routechange')))}};const params=new URLSearchParams(location.search);function OlderContext({children}){const messages={...useMessages()};delete messages.FarmPerformance;return <NextIntlClientProvider locale={useLocale()} messages={messages}>{children}</NextIntlClientProvider>}function App(){return <LocaleProvider initialLocale='en'><button style={{minHeight:48}} onClick={()=>setDeviceLocale('am')}>Amharic</button><OlderContext><FarmScopeProvider viewerRole={params.get('role')==='ceo'?'ceo':'farm_manager'} todayWorkspaceEnabled={params.get('enabled')!=='false'}><ReportsWorkspace/></FarmScopeProvider></OlderContext></LocaleProvider>}createRoot(document.getElementById('root')).render(<App/>);`;
const bundle = await build({stdin: {contents: entry, resolveDir: repo, loader: "tsx"}, bundle: true, write: false, jsx: "automatic", platform: "browser", define: {"process.env.NODE_ENV": '"development"'}, plugins: [{name: "browser-transport", setup(builder) {
  builder.onResolve({filter: /^next\/(navigation|link)$/}, args => ({path: args.path, namespace: "mock"}));
  builder.onResolve({filter: /branch-report-workspace$/}, () => ({path: "legacy", namespace: "mock"}));
  builder.onLoad({filter: /.*/, namespace: "mock"}, args => ({contents: args.path === "next/navigation" ? navigation : args.path === "legacy" ? "import React from 'react';export function BranchReportWorkspace(){return React.createElement('p',null,'Legacy report workspace')}" : "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}", resolveDir: repo}));
}}]});
const css = await require("postcss")([require("tailwindcss")(path.join(repo, "tailwind.config.ts"))]).process(await readFile(path.join(repo, "src/app/globals.css"), "utf8"), {from: path.join(repo, "src/app/globals.css")});
const metric = (key, value, unit) => ({key, value, unit, previous: value === null ? null : value - 1, delta: value === null ? null : 1, deltaPct: null, state: value === null ? "missing" : "available", explanation: "RECORDED_TOTAL"});
const series = (key, unit) => ({key, unit, points: [{date: "2026-10-01", value: 100}, {date: "2026-10-02", value: null}, {date: "2026-10-03", value: 120}]});
const section = (metrics, series = [], rows = []) => ({state: "available", metrics, series, rows, coverage: {recorded: 2, expected: 3, percent: 66.67}, explanations: ["PARTIAL_DAILY_RECORDS"], evidenceHref: "/app/history?filter_page_history_from=2026-10-01"});
const fixture = {
  schemaVersion: 1, meta: {dateFrom: "2026-10-01", dateTo: "2026-10-03", previousFrom: "2026-09-28", previousTo: "2026-09-30", days: 3, scopeLabel: "Pilot farm", timezone: "Africa/Addis_Ababa", generatedAt: "2026-10-04T00:00:00Z"}, options: {warehouses: [{id: "store", name: "Pilot store"}]},
  concerns: [{key: "productionDown", severity: "watch", evidenceHref: "/app/history"}],
  sections: {
    production: {...section([metric("eggs", 12345, "eggs"), metric("hdep", 82, "%")], [series("eggs", "eggs"), series("hdep", "%"), series("hdepTarget", "%")], [{label: "Broiler A", unit: "g", date: "2026-09-20", values: {primary: 1800, target: 2000, latestWeightG: 1800}, evidenceHref: "/app/history?history_kind=weight_record"}]), breakdowns: [{key: "eggQuality", unit: "eggs", rows: [{label: "Normal eggs", value: 12000}]}]},
    feeding: section([metric("sessionActualKg", 200, "kg"), metric("layerFcr", null, "kg/kg")], [series("session_actual", "kg"), series("session_planned", "kg")], [{label: "Third feeding", date: "2026-10-03", unit: "kg", values: {actual: 20, planned: 18}, evidenceHref: "/app/history?history_kind=feed_session"}]),
    health: section([metric("deaths", 7, "birds"), metric("culls", 2, "birds")], [series("deaths", "birds"), series("culls", "birds")], [{label: "Vet review", date: "2026-10-03", values: {events: 1}}]),
    stock: section([metric("currentLowStockItems", 1, "items")], [], [{label: "Layer feed", context: "Pilot store", unit: "kg", values: {opening: 200, periodEnd: 187, current: 190, received: 30, consumption: 43, estimatedPeriodEndValue: 3000}}, {label: "Medicine", context: "Pilot store", unit: "bottle", values: {opening: 10, periodEnd: 8, current: 8, received: 0, consumption: 2}}]),
    salesCosts: {...section([metric("revenue", 54321, "ETB"), metric("paid", 50000, "ETB"), metric("expenses", 1250, "ETB"), metric("estimatedProfit", null, "ETB")], [series("revenue", "ETB"), series("paid", "ETB")], [{label: "Transport", unit: "ETB", date: "2026-10-02", values: {amount: 1250}}]), breakdowns: [{key: "expenseCategories", unit: "ETB", rows: [{label: "Transport", value: 1250}]}]},
  },
};
const browser = await chromium.launch({headless: true});
try {
  for (const viewport of [{width: 768, height: 1024}, {width: 1024, height: 768}]) {
    const page = await browser.newPage({viewport, reducedMotion: "reduce"});
    const errors = [], requests = [];
    page.on("pageerror", error => {errors.push(error.message); console.error(error.message);});
    let denied = false;
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      assert.equal(request.method(), "GET", "Browsing must not mutate business records");
      if (url.pathname === "/api/me/context") return route.fulfill({json: {orgId: "org", userId: "manager", role: "farm_manager"}});
      if (url.pathname === "/api/scope/options") return route.fulfill({json: {branches: [{id: "b", name: "Main branch"}], farms: [{id: "farm", name: "Pilot farm", branch_id: "b"}, {id: "other", name: "Other farm", branch_id: "b"}], houses: [{id: "house", name: "Layer house", farm_id: "farm"}], flocks: [{id: "flock", flock_code: "Layer A", farm_id: "farm", house_id: "house", batch_id: "batch"}], batches: [{id: "batch", batch_code: "Pilot batch", branch_id: "b", farm_id: "farm", house_id: "house"}]}});
      if (url.pathname === "/api/reports/performance") {requests.push(url); return route.fulfill(denied ? {status: 403, json: {code: "REPORT_SCOPE_DENIED"}} : {json: fixture});}
      if (url.pathname === "/api/reports/management") return route.fulfill({json: {runs: [], nextCursor: null, currentUserId: "manager", capabilities: {canSchedule: false, canGenerate: false}, schedules: [], recipients: []}});
      return route.fulfill({contentType: "text/html", body: '<html><body><div id="root"></div></body></html>'});
    });
    const mount = async search => {await page.goto(`http://performance.test/app/reports?${search}`); await page.addStyleTag({content: css.css}); await page.addScriptTag({content: bundle.outputFiles[0].text});};
    await mount("filter_view=1&filter_page_dateFrom=2026-10-01&filter_page_dateTo=2026-10-03");
    const nav = page.getByRole("navigation", {name: "Farm performance", exact: true});
    await expect(page.getByRole("heading", {name: "Farm performance", exact: true})).toBeVisible();
    await expect(page.getByText("12,345", {exact: false}).first()).toBeVisible();
    await expect(page.getByText("Egg production fell against the previous period")).toBeVisible();
    assert.equal(requests[0].searchParams.has("batch_id"), false);
    for (const name of ["Production", "Feeding", "Health", "Stock", "Sales & costs"]) {
      await nav.getByRole("button", {name, exact: true}).click();
      await expect(nav.getByRole("button", {name, exact: true})).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("img").first()).toBeVisible();
      await page.getByText("Show supporting figures", {exact: true}).click();
      await expect(page.getByText(name === "Production" ? "Broiler A" : name === "Feeding" ? "Third feeding" : name === "Health" ? "Vet review" : name === "Stock" ? "Layer feed" : "Transport", {exact: true}).last()).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (name === "Production") await expect(page.getByText(/Some weight measurements are outside/)).toBeVisible();
      if (name === "Feeding") await expect(page.getByRole("link", {name: "Check records"}).first()).toHaveAttribute("href", /feed_session/);
    }
    await nav.getByRole("button", {name: "Stock", exact: true}).click();
    await page.getByRole("combobox", {name: "Warehouse", exact: true}).selectOption("store");
    await expect.poll(() => requests.at(-1).searchParams.get("warehouse_id")).toBe("store");
    await page.getByRole("combobox", {name: "Farm", exact: true}).selectOption("other");
    await expect.poll(() => requests.at(-1).searchParams.get("farm_id")).toBe("other");
    assert.equal(requests.at(-1).searchParams.has("warehouse_id"), false);
    await nav.getByRole("button", {name: "Health", exact: true}).click();
    const healthUrl = page.url();
    await nav.getByRole("button", {name: "Feeding", exact: true}).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("filter_page_performance")).toBe("feeding");
    await page.evaluate(url => {history.pushState(null, "", url); window.dispatchEvent(new PopStateEvent("popstate"));}, healthUrl);
    await expect(nav.getByRole("button", {name: "Health", exact: true})).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(nav.getByRole("button", {name: "Feeding", exact: true})).toHaveAttribute("aria-pressed", "true");
    await page.goForward();
    await expect(nav.getByRole("button", {name: "Health", exact: true})).toHaveAttribute("aria-pressed", "true");
    await nav.getByRole("button", {name: "Saved reports", exact: true}).click();
    await expect(page.getByRole("heading", {name: "Downloadable reports & schedules"})).toBeVisible();
    await nav.getByRole("button", {name: "Production", exact: true}).click();
    for (const button of await nav.getByRole("button").all()) assert.ok((await button.boundingBox()).height >= 48);
    await page.getByText("Show chart figures", {exact: true}).first().focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("table").first()).toBeVisible();
    denied = true; await page.getByRole("button", {name: "Refresh results", exact: true}).click();
    await expect(page.getByRole("alert")).toContainText("Your access changed");
    await expect(page.getByRole("img")).toHaveCount(0);
    denied = false; await page.getByRole("button", {name: "Refresh results", exact: true}).click();
    await expect(page.getByRole("img").first()).toBeVisible();
    await page.context().setOffline(true);
    await expect(page.getByText(/You are offline/)).toBeVisible();
    await expect(page.getByRole("img")).toHaveCount(0);
    await page.context().setOffline(false);
    await expect(page.getByRole("img").first()).toBeVisible();
    await page.getByRole("button", {name: "Amharic", exact: true}).click();
    await expect(page.getByRole("heading", {name: "የእርሻ አፈጻጸም", exact: true})).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mkdir(path.join(repo, "test-results"), {recursive: true});
    await page.screenshot({path: path.join(repo, "test-results", `performance-${viewport.width}.png`), fullPage: true});
    assert.deepEqual(errors, []);
    await mount("enabled=false");
    await expect(page.getByText("Legacy report workspace", {exact: true})).toBeVisible();
    console.log(`PASS ${viewport.width}x${viewport.height}: seven views, charts, inline evidence, scope reset, URL restore, denied/offline, Amharic, reduced motion, 48px navigation; zero business writes.`);
    await page.close();
  }
} finally {await browser.close();}
