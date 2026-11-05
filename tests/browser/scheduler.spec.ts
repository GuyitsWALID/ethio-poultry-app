import {test,expect,type Page} from '@playwright/test';
import en from '../../messages/en.json';
import am from '../../messages/am.json';
test.skip(process.env.E2E_LOCAL_LIFECYCLE!=='true','Requires the disposable migrated local runner.');
const farm='12000000-0000-4000-8000-000000000003',flock='12000000-0000-4000-8000-000000000012';
async function login(page:Page,role='FARM_MANAGER'){
 await page.goto('/auth/sign-in');await page.getByRole('textbox',{name:'Work email',exact:true}).fill(process.env[`E2E_${role}_EMAIL`]!);
 await page.locator('input[name=password]').fill(process.env[`E2E_${role}_PASSWORD`]!);await page.getByRole('button',{name:'Open my workspace',exact:true}).click();await expect(page).toHaveURL(/\/app\//);
}
test('Named-flock plans, creator permissions, real weight, offline skip, bilingual tablet Scheduler',async({page,browser})=>{
 page.setDefaultTimeout(30000);
 await page.addInitScript(()=>localStorage.setItem('ethiopoultry.today.guide.dismissed.v1','true'));
 await login(page);await page.goto('/app/scheduler');
 const initialResponse=await page.request.get('/api/scheduler');expect(initialResponse.status(),await initialResponse.text()).toBe(200);
 await page.getByRole('button',{name:en.Scheduler.new,exact:true}).click();const editor=page.locator('form');
 await editor.getByLabel(en.Scheduler.farm,{exact:true}).selectOption(farm);await editor.getByLabel(en.Scheduler.name,{exact:true}).fill('Browser weight plan');
 await editor.getByRole('checkbox',{name:'BROWSER-LAYER',exact:true}).check();
 const saved=page.waitForResponse(r=>r.url().endsWith('/api/scheduler')&&r.request().method()==='POST');
 await editor.getByRole('button',{name:en.Scheduler.save,exact:true}).click();expect((await saved).status()).toBe(201);
 const initial=await (await page.request.get(`/api/scheduler?farm_id=${farm}`)).json();
 expect(initial.occurrences.filter((o:{title:string})=>o.title==='Browser weight plan')).toHaveLength(1);
 const ceoContext=await browser.newContext();try{
  const ceo=await ceoContext.newPage();await login(ceo,'CEO');
  const spec={request_id:crypto.randomUUID(),farm_id:farm,flock_ids:[flock],title:'CEO cleaning plan',kind:'cleaning',frequency:'once',start_date:initial.today,notes:'',active:true};
  const created=await ceo.request.post('/api/scheduler',{data:spec});expect(created.status()).toBe(201);const rule=(await created.json()).rule;
  expect((await page.request.post('/api/scheduler',{data:{...spec,request_id:crypto.randomUUID(),id:rule.id,revision:rule.revision,title:'Unauthorized edit'}})).status()).toBe(403);
  await page.getByRole('button',{name:en.Scheduler.refresh,exact:true}).click();
  const protectedPlan=page.locator('article').filter({has:page.getByRole('heading',{name:'CEO cleaning plan',exact:true})});await expect(protectedPlan).toBeVisible();await expect(protectedPlan.getByRole('button',{name:en.Scheduler.edit,exact:true})).toHaveCount(0);
 }finally{await ceoContext.close();}
 await page.goto(`/app/today?farm_id=${farm}&flock_id=${flock}&task=scheduled_work`);
 const card=page.locator('#today-task-scheduled_work');await expect(card).toBeVisible();
 if(await card.locator('button[aria-expanded=false]').count())await card.locator('button[aria-expanded]').click();
 const weight=card.locator('form').filter({has:page.getByRole('heading',{name:'Browser weight plan',exact:true})});
 for(const [name,value] of [['sample_count','10'],['average_weight_g','1400'],['min_weight_g','1300'],['max_weight_g','1500'],['uniformity_pct','90']])await weight.locator(`input[name=${name}]`).fill(value);
 expect(await weight.evaluate(form=>(form as HTMLFormElement).checkValidity())).toBe(true);
 const outcome=page.waitForResponse(r=>r.url().endsWith('/api/farm-manager/today/commands')&&r.request().method()==='POST');
 await weight.getByRole('button',{name:en.Scheduler.saveOutcome,exact:true}).click();expect((await (await outcome).json()).status).toBe('applied');
 await expect(weight).toHaveCount(0);
 await expect.poll(()=>page.evaluate(async()=>{
  const name=localStorage.getItem('ethiopoultry.offline_identity');if(!name)return false;
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);});
  try{return await new Promise<boolean>(resolve=>{const r=db.transaction('drafts').objectStore('drafts').getAll();r.onsuccess=()=>resolve(r.result.some((d:{value?:{grant?:{scheduleRevisions?:object}}})=>Object.keys(d.value?.grant?.scheduleRevisions??{}).length>0));});}finally{db.close();}
 })).toBe(true);
 await page.context().setOffline(true);
 const cleaning=card.locator('form').filter({has:page.getByRole('heading',{name:'CEO cleaning plan',exact:true})});
 await cleaning.getByRole('radio',{name:en.Scheduler.skip,exact:true}).check();await cleaning.getByLabel(en.Scheduler.reason,{exact:true}).fill('House already cleaned; confirmed by supervisor.');
 await cleaning.getByRole('button',{name:en.Scheduler.saveOutcome,exact:true}).click();await expect(cleaning.getByRole('status')).toContainText(en.Today.offline.waiting);
 await page.context().setOffline(false);await page.getByRole('button',{name:en.Today.refresh,exact:true}).first().click();
 await expect.poll(async()=>{const r=await page.request.get(`/api/scheduler?farm_id=${farm}`);const d=await r.json();return d.occurrences.find((o:{title:string})=>o.title==='CEO cleaning plan')?.status;}).toBe('skipped');
 await page.goto('/app/scheduler');await page.setViewportSize({width:768,height:1024});
 await page.getByRole('group',{name:/Language|ቋንቋ/}).getByRole('button',{name:'አማ',exact:true}).click();
 await expect(page.getByRole('heading',{name:am.Scheduler.title,exact:true}).last()).toBeVisible();
 await page.getByRole('button',{name:am.Scheduler.new,exact:true}).click();
 for(const size of [{width:768,height:1024},{width:1024,height:768}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:'test-results/scheduler-amharic-tablet.png',fullPage:true});
});
