import {expect as baseExpect, test, type Page} from '@playwright/test';
import {toEthiopianDate} from '../../src/i18n/ethiopian-calendar';

// Local dev routes compile lazily; functional assertions remain unchanged.
const expect=baseExpect.configure({timeout:90_000});

const local=process.env.E2E_LOCAL_LIFECYCLE==='true';
test.skip(!local,'Run through scripts/test-flock-lifecycle-browser.mjs against its disposable migrated local stack.');
const flock='12000000-0000-4000-8000-000000000012';
const farm='12000000-0000-4000-8000-000000000003';
const other='99000000-0000-4000-8000-000000000001';
async function login(page: Page,role='FARM_MANAGER'){
  page.on('requestfailed',request=>console.log('Local browser request failed:',new URL(request.url()).origin,new URL(request.url()).pathname,request.failure()?.errorText));
  await page.goto('/auth/sign-in');
  await page.getByRole('textbox',{name:'Work email',exact:true}).fill(process.env[`E2E_${role}_EMAIL`]!);
  await page.locator('input[name="password"]').fill(process.env[`E2E_${role}_PASSWORD`]!);
  await page.getByRole('button',{name:'Open my workspace',exact:true}).click();
  // Disposable dev stack compiles the first authenticated route on demand.
  await expect(page).toHaveURL(/\/app\//,{timeout:90_000});
}

test('anonymous lifecycle interfaces deny access',async({page})=>{
  for(const path of [`/api/flocks/${flock}/profile?days=30`,`/api/flocks/cycles/context?farm_id=${farm}`]){
    const response=await page.request.get(path);expect(response.status()).toBe(401);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test('manager reads all periods, missing evidence and exact targets with no-store authorization',async({page})=>{
  await login(page);
  for(const days of [7,30,90]){
    const response=await page.request.get(`/api/flocks/${flock}/profile?days=${days}`);
    expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');
    const profile=await response.json();expect(profile.flock.code).toBe('BROWSER-LAYER');
    expect(profile.flock.ageDays).toBeGreaterThanOrEqual(160);
    expect(profile.coverage.missingDates.length).toBeGreaterThan(0);
    expect(profile.results.feedKg).toBeNull();
    expect(profile.todayTasksAvailable).toBe(true);
    for(const task of profile.todayTasks){expect(task.href).toContain(`/app/today?`);expect(task.href).toContain(`flock_id=${flock}`);}
  }
  expect((await page.request.get(`/api/flocks/${flock}/profile?days=14`)).status()).toBe(400);
  expect((await page.request.get(`/api/flocks/${other}/profile?days=30`)).status()).toBe(404);
  expect((await page.request.get(`/api/flocks/cycles/context?farm_id=${other}`)).status()).toBe(404);
  const context=await page.request.get(`/api/flocks/cycles/context?farm_id=${farm}`);
  expect(context.status()).toBe(200);expect(context.headers()['cache-control']).toContain('no-store');
});

test('inline profile, old URL compatibility, tablet layout and reduced motion',async({page})=>{
  await page.setViewportSize({width:768,height:1024});
  await page.emulateMedia({reducedMotion:'reduce'});
  await login(page);
  await page.goto(`/app/flocks/${flock}`);
  await expect(page).toHaveURL(/\/app\/flocks\?/);
  const panel=page.locator('#selected-flock-details');
  await expect(panel.getByRole('heading',{name:'BROWSER-LAYER',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Flock registry',exact:true})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'History — coming soon'})).toBeDisabled();
  const periods=panel.getByRole('group',{name:'Profile period'});
  await expect(periods.getByRole('button',{name:'30 days',exact:true})).toHaveAttribute('aria-pressed','true');
  for(const days of [7,90,30]){
    const read=page.waitForResponse(response=>response.url().includes(`/api/flocks/${flock}/profile?days=${days}`));
    await periods.getByRole('button',{name:`${days} days`,exact:true}).click();
    expect((await read).status()).toBe(200);
    await expect(panel.getByRole('heading',{name:'Performance and what needs attention'})).toBeVisible();
  }
  // transition-none disables animation even when duration-200 remains set.
  expect(await panel.evaluate(element=>getComputedStyle(element).transitionProperty)).toBe('none');
  for(const size of [{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(size);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const small=await periods.locator('button').evaluateAll(buttons=>buttons.filter(button=>button.getBoundingClientRect().height<44).length);
    expect(small).toBe(0);
  }
  const toggle=page.getByRole('button',{name:'Hide flock details',exact:true});
  await toggle.focus();await page.keyboard.press('Enter');
  await expect(panel).toHaveAttribute('aria-hidden','true');
  await expect(page.getByRole('button',{name:'Show flock details',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');await expect(panel).toHaveAttribute('aria-hidden','false');
});

test('Amharic inline profile persists and CEO authorized read uses the same ledger',async({page,browser})=>{
  await login(page);await page.goto(`/app/flocks/${flock}`);
  const panel=page.locator('#selected-flock-details');
  await expect(panel.getByRole('heading',{name:'BROWSER-LAYER',exact:true})).toBeVisible();
  const before=await (await page.request.get(`/api/flocks/${flock}/profile?days=30`)).json();
  await page.getByRole('group',{name:/Language|ቋንቋ/}).getByRole('button',{name:'አማ',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','am');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','am');
  await expect(panel.getByRole('heading',{name:'BROWSER-LAYER',exact:true})).toBeVisible();
  const after=await (await page.request.get(`/api/flocks/${flock}/profile?days=30`)).json();
  expect(after.results).toEqual(before.results);expect(after.period).toEqual(before.period);
  const ceoContext=await browser.newContext();const ceoPage=await ceoContext.newPage();
  try{
    await login(ceoPage,'CEO');
    const response=await ceoPage.request.get(`/api/flocks/${flock}/profile?days=30`);
    expect(response.status()).toBe(200);const ceo=await response.json();
    expect(ceo.results).toEqual(before.results);expect(ceo.todayTasksAvailable).toBe(false);
  }finally{await ceoContext.close();}
});

test('Today tablet controls and Amharic calendar preserve the operational date',async({page,context})=>{
  await page.setViewportSize({width:768,height:1024});
  await page.addInitScript(()=>localStorage.setItem('ethiopoultry.today.guide.dismissed.v1','true'));
  await login(page);
  await page.goto(`/app/today?farm_id=${farm}&flock_id=${flock}`);
  const date=page.getByLabel('Work date',{exact:true});
  await expect(date).toBeVisible();
  const iso=await date.inputValue();
  const converted=toEthiopianDate(iso)!;
  await expect(page.locator('#today-task-birds')).toBeVisible();
  for(const size of [{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(size);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const name of ['Farm','House','Flock']){
      const control=page.getByRole('combobox',{name,exact:true});
      expect(await control.evaluate(element=>element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    }
  }
  await page.getByRole('group',{name:'Language'}).getByRole('button',{name:'አማ',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','am');
  const calendar=page.getByRole('group',{name:'የኢትዮጵያ ዘመን አቆጣጠር',exact:true});
  await expect(calendar.getByRole('combobox',{name:'ቀን',exact:true})).toHaveValue(String(converted.day));
  await expect(calendar.getByRole('combobox',{name:'ወር',exact:true})).toHaveValue(String(converted.month));
  await expect(calendar.getByRole('combobox',{name:'ዓመት',exact:true})).toHaveValue(String(converted.year));
  await expect(calendar.locator('input[type=hidden]')).toHaveValue(iso);
  for(const size of [{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(size);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await calendar.locator('select').evaluateAll(elements=>elements.every(element=>element.getBoundingClientRect().height>=44))).toBe(true);
    await page.screenshot({path:test.info().outputPath(`today-am-${size.width}.png`),fullPage:true});
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','am');
  await expect(calendar.locator('input[type=hidden]')).toHaveValue(iso);
  // Persist offline before attempting transport; reconnect must apply once.
  await page.getByRole('group',{name:/Language|ቋንቋ/}).getByRole('button',{name:'EN',exact:true}).click();
  const birds=page.locator('#today-task-birds');
  if(await birds.locator('button[aria-expanded=false]').count()) await birds.locator('button[aria-expanded]').click();
  const workspaceResponse=await page.request.get(`/api/farm-manager/today?farm_id=${farm}&date=${iso}`);
  expect(workspaceResponse.status()).toBe(200);
  const workspace=await workspaceResponse.json();
  expect(workspace.flocks.find((row:{id:string})=>row.id===flock)?.birdCheck.openingBirds).toBe(100);
  const savedResponse=page.waitForResponse(response=>response.url().endsWith('/api/farm-manager/today/commands')&&response.request().method()==='POST');
  await context.setOffline(true);
  try{
    const save=birds.getByRole('button',{name:'Save bird check',exact:true});
    await expect(save).toBeEnabled();await save.click();
    await expect(birds.getByText('Waiting to sync',{exact:true})).toBeVisible();
    if(await birds.locator('button[aria-expanded=false]').count())await birds.locator('button[aria-expanded]').click();
    await expect(birds.getByText(/Waiting to sync; not complete yet/).first()).toBeVisible();
    await expect(birds.getByRole('button',{name:'Save bird check',exact:true})).toBeDisabled();
  }finally{await context.setOffline(false);}
  const saved=await savedResponse;
  expect(saved.status()).toBe(200);
  const result=await saved.json();
  expect(result.status).toBe('applied');
  const replay=await page.request.post('/api/farm-manager/today/commands',{data:saved.request().postDataJSON()});
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toEqual(result);
  await expect.poll(async()=>{
    const response=await page.request.get(`/api/farm-manager/today?farm_id=${farm}&date=${iso}`);
    if(!response.ok())return false;
    const workspace=await response.json();return Boolean(workspace.flocks.find((row:{id:string})=>row.id===flock)?.birdCheck.dailyRecordId);
  },{timeout:60000}).toBe(true);
});

test('Today draft recovery, quota failure, midnight lock and revoked access preserve unsent work',async({page,context,browser})=>{
  await page.addInitScript(()=>localStorage.setItem('ethiopoultry.today.guide.dismissed.v1','true'));
  await page.clock.install();
  await login(page);
  await page.goto(`/app/today?farm_id=${farm}&flock_id=${flock}`);
  const workDate=await page.getByLabel('Work date',{exact:true}).inputValue();
  const identity=await (await page.request.get('/api/me/context')).json();
  const card=page.locator('#today-task-eggs_water');
  const open=async()=>{
    await expect(card.locator('button[aria-expanded]')).toBeVisible();
    if(await card.locator('button[aria-expanded=false]').count())await card.locator('button[aria-expanded]').click();
    await expect(card.getByLabel('Water used (litres)',{exact:true})).toBeEnabled();
  };
  const readLocal=()=>page.evaluate(async()=>{
    const name=localStorage.getItem('ethiopoultry.offline_identity');
    if(!name)throw Error('Missing offline identity');
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try {
      const read=(store:string)=>new Promise<unknown[]>((resolve,reject)=>{const request=db.transaction(store).objectStore(store).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      return {drafts:await read('drafts'),outbox:await read('outbox')};
    }finally{db.close();}
  });
  await open();
  const water=card.getByLabel('Water used (litres)',{exact:true});
  await water.fill('123');
  for(const name of ['normal_eggs','broken_eggs','dirty_eggs'])await card.locator(`input[name=${name}]`).fill('0');
  await expect.poll(async()=>JSON.stringify((await readLocal()).drafts)).toContain('123');
  await page.reload();await open();await expect(water).toHaveValue('123');
  // Inject a real IndexedDB quota error at the persistence boundary, not transport.
  await page.evaluate(()=>{
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='outbox')throw new DOMException('Test quota exhausted','QuotaExceededError');return put.apply(this,args);};
  });
  await context.setOffline(true);
  await card.getByRole('button',{name:'Save and continue',exact:true}).click();
  await expect(page.getByText(/Saving is paused\. Keep this browser profile/)).toBeVisible();
  expect((await readLocal()).outbox).toHaveLength(0);
  expect(JSON.stringify((await readLocal()).drafts)).toContain('123');
  await context.setOffline(false);await page.reload();await open();
  await context.setOffline(true);await page.clock.fastForward(24*60*60*1000);
  await expect(card.getByText('Reconnect and sign in to continue. Your draft is kept on this device.',{exact:true})).toBeVisible();
  await expect(water).toBeDisabled();
  expect(JSON.stringify((await readLocal()).drafts)).toContain('123');
  await context.setOffline(false);await page.clock.setSystemTime(new Date());await page.reload();await open();
  await expect(water).toHaveValue('123');
  await context.setOffline(true);
  await card.getByRole('button',{name:'Save and continue',exact:true}).click();
  await expect.poll(async()=>(await readLocal()).outbox.length).toBe(1);
  const ceoContext=await browser.newContext({baseURL:process.env.APP_BASE_URL});
  try {
    const ceoPage=await ceoContext.newPage();await login(ceoPage,'CEO');
    const response=await ceoPage.request.get('/api/governance/assignments');expect(response.status()).toBe(200);
    const assignments=await response.json();
    const assignment=assignments.farmAssignments.find((row:{farm_id:string;profile_id:string;assignment_status:string})=>row.farm_id===farm&&row.profile_id===identity.userId&&row.assignment_status==='Active');
    expect(assignment).toBeTruthy();
    const revoked=await ceoPage.request.delete('/api/governance/assignments',{data:{scope_type:'farm',assignment_id:assignment.id,reason:'Disposable offline revocation acceptance'}});
    expect(revoked.status()).toBe(200);
    await context.setOffline(false);
    await expect(page.getByText(/Saving is paused\. Keep this browser profile/)).toBeVisible();
    expect((await readLocal()).outbox).toHaveLength(1);
    const current=await page.request.get(`/api/farm-manager/today?farm_id=${farm}&date=${workDate}`);
    expect(current.status()).toBe(403);
  }finally{await context.setOffline(false);await ceoContext.close();}
});
