// Actual React/intl/scope/History renderers with mocked transport and Next routing.
// Authorization is covered separately; this runner makes no staging-auth claim.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
const repo = path.resolve(import.meta.dirname, ".."), require = createRequire(path.join(repo, "package.json"));
const {build} = require("esbuild"), {chromium, expect} = require("@playwright/test");
const navigation = `import {useSyncExternalStore} from 'react';const subscribe=cb=>{window.addEventListener('routechange',cb);return()=>window.removeEventListener('routechange',cb)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname,()=>'/app/history');export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));const router={push:url=>history.pushState(null,'',url)};export const useRouter=()=>router;`;
const entry = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {NextIntlClientProvider} from 'next-intl';import {usePathname} from 'next/navigation';import {FarmScopeProvider} from './src/components/farm-scope-context';import {HistoryWorkspace} from './src/components/history/history-workspace';import {HistoryReturn} from './src/components/history/history-return';import {AppSidebar} from './src/components/app-sidebar';import en from './messages/en.json';import am from './messages/am.json';for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);queueMicrotask(()=>window.dispatchEvent(new Event('routechange')))}}const params=new URLSearchParams(location.search),role=params.get('role')==='ceo'?'ceo':params.get('role')==='admin'?'system_admin':'farm_manager',enabled=params.get('enabled')!=='false',sidebar=params.has('sidebar');function App(){const [locale,setLocale]=useState('en'),pathname=usePathname();return <NextIntlClientProvider locale={locale} messages={locale==='am'?am:en} timeZone='Africa/Addis_Ababa'><button id='language' onClick={()=>setLocale(locale==='en'?'am':'en')}>Language</button><FarmScopeProvider viewerRole={role} todayWorkspaceEnabled={enabled}>{sidebar?<AppSidebar viewerRole={role} todayWorkspaceEnabled={enabled} mobileOpen/>:pathname==='/app/governance'?<HistoryReturn/>:<main style={{padding:20}}><HistoryWorkspace/></main>}</FarmScopeProvider></NextIntlClientProvider>}createRoot(document.getElementById('root')).render(<App/>);`;
const bundled = await build({stdin:{contents:entry,resolveDir:repo,loader:"tsx"},bundle:true,write:false,jsx:"automatic",platform:"browser",define:{"process.env.NODE_ENV":'"development"'},plugins:[{name:"history-test-next",setup(builder){
  builder.onResolve({filter:/^next\/(navigation|link)$/},args=>({path:args.path,namespace:"mock"}));
  builder.onResolve({filter:/\/sign-out-button$/},()=>({path:"sign-out",namespace:"mock"}));
  builder.onLoad({filter:/.*/,namespace:"mock"},args=>({contents:args.path==="next/navigation"?navigation:args.path==="sign-out"?"export function SignOutButton(){return null}":"import React from 'react';import {useRouter} from 'next/navigation';export default function Link({children,...props}){const router=useRouter();return <a {...props} onClick={event=>{event.preventDefault();router.push(props.href)}}>{children}</a>}",loader:"tsx",resolveDir:repo}));
}}]});
const css = await require("postcss")([require("tailwindcss")(path.join(repo,"tailwind.config.ts"))]).process(await readFile(path.join(repo,"src/app/globals.css"),"utf8"),{from:path.join(repo,"src/app/globals.css")});
const html=`<!doctype html><html lang="en"><head><style>${css.css}</style></head><body><div id="root"></div><script>${bundled.outputFiles[0].text}</script></body></html>`;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`, farm=uuid(1),house=uuid(2),flock=uuid(3),batch=uuid(4),store=uuid(5);
const options={farms:[{id:farm,name:"Pilot farm"}],houses:[{id:house,name:"Old house",farmId:farm}],flocks:[{id:flock,name:"Archived flock",farmId:farm,houseId:house,batchId:batch}],batches:[{id:batch,name:"Previous batch",farmId:farm,houseId:house}],warehouses:[{id:store,name:"Farm warehouse",farmId:farm}]};
const item={kind:"daily_record",id:uuid(100),date:"2026-10-17",context:"Pilot farm · Old house · Archived flock",status:"recorded",summary:[{key:"opening_birds",value:100,format:"number"}]};
const detail={...item,fields:[{key:"opening_birds",value:100,format:"number"},{key:"closing_birds",value:98,format:"number"},{key:"water_consumed_liters",value:null,format:"number",unit:"L"}],supporting:[],correctionHref:`/app/governance?source_id=${item.id}&correction_route=${encodeURIComponent(`/app/daily-records?record=${item.id}`)}`};
const browser=await chromium.launch({headless:true});
try {
  for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:1024,height:768}]){
    const page=await browser.newPage({viewport}),errors=[],methods=[];let failMore=true,deny=false,empty=false;
    page.on("pageerror",error=>errors.push(error.message));
    await page.route("http://history.test/**",async route=>{
      const request=route.request(),url=new URL(request.url());methods.push(request.method());
      const json=(body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
      if(url.pathname==="/api/me/context")return json({orgId:uuid(10),userId:uuid(11),role:"farm_manager",todayWorkspaceEnabled:true,orgName:"Pilot"});
      if(url.pathname==="/api/scope/options")return json({branches:[],farms:[{id:farm,name:"Pilot farm",branch_id:uuid(9)}],houses:[{id:house,name:"Old house",farm_id:farm}],flocks:[{id:flock,flock_code:"Archived flock",farm_id:farm,house_id:house,batch_id:batch}],batches:[{id:batch,batch_code:"Previous batch",farm_id:farm,house_id:house,status:"archived"}]});
      if(url.pathname.startsWith("/api/history/records/"))return deny?json({code:"UNAVAILABLE"},404):json(detail);
      if(url.pathname==="/api/history/records"){
        if(deny)return json({code:"ACCESS_DENIED"},403);
        if(url.searchParams.has("cursor"))return failMore?json({code:"LOAD_FAILED"},503):json({items:[{...item,id:uuid(101)}],nextCursor:null,options});
        return json({items:empty?[]:[item],nextCursor:empty?null:"next",options});
      }
      return route.fulfill({contentType:"text/html",body:html});
    });
    await page.goto("http://history.test/app/history");
    await expect(page.getByRole("button",{name:/View details/})).toBeVisible();
    assert.equal(await page.locator("body").evaluate(el=>el.scrollWidth<=innerWidth),true,"no horizontal overflow");
    await page.getByRole("button",{name:/View details/}).click();
    const panel=page.locator("article").filter({has:page.getByRole("button",{name:/View details/})}).getByRole("region",{name:"Selected record"});
    await expect(page.getByRole("complementary",{name:"Selected record"})).toHaveCount(0);
    await expect(page.getByRole("region",{name:"Selected record"})).toHaveCount(1);
    await expect(panel.getByText("Birds at the end",{exact:true})).toBeVisible();
    await expect(panel.getByText("Unavailable",{exact:true})).toBeVisible();
    const url=page.url();assert.ok(url.includes("history_record="));
    await page.getByRole("button",{name:"Load more records"}).click();
    await expect(page.getByRole("button",{name:"Retry loading more"})).toBeVisible();
    await expect(page.getByRole("button",{name:/View details/})).toHaveCount(1);
    failMore=false;await page.getByRole("button",{name:"Retry loading more"}).click();
    await expect(page.getByRole("button",{name:/View details/})).toHaveCount(2);
    const rows=page.locator("article");
    // Reproduce selecting an older record well below the top of a long list.
    await rows.nth(0).evaluate(element=>{element.style.minHeight="1400px";});
    await rows.nth(1).getByRole("button",{name:/View details/}).scrollIntoViewIfNeeded();
    const beforeExpand=await page.evaluate(()=>scrollY);
    assert.ok(beforeExpand>0);
    await rows.nth(1).getByRole("button",{name:/View details/}).click();
    await expect(rows.nth(0).getByRole("region",{name:"Selected record"})).toHaveCount(0);
    await expect(rows.nth(1).getByRole("region",{name:"Selected record"})).toBeVisible();
    await expect(rows.nth(1).getByRole("region",{name:"Selected record"})).toBeInViewport();
    assert.ok(await page.evaluate(()=>scrollY)>=beforeExpand-8,"opening older details must not jump back to the top");
    await rows.nth(1).getByRole("button",{name:/View details/}).click();
    await expect(page.getByRole("region",{name:"Selected record"})).toHaveCount(0);
    await rows.nth(0).evaluate(element=>{element.style.removeProperty("min-height");});
    await rows.nth(0).getByRole("button",{name:/View details/}).click();
    await page.getByRole("link",{name:"Request a correction"}).filter({visible:true}).click();
    assert.equal(new URL(page.url()).searchParams.get("source_id"),item.id);
    await page.getByRole("link",{name:"Back to History"}).click();
    assert.equal(new URL(page.url()).searchParams.get("history_record"),item.id);
    await expect(page.getByText("Birds at the end",{exact:true}).filter({visible:true})).toBeVisible();
    await page.locator("#language").click();
    await expect(page.getByRole("heading",{name:"ታሪክ",exact:true})).toBeVisible();
    const expected=await page.evaluate(date=>new Intl.DateTimeFormat("am-ET",{calendar:"ethiopic",timeZone:"Africa/Addis_Ababa",dateStyle:"medium"}).format(new Date(date)),item.date);
    await expect(page.getByText(expected,{exact:true}).filter({visible:true}).first()).toBeVisible();
    await page.locator("#language").click();
    await page.evaluate(()=>{Object.defineProperty(navigator,"onLine",{configurable:true,value:false});window.dispatchEvent(new Event("offline"));});
    await expect(page.getByText(/History needs an internet connection/)).toBeVisible();
    await expect(page.getByText("Birds at the end",{exact:true}).filter({visible:true})).toHaveCount(0);
    deny=true;await page.evaluate(()=>{Object.defineProperty(navigator,"onLine",{configurable:true,value:true});window.dispatchEvent(new Event("online"));});
    await expect(page.getByText(/outside your current assignment/)).toBeVisible();
    await expect(page.getByText("Birds at the end",{exact:true}).filter({visible:true})).toHaveCount(0);
    deny=false;empty=true;await page.getByRole("button",{name:"Refresh",exact:true}).first().click();
    await expect(page.getByText(/No records match these filters/)).toBeVisible();
    assert.ok(methods.every(method=>method==="GET"));assert.deepEqual(errors,[]);
    await page.close();console.log(`History presentation passed ${viewport.width}x${viewport.height}`);
  }
  for(const role of ["manager","ceo","admin"])for(const enabled of [true,false]){
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.route("http://history.test/**",route=>{const url=new URL(route.request().url());if(url.pathname==="/api/me/context")return route.fulfill({contentType:"application/json",body:JSON.stringify({orgId:uuid(10),userId:uuid(11)})});if(url.pathname==="/api/scope/options")return route.fulfill({contentType:"application/json",body:JSON.stringify({branches:[],farms:[],houses:[],flocks:[],batches:[]})});return route.fulfill({contentType:"text/html",body:html});});
    await page.goto(`http://history.test/app/history?sidebar=1&role=${role}&enabled=${enabled}`);
    await expect(page.getByRole("link",{name:"History",exact:true})).toHaveCount(enabled&&role!=="admin"?1:0);
    if(enabled&&role==="manager"){
      for(const name of ["Today","Flocks","Alerts","History","Reports","Approvals","Record Checks","Feed templates"])await expect(page.getByRole("link",{name,exact:true})).toHaveCount(1);
      await expect(page.getByRole("link",{name:"Daily Records",exact:true})).toHaveCount(0);
    }
    await page.close();
  }
  console.log("History sidebar rollout/role contracts passed");
} finally {await browser.close();}
