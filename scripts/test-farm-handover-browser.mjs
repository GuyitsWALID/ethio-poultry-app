// Presentation checks use real React/intl and mocked transport. SQL integration
// tests independently cover authorization, audit and transaction behavior.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import path from "node:path";
import {readFile} from "node:fs/promises";
const repo=path.resolve(import.meta.dirname,"..");const require=createRequire(path.join(repo,"package.json"));
const {build}=require("esbuild");const {chromium,expect}=require("@playwright/test");
const bundle=await build({stdin:{resolveDir:repo,loader:"tsx",contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {NextIntlClientProvider} from 'next-intl';
import {FarmManagerHandover} from './src/components/farm-manager-handover';import en from './messages/en.json';import am from './messages/am.json';
const locale=new URLSearchParams(location.search).get('locale')||'en';window.changed=0;
createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale={locale} messages={locale==='am'?am:en} timeZone='Africa/Addis_Ababa'><FarmManagerHandover farmId='18000000-0000-4000-8000-000000000006' replacementId='18000000-0000-4000-8000-000000000004' onChanged={()=>window.changed++}/></NextIntlClientProvider>);
`},bundle:true,write:false,platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"'},plugins:[{name:"alias",setup(b){b.onResolve({filter:/^@\//},args=>({path:path.resolve(repo,"src",args.path.slice(2)+".ts")}));}}]});
const css=await require("postcss")([require("tailwindcss")(path.join(repo,"tailwind.config.ts"))]).process(await readFile(path.join(repo,"src/app/globals.css"),"utf8"),{from:path.join(repo,"src/app/globals.css")});
const en=JSON.parse(await readFile(path.join(repo,"messages/en.json"),"utf8"));const am=JSON.parse(await readFile(path.join(repo,"messages/am.json"),"utf8"));
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:768,height:1024},{width:1024,height:768}])for(const locale of ["en","am"]){
    const page=await browser.newPage({viewport});const errors=[];page.on("pageerror",e=>errors.push(e.message));
    const t=(locale==="am"?am:en).WarehouseAccess;let submitted;let stale=true;
    await page.route("**/*",route=>{
      if(route.request().url().includes("/api/governance/assignments/handover")){
        if(route.request().method()==="POST"){
          submitted=route.request().postDataJSON();return route.fulfill({status:stale?409:200,json:stale?{code:"ASSIGNMENT_CHANGED"}:{affected_actions:1}});
        }
        return route.fulfill({json:{farm:{id:"18000000-0000-4000-8000-000000000006",name:"Pilot farm"},current_manager:{name:"Outgoing manager"},replacement_manager:{name:"Replacement manager"},assignment_id:"18000000-0000-4000-8000-000000000020",revision:"a".repeat(32),warehouses:[{id:"store",name:"Farm feed store",status:"active"}],unfinished_actions:[{id:"task",title:"Review feed use",status:"escalated",due_at:"2026-10-05T12:00:00Z"}]}});
      }
      return route.fulfill({contentType:"text/html",body:'<html><body><div id="root"></div></body></html>'});
    });
    await page.goto(`http://handover.test/?locale=${locale}`);await page.addStyleTag({content:css.css});await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.getByRole("button",{name:t.preview,exact:true}).click();
    await expect(page.getByText("Farm feed store",{exact:true})).toBeVisible();
    await expect(page.getByText(/Review feed use/)).toContainText((locale==="am"?am:en).Notifications.status.escalated);
    assert.doesNotMatch(await page.locator("body").innerText(),/[a-f0-9]{8}-[a-f0-9]{4}-/i);
    const apply=page.getByRole("button",{name:t.replace,exact:true});await expect(apply).toBeDisabled();
    await page.getByRole("textbox").fill("Confirmed immediate manager handover");await page.getByRole("checkbox").check();
    assert.ok(await apply.evaluate(el=>el.getBoundingClientRect().height)>=44);
    await apply.click();await expect(page.getByRole("alert")).toHaveText(t.changed);assert.equal(await page.evaluate(()=>window.changed),0);
    assert.equal(submitted.confirmed,true);assert.equal(submitted.revision,"a".repeat(32));
    stale=false;await page.getByRole("button",{name:t.preview,exact:true}).click();await page.getByRole("checkbox").check();await apply.click();
    await expect(page.getByRole("checkbox")).toHaveCount(0);assert.equal(await page.evaluate(()=>window.changed),1);assert.deepEqual(errors,[]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.close();
    console.log(`PASS handover ${locale} ${viewport.width}x${viewport.height}`);
  }
}finally{await browser.close();}
