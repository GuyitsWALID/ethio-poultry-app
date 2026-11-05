import {test, expect, type Page} from '@playwright/test';
import type {QueuedCommand} from '../../src/lib/today-workspace/offline-store';
import en from '../../messages/en.json';

test.skip(process.env.E2E_LOCAL_LIFECYCLE !== 'true', 'Requires the disposable migrated local runner.');
const flock='12000000-0000-4000-8000-000000000905', farm='12000000-0000-4000-8000-000000000003';
async function login(page:Page, role='FARM_MANAGER') {
  await page.goto('/auth/sign-in');
  await page.getByRole('textbox',{name:'Work email',exact:true}).fill(process.env[`E2E_${role}_EMAIL`]!);
  await page.locator('input[name=password]').fill(process.env[`E2E_${role}_PASSWORD`]!);
  await page.getByRole('button',{name:'Open my workspace',exact:true}).click();
  await expect(page).toHaveURL(/\/app\//);
}
async function outbox(page:Page):Promise<QueuedCommand[]> {
  return page.evaluate(async()=>{
    const name=localStorage.getItem('ethiopoultry.offline_identity');if(!name)return [];
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    try{return await new Promise<QueuedCommand[]>((resolve,reject)=>{const r=db.transaction('outbox').objectStore('outbox').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
  });
}
test('governed physical start preserves historical coverage, bilingual context and stale offline work',async({page,browser})=>{
  const ceoContext=await browser.newContext(), otherContext=await browser.newContext();
  try {
    await page.addInitScript(()=>localStorage.setItem('ethiopoultry.today.guide.dismissed.v1','true'));
    await login(page);
    const destination=`/app/today?farm_id=${farm}&flock_id=${flock}&task=birds`;
    await page.goto(destination);
    const card=page.locator('#today-task-birds');
    await expect(card).toBeVisible();
    if(await card.locator('button[aria-expanded=false]').count())await card.locator('button[aria-expanded]').click();
    const form=card.locator('details').filter({hasText:en.RecordingStart.title});
    await form.locator('summary').click();
    await form.locator('input[name=birds]').fill('98');
    await form.locator('input[name=eggs]').fill('0');
    await form.locator('input[name=reference]').fill('Signed physical count sheet');
    await form.locator('textarea[name=reason]').fill('Earlier reliable records genuinely unavailable.');
    await page.context().setOffline(true);
    await expect(form.getByRole('button',{name:en.RecordingStart.send,exact:true})).toBeDisabled();
    await page.context().setOffline(false);
    await expect(form.getByRole('button',{name:en.RecordingStart.send,exact:true})).toBeEnabled();
    await expect(form.locator('input[name=birds]')).toHaveValue('98');
    await expect(form.locator('input[name=eggs]')).toHaveValue('0');
    const submitted=page.waitForResponse(r=>r.url().endsWith('/api/governance/requests')&&r.request().method()==='POST');
    await form.getByRole('button',{name:en.RecordingStart.send,exact:true}).click();
    const response=await submitted;expect(response.status()).toBe(201);
    const request=(await response.json()).request;
    const ceo=await ceoContext.newPage();await login(ceo,'CEO');
    const approved=await ceo.request.post(`/api/governance/requests/${request.id}/decision`,{data:{decision:'approved',note:'Signed count sheet reviewed.'}});
    expect(approved.status()).toBe(200);
    const applied=await page.request.post(`/api/governance/requests/${request.id}/apply`,{data:{}});
    expect(applied.status()).toBe(200);
    const replay=await page.request.post(`/api/governance/requests/${request.id}/apply`,{data:{}});expect(replay.status()).toBe(200);
    const profileResponse=await page.request.get(`/api/flocks/${flock}/profile?days=30`);expect(profileResponse.status()).toBe(200);
    const profile=await profileResponse.json();
    expect(profile.flock.startingBirds).toBe(100);expect(profile.flock.currentBirds).toBe(98);
    expect(profile.flock.recordingStart.birds).toBe(98);expect(profile.flock.ageDays).toBeGreaterThanOrEqual(160);
    expect(profile.coverage.expected).toBe(30);expect(profile.coverage.records).toBe(0);
    expect(profile.results.eggs).toBeNull();expect(profile.results.losses).toBeNull();
    const date=profile.today;
    const report=await page.request.get(`/api/reports/performance?date_from=${date}&date_to=${date}&farm_id=${farm}&flock_id=${flock}`);
    expect(report.status()).toBe(200);
    const performance=await report.json();
    expect(performance.sections.production.metrics.find((r:{key:string})=>r.key==='eggs').value).toBeNull();
    expect(performance.sections.health.metrics.find((r:{key:string})=>r.key==='deaths').value).toBeNull();
    await page.goto(`/app/flocks/${flock}`);
    await expect(page.locator('#selected-flock-details').getByText('Verified recording start:',{exact:false})).toBeVisible();
    await page.getByRole('group',{name:/Language|ቋንቋ/}).getByRole('button',{name:'አማ',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('lang','am');
    // The localized API is also used by the inline profile; original evidence
    // and Gregorian wire dates remain unchanged.
    const localized=await page.request.get(`/api/flocks/${flock}/profile?days=30`);expect(localized.status()).toBe(200);
    await expect(page.locator('#selected-flock-details').getByText('የተረጋገጠ የመመዝገቢያ መነሻ፦',{exact:false})).toBeVisible();
    for(const size of [{width:768,height:1024},{width:1024,height:768}]){
      await page.setViewportSize(size);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await page.getByRole('group',{name:/Language|ቋንቋ/}).getByRole('button',{name:'EN',exact:true}).click();
    await page.goto(destination);
    await expect(page.locator('#today-task-birds')).toBeVisible();
    await expect.poll(()=>page.evaluate(async()=>Boolean(navigator.serviceWorker.controller&&await caches.match('/offline'))),{timeout:90000}).toBe(true);
    await page.context().setOffline(true);
    const birds=page.locator('#today-task-birds');
    if(await birds.locator('button[aria-expanded=false]').count())await birds.locator('button[aria-expanded]').click();
    await birds.getByRole('button',{name:'Save bird check',exact:true}).click();
    await expect.poll(async()=>(await outbox(page)).length).toBe(1);
    const queued=(await outbox(page))[0];
    expect(queued.command.type).toBe('save_daily_record');
    if(queued.command.type!=='save_daily_record')throw Error('Expected a daily start');
    expect(queued.command.payload.record._today_opening).toEqual({source:'baseline',count:98});
    await page.reload();
    await expect(page.locator('#today-task-birds')).toBeVisible();
    expect((await outbox(page))[0].command.command_id).toBe(queued.command.command_id);
    // Reuse this session's cookies rather than signing in again: environments
    // enforcing one active session correctly revoke the earlier login.
    await otherContext.addCookies(await page.context().cookies());
    const other=await otherContext.newPage();
    const competing=structuredClone(queued.command);competing.command_id=crypto.randomUUID();
    const winner=await other.request.post('/api/farm-manager/today/commands',{data:competing});
    expect(winner.status()).toBe(200);expect((await winner.json()).status).toBe('applied');
    const session=await page.request.get('/api/me/context');
    expect(session.status()).toBe(200);
    expect((await session.json()).role).toBe('farm_manager');
    // Synchronization is deliberately foreground-only; the competing window
    // must not leave the recovered tablet hidden during this assertion.
    await page.bringToFront();
    await expect.poll(()=>page.evaluate(()=>document.visibilityState)).toBe('visible');
    await page.context().setOffline(false);
    await expect.poll(()=>page.evaluate(()=>navigator.onLine)).toBe(true);
    // Return from the data-free recovery shell to the authenticated Today
    // workspace, as its Refresh today action instructs. No queued work is reset.
    await page.goto(destination);
    await expect.poll(async()=>(await outbox(page))[0]?.state,{timeout:90000}).toBe('conflict');
    expect((await outbox(page))[0].command.command_id).toBe(queued.command.command_id);
    const final=await other.request.get(`/api/flocks/${flock}/profile?days=30`);
    const finalProfile=await final.json();expect(finalProfile.flock.currentBirds).toBe(98);
    expect(finalProfile.coverage.records).toBe(1);expect(finalProfile.results.losses).toBe(0);
  } finally {await page.context().setOffline(false);await ceoContext.close();await otherContext.close();}
});
