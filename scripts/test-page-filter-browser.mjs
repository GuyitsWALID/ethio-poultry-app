// Isolated browser regression: real filter components, mocked navigation and scoped APIs.
// Run from the repository: node scripts/test-page-filter-browser.mjs
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import path from "node:path";
const repo = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(repo, "package.json"));
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");
const navigation = `
import {useSyncExternalStore} from 'react';
const subscribe = cb => {window.addEventListener('routechange', cb); return () => window.removeEventListener('routechange', cb)};
export const usePathname = () => useSyncExternalStore(subscribe,()=>location.pathname,()=>'/app/ceo');
export const useSearchParams = () => new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));
`;
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {FarmScopeProvider,useFarmScope} from './src/components/farm-scope-context';
import {FarmScopeFilters} from './src/components/farm-scope-filters';
import {usePageFilter} from './src/components/page-filter-controls';
import {usePathname} from 'next/navigation';
for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);queueMicrotask(()=>window.dispatchEvent(new Event('routechange')))}}
window.addEventListener('popstate',()=>window.dispatchEvent(new Event('routechange')));
function Content(){const {scope}=useFarmScope();const [query,setQuery]=usePageFilter('query','');return <><FarmScopeFilters showPeriod/><label>Search<input value={query} onChange={e=>setQuery(e.target.value)}/></label><output data-testid="farm">{scope.farmId}</output></>}
function App(){const path=usePathname();return <><button onClick={()=>history.pushState(null,'','/app/health')}>Health</button><button onClick={()=>history.pushState(null,'','/app/ceo')}>CEO</button><span data-testid="route">{path}</span><FarmScopeProvider><Content/></FarmScopeProvider></>}
createRoot(document.getElementById('root')).render(<App/>);
`;
const bundled = await build({stdin:{contents:entry,resolveDir:repo,loader:"tsx"},bundle:true,write:false,jsx:"automatic",platform:"browser",define:{"process.env.NODE_ENV":'"development"'},plugins:[{name:"navigation",setup(builder){builder.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"mock"}));builder.onLoad({filter:/.*/,namespace:"mock"},()=>({contents:navigation,resolveDir:repo}));}}]});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on("pageerror",error=>{errors.push(error.message);console.error(error.message)});page.on("console",message=>{if(message.type()==="error")console.error(message.text())});
let userId="ceo-a";
await page.route("**/*",async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==="/api/me/context")return route.fulfill({json:{orgId:"org-a",userId,role:"ceo"}});
  if(url.pathname==="/api/scope/options")return route.fulfill({json:{branches:[{id:"branch-a",name:"North"}],farms:[{id:"farm-a",name:"Uno",branch_id:"branch-a"},{id:"farm-b",name:"Duo",branch_id:"branch-a"}],houses:[],flocks:[],batches:[]}});
  return route.fulfill({contentType:"text/html",body:'<html><body><div id="root"></div></body></html>'});
});
const farm=page.locator('label').filter({hasText:/^Farm/}).locator('select');
const mount=async url=>{await page.goto(url);await page.addScriptTag({content:bundled.outputFiles[0].text});await farm.waitFor({timeout:10000}).catch(async error=>{console.log(await page.locator('body').innerText());throw error});};
await mount("http://filters.test/app/ceo");
await farm.selectOption("farm-a");await page.getByLabel("Search",{exact:true}).fill("Layer A");
await page.waitForFunction(()=>location.search.includes('filter_farmId=farm-a')&&location.search.includes('filter_page_query=Layer'));
await page.getByRole("button",{name:"Health",exact:true}).click();await farm.waitFor();
assert.equal(await farm.inputValue(),"");assert.equal(await page.getByLabel("Search",{exact:true}).inputValue(),"");
await farm.selectOption("farm-b");await page.waitForFunction(()=>location.search.includes('filter_farmId=farm-b'));
await page.getByRole("button",{name:"CEO",exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="farm"]')?.textContent==='farm-a');
assert.equal(await page.getByLabel("Search",{exact:true}).inputValue(),"Layer A");
const savedUrl=page.url();await mount(savedUrl);assert.equal(await farm.inputValue(),"farm-a");
await page.getByRole("button",{name:"Reset filters",exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="farm"]')?.textContent==='');
assert.equal(await page.getByLabel("Search",{exact:true}).inputValue(),"");
await page.goBack();await page.waitForFunction(()=>location.pathname==='/app/health'&&document.querySelector('[data-testid="farm"]')?.textContent==='farm-b');
await mount("http://filters.test/app/ceo?finding=check-b");assert.equal(await farm.inputValue(),"");
await farm.selectOption("farm-a");await page.waitForFunction(()=>location.search.includes('filter_farmId=farm-a'));
userId="ceo-b";await mount("http://filters.test/app/ceo");assert.equal(await farm.inputValue(),"");
assert.deepEqual(errors,[]);
console.log("PASS: actual provider in Chromium — page isolation, reload, reset, Back, alert destination, user isolation; no runtime errors.");
await browser.close();
