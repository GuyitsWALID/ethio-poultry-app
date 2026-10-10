import {expect as baseExpect, test, type Page} from '@playwright/test';

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
