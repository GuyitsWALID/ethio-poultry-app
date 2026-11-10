import {test,expect,type Page} from '@playwright/test';
import en from '../../messages/en.json';
import am from '../../messages/am.json';

test.skip(process.env.E2E_LOCAL_LIFECYCLE!=='true','Requires disposable migrated local fixtures.');
async function switchLocale(page:Page,locale:'en'|'am'){
 const saved=page.waitForResponse(r=>r.url().endsWith('/api/me/locale')&&r.request().method()==='PATCH',{timeout:20000});
 await page.getByRole('group',{name:/Language|ቋንቋ/}).getByRole('button',{name:locale==='en'?'EN':'አማ',exact:true}).click();
 expect((await saved).status()).toBe(200);
}
for(const {name,farm,flock,daysAgo} of [{name:'current day',farm:'12000000-0000-4000-8000-000000000301',flock:'12000000-0000-4000-8000-000000000305',daysAgo:0},{name:'backdated day without offline grant',farm:'12000000-0000-4000-8000-000000000003',flock:'12000000-0000-4000-8000-000000000922',daysAgo:2}]){
 test(`First deaths and culls save from a read-only Bird count on ${name}`,async({page})=>{
  test.setTimeout(120000);page.setDefaultTimeout(20000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('ethiopoultry.today.guide.dismissed.v1','true'));
  await page.goto('/auth/sign-in');
  await page.getByRole('textbox',{name:'Work email',exact:true}).fill(process.env.E2E_FARM_MANAGER_EMAIL!);
  await page.locator('input[name=password]').fill(process.env.E2E_FARM_MANAGER_PASSWORD!);
  await page.getByRole('button',{name:'Open my workspace',exact:true}).click();await expect(page).toHaveURL(/\/app\//);
  await switchLocale(page,'en');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const date=new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-daysAgo);const day=date.toISOString().slice(0,10);
  const api=`/api/farm-manager/today?farm_id=${farm}&date=${day}`;
  const read=async()=>{const response=await page.request.get(api);expect(response.status()).toBe(200);return response.json();};
  await page.goto(`/app/today?farm_id=${farm}&flock_id=${flock}&date=${day}&task=health_deaths`);
  const copy=daysAgo?am:en;
  if(daysAgo)await switchLocale(page,'am');
  await expect(page.locator('#today-bird-count')).toBeVisible();
  await expect(page.getByRole('button',{name:'Start bird record',exact:true})).toHaveCount(0);
  const before=await read();expect(before.flocks.find((f:{id:string})=>f.id===flock).birdCheck.dailyRecordId).toBeNull();
  if(daysAgo)expect(before.offlineAccess).toBeUndefined();
  const health=page.locator('#today-task-health_deaths');
  if(await health.locator('button[aria-expanded=false]').count())await health.locator('button[aria-expanded]').click();
  await health.getByRole('checkbox',{name:copy.Today.embedded.healthModes.death,exact:true}).check();
  await health.getByRole('checkbox',{name:copy.Today.embedded.healthModes.cull,exact:true}).check();
  await health.locator('input[name=death_count]').fill('2');await health.locator('select[name=cause]').selectOption('Natural');
  await health.locator('input[name=cull_count]').fill('1');await health.locator('input[name=cull_reason]').fill('Disposable acceptance fixture');
  const saved=page.waitForResponse(response=>{
   if(!response.url().endsWith('/api/farm-manager/today/commands')||response.request().method()!=='POST')return false;
   return Boolean(response.request().postDataJSON()?.payload?.record?._today_bird_loss);
  },{timeout:30000});
  await health.getByRole('button',{name:copy.Today.embedded.saveLoss,exact:true}).click();
  const response=await saved;expect(response.status()).toBe(200);expect((await response.json()).status).toBe('applied');
  await expect.poll(async()=>{const result=await read();return result.flocks.find((f:{id:string})=>f.id===flock).birdCheck.closingBirds;}).toBe(97);
  const record=(await read()).flocks.find((f:{id:string})=>f.id===flock).birdCheck;
  expect(record.deaths).toBe(2);expect(record.culls).toBe(1);expect(record.dailyRecordId).toBeTruthy();
  await page.reload();await expect(page.locator('#today-bird-count')).toBeVisible();
  expect((await read()).flocks.find((f:{id:string})=>f.id===flock).birdCheck.dailyRecordId).toBe(record.dailyRecordId);
  for(const locale of ['en','am'] as const){
   await switchLocale(page,locale);
   for(const size of [{width:768,height:1024},{width:1024,height:768}]){
    await page.setViewportSize(size);await expect(page.locator('#today-bird-count')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   }
   if(locale==='am')await expect(page.getByRole('group',{name:'የኢትዮጵያ ዘመን አቆጣጠር',exact:true}).locator('input[type=hidden]')).toHaveValue(day);
  }
  expect(errors).toEqual([]);
  await switchLocale(page,'en');
 });
}
