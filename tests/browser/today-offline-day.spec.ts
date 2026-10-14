import {test,expect,chromium,firefox,webkit,type Page} from '@playwright/test';
import type {QueuedCommand} from '../../src/lib/today-workspace/offline-store';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test.skip(process.env.E2E_LOCAL_LIFECYCLE!=='true','Requires disposable migrated local runner.');
test('Today complete offline day survives reload and browser restart then closes exactly once online',async({browserName},info)=>{
  const slot=info.project.name==="edge"?5:{chromium:2,firefox:3,webkit:4}[browserName];
  const id=(offset:number)=>`12000000-0000-4000-8000-${String(slot*100+offset).padStart(12,'0')}`;
  const engine={chromium,firefox,webkit}[browserName];
  // Deep test-results paths exceed Windows CacheStorage path limits.
  const profile=await mkdtemp(join(tmpdir(),'ep-offline-'));
  const options={baseURL:process.env.APP_BASE_URL,viewport:{width:768,height:1024},...(info.project.name==="edge"?{channel:"msedge"}:{})};
  let context=await engine.launchPersistentContext(profile,options);
  let page=context.pages()[0]??await context.newPage();
  const destination=`/app/today?farm_id=${id(1)}&flock_id=${id(5)}`;
  const queue=(target:Page)=>target.evaluate(async()=>{
    const name=localStorage.getItem('ethiopoultry.offline_identity');if(!name)throw Error('No offline identity');
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{return await new Promise<QueuedCommand[]>((resolve,reject)=>{const request=db.transaction('outbox').objectStore('outbox').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{db.close();}
  });
  const open=async(code:string)=>{
    const card=page.locator(`#today-task-${code}`);await expect(card.locator('button[aria-expanded]')).toBeVisible();
    if(await card.locator('button[aria-expanded=false]').count())await card.locator('button[aria-expanded]').click();
    return card;
  };
  const feeding=async(name:string,time:string)=>{
    const card=await open('feeding');await card.getByRole('button',{name:'Add feeding',exact:true}).click();
    await card.locator('input[name=session_name]').fill(name);await card.locator('input[name=session_time]').fill(time);
    await card.locator('input[name=planned]').fill('5');await card.locator('input[name=actual]').fill('5');
    await card.locator('select[name=feed_item]').selectOption(id(7));await card.locator('select[name=warehouse]').selectOption(id(6));
    await card.getByRole('button',{name:'Save feeding',exact:true}).click();
    await expect(card.getByRole('button',{name:'Add feeding',exact:true})).toBeVisible();
    await expect(card.locator('input[name=session_name]')).toHaveCount(0);
  };
  try{
    await context.addInitScript(()=>localStorage.setItem('ethiopoultry.today.guide.dismissed.v1','true'));
    await page.goto('/auth/sign-in');
    await page.getByRole('textbox',{name:'Work email',exact:true}).fill(process.env.E2E_FARM_MANAGER_EMAIL!);
    await page.locator('input[name=password]').fill(process.env.E2E_FARM_MANAGER_PASSWORD!);
    await page.getByRole('button',{name:'Open my workspace',exact:true}).click();await expect(page).toHaveURL(/\/app\//);
    await page.goto(destination);
    await expect(page.locator('#today-task-birds')).toBeVisible();
    await expect.poll(()=>page.evaluate(async()=>Boolean(navigator.serviceWorker.controller&&await caches.match('/offline'))),{timeout:90000}).toBe(true);
    console.log(`${info.project.name}: offline shell installed`);
    // Every applicable input form is prepared online, not only the open card.
    await expect.poll(()=>page.evaluate(async()=>{
      const name=localStorage.getItem('ethiopoultry.offline_identity');if(!name)return 0;
      const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);});
      try{return await new Promise<number>(resolve=>{const r=db.transaction('drafts').objectStore('drafts').getAllKeys();r.onsuccess=()=>resolve(r.result.filter(key=>String(key).startsWith('detail:')).length);});}finally{db.close();}
    })).toBeGreaterThanOrEqual(8);
    await context.setOffline(true);
    const birds=await open('birds');await birds.getByRole('button',{name:'Save bird check',exact:true}).click();
    await expect.poll(async()=>(await queue(page)).length).toBe(1);
    await page.reload();await feeding('First','07:00');
    console.log(`${info.project.name}: disconnected reload and first feeding saved`);
    await expect.poll(async()=>(await queue(page)).length).toBe(2);
    const beforeRestart=(await queue(page)).map(row=>row.command.command_id).sort();
    await context.close();
    context=await engine.launchPersistentContext(profile,options);await context.setOffline(true);
    page=context.pages()[0]??await context.newPage();await page.goto(destination);
    await expect.poll(async()=>(await queue(page)).map(row=>row.command.command_id).sort()).toEqual(beforeRestart);
    console.log(`${info.project.name}: browser restart preserved outbox`);
    await feeding('Second','15:00');
    const feed=await open('feeding');await feed.getByRole('button',{name:'Finish feeding for today',exact:true}).click();
    await expect.poll(async()=>(await queue(page)).some(row=>row.command.type==='close_feed_day')).toBe(true);
    const eggs=await open('eggs_water');
    for(const [name,value] of [['water','123'],['normal_eggs','10'],['broken_eggs','1'],['dirty_eggs','1']])await eggs.locator(`input[name=${name}]`).fill(value);
    await eggs.getByRole('button',{name:'Save and continue',exact:true}).click();
    const health=await open('health_deaths');await health.getByRole('checkbox',{name:'No health problem, deaths, or culls',exact:true}).check();
    await health.getByRole('button',{name:'Confirm none today',exact:true}).click();
    const supplies=await open('routine_supplies');await supplies.getByRole('button',{name:'Confirm nothing used',exact:true}).click();
    await expect.poll(async()=>(await queue(page)).length).toBe(7);
    console.log(`${info.project.name}: complete offline day queued`);
    const queued=await queue(page);expect(new Set(queued.map(row=>row.command.command_id)).size).toBe(7);
    const review=await open('review_finish');await expect(review.getByRole('button',{name:'Finish the day',exact:true})).toBeDisabled();
    await context.setOffline(false);
    await expect.poll(async()=>(await queue(page)).length,{timeout:90000}).toBe(0);
    console.log(`${info.project.name}: dependent commands synchronized`);
    await page.goto(destination);
    const date=await page.getByLabel('Work date',{exact:true}).inputValue();
    const response=await page.request.get(`/api/farm-manager/today?farm_id=${id(1)}&date=${date}`);expect(response.status()).toBe(200);
    const workspace=await response.json();expect(workspace.flocks[0].tasks.every((row:{required:boolean;state:string})=>!row.required||row.state==='complete')).toBe(true);
    const final=await open('review_finish');await expect(final.getByRole('button',{name:'Finish the day',exact:true})).toBeEnabled();await final.getByRole('button',{name:'Finish the day',exact:true}).click();
    await expect.poll(async()=>{const r=await page.request.get(`/api/farm-manager/today?farm_id=${id(1)}&date=${date}`);return (await r.json()).operatingDay.status;}).toBe('closed');
    for(const row of queued){const replay=await page.request.post('/api/farm-manager/today/commands',{data:row.command});expect(replay.status()).toBe(200);expect((await replay.json()).status).toBe('applied');}
    const detail=await (await page.request.get(`/api/farm-manager/today/tasks/feeding?farm_id=${id(1)}&flock_id=${id(5)}&date=${date}`)).json();
    expect(detail.data.sessions).toHaveLength(2);expect(detail.inventory.find((item:{id:string})=>item.id===id(7)).balances.find((row:{warehouseId:string})=>row.warehouseId===id(6)).quantity).toBe(90);
  }finally{await context.close();if(!profile.startsWith(join(tmpdir(),'ep-offline-')))throw Error('Unexpected test profile path');await rm(profile,{recursive:true,force:true});}
});
