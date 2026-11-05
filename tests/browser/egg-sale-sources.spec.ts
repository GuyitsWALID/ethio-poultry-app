import {test,expect,type Page} from '@playwright/test';
import en from '../../messages/en.json';
import am from '../../messages/am.json';
test.skip(process.env.E2E_LOCAL_LIFECYCLE!=='true','Uses the disposable migrated local runner.');
const farm='12000000-0000-4000-8000-000000000003', first='12000000-0000-4000-8000-000000000012', second='12000000-0000-4000-8000-000000000017';
async function login(page:Page,role='FARM_MANAGER'){
 await page.goto('/auth/sign-in');await page.getByRole('textbox',{name:'Work email',exact:true}).fill(process.env[`E2E_${role}_EMAIL`]!);
 await page.locator('input[name=password]').fill(process.env[`E2E_${role}_PASSWORD`]!);await page.getByRole('button',{name:'Open my workspace',exact:true}).click();await expect(page).toHaveURL(/\/app\//);
}
test('Today combined sale, in-page History evidence, reviewed source correction and scoped totals',async({page,browser})=>{
 await page.addInitScript(()=>localStorage.setItem('ethiopoultry.today.guide.dismissed.v1','true'));
 await login(page);await page.goto(`/app/today?farm_id=${farm}&flock_id=${first}&task=sales`);
 const card=page.locator('#today-task-sales');await expect(card).toBeVisible();
 if(await card.locator('button[aria-expanded=false]').count())await card.locator('button[aria-expanded]').click();
 await card.locator('input[name=label]').fill('Browser combined eggs');await card.locator('input[name=quantity]').fill('2');
 await card.locator('select[name=unit]').selectOption('tray');await card.locator('input[name=unit_price]').fill('20');await card.locator('input[name=paid]').fill('10');
 await card.locator('select[name=source_flock_0]').selectOption(first);await card.locator('input[name=source_eggs_0]').fill('30');
 await card.getByRole('button',{name:en.Today.embedded.addSourceFlock,exact:true}).click();
 await card.locator('select[name=source_flock_1]').selectOption(second);await card.locator('input[name=source_eggs_1]').fill('30');
 const saved=page.waitForResponse(r=>r.url().endsWith('/api/farm-manager/today/commands')&&r.request().method()==='POST');
 await card.getByRole('button',{name:en.Today.embedded.recordSale,exact:true}).click();expect((await (await saved).json()).status).toBe('applied');
 const records=await (await page.request.get(`/api/sales/records?farm_id=${farm}`)).json();
 const sales=records.records.filter((r:{product_label:string})=>r.product_label==='Browser combined eggs');expect(sales).toHaveLength(1);const sale=sales[0];
 expect(sale.gross_amount).toBe(40);expect(sale.egg_sources).toHaveLength(2);
 const url=`/app/history?filter_view=1&filter_page_history_category=sales&filter_page_history_farm=${farm}&history_kind=sale&history_record=${sale.id}`;
 await page.goto(url);await expect(page.getByRole('heading',{name:en.History.kinds.egg_source,exact:true})).toHaveCount(2);
 const detail=await (await page.request.get(`/api/history/records/sale/${sale.id}`)).json();expect(detail.supporting).toHaveLength(2);
 await page.getByRole('link',{name:en.History.correct,exact:true}).click();
 const sourceEditor=page.locator('fieldset').filter({has:page.locator('legend').filter({hasText:en.EggSaleSources.title})});
 await expect(sourceEditor).toBeVisible();await sourceEditor.locator('input[type=number]').nth(0).fill('40');await sourceEditor.locator('input[type=number]').nth(1).fill('20');
 await page.getByRole('textbox',{name:en.OperationUI.whyIsThisChangeNeeded,exact:true}).fill('Reviewed original collection sheets; correct source allocation only.');
 await expect(sourceEditor.locator('select').first()).toHaveValue(first);
 await expect(sourceEditor.locator('select').nth(1)).toHaveValue(second);
 expect(await sourceEditor.locator('xpath=ancestor::form').evaluate(form=>Array.from((form as HTMLFormElement).elements).filter((element):element is HTMLInputElement=>element instanceof HTMLInputElement||element instanceof HTMLSelectElement||element instanceof HTMLTextAreaElement).filter(element=>!element.validity.valid).map(element=>({name:element.name,value:element.value,error:element.validationMessage})))).toEqual([]);
 const proposed=page.waitForResponse(r=>r.url().endsWith('/api/governance/requests')&&r.request().method()==='POST');
 await page.getByRole('button',{name:en.OperationUI.sendProposalToCEO,exact:true}).click();const submission=await proposed;expect(submission.status()).toBe(201);const request=(await submission.json()).request;
 const context=await browser.newContext();try{
  const ceo=await context.newPage();await login(ceo,'CEO');
  const response=await ceo.request.post(`/api/governance/requests/${request.id}/decision`,{data:{decision:'approved',note:'Source quantities reviewed against collection evidence.'}});expect(response.status()).toBe(200);
  const applied=await page.request.post(`/api/governance/requests/${request.id}/apply`);expect(applied.status()).toBe(200);expect((await applied.json()).request.status).toBe('applied');
  expect((await page.request.post(`/api/governance/requests/${request.id}/apply`)).status()).toBe(200);
 }finally{await context.close();}
 const updated=(await (await page.request.get(`/api/sales/records?farm_id=${farm}`)).json()).records.find((r:{id:string})=>r.id===sale.id);
 expect(updated.gross_amount).toBe(40);expect(updated.paid_amount).toBe(10);expect(updated.egg_source_version).toBe(2);
 const total=await (await page.request.get(`/api/sales/analytics?farm_id=${farm}`)).json();const scoped=await (await page.request.get(`/api/sales/analytics?farm_id=${farm}&flock_id=${first}`)).json();
 expect(total.kpis.revenue).toBe(40);expect(scoped.kpis.revenue).toBe(26.67);expect(total.kpis.records).toBe(1);
 const report={name:'Frozen combined egg evidence',scope:{farmId:farm},periodFrom:sale.sale_date,periodTo:sale.sale_date,commandId:crypto.randomUUID()};
 const generated=await page.request.post('/api/reports/management',{data:{action:'run_now',report}});expect(generated.status()).toBe(201);
 const savedReport=await generated.json();const replay=await page.request.post('/api/reports/management',{data:{action:'run_now',report}});expect((await replay.json()).id).toBe(savedReport.id);
 const frozen=await page.request.get(`/api/reports/management/${savedReport.id}`);expect(frozen.status()).toBe(200);const frozenBody=await frozen.json();expect(frozenBody.report_version).toBe('management-report-v3');
 const legacyInput={farm_id:farm,sale_date:sale.sale_date,product_category:'egg',product_label:'Legacy entry contract',quantity:1,unit:'egg',unit_price:1,paid_amount:0,egg_sources:[{flock_id:first,egg_quantity:1}],request_id:crypto.randomUUID()};
 const legacy=await page.request.post('/api/sales/records',{data:legacyInput});expect(legacy.status()).toBe(201);const recorded=(await legacy.json()).record;expect(recorded.id).toMatch(/^[a-f0-9-]{36}$/);
 expect((await (await page.request.post('/api/sales/records',{data:legacyInput})).json()).record.id).toBe(recorded.id);
 expect((await (await page.request.get(`/api/reports/management/${savedReport.id}`)).json()).html).toBe(frozenBody.html);
 await page.setViewportSize({width:768,height:1024});await page.goto(url);
 await expect(page.getByRole('heading',{name:en.History.kinds.egg_source,exact:true})).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('group',{name:/Language|ቋንቋ/}).getByRole('button',{name:'አማ',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('lang','am');
 await expect(page.getByRole('heading',{name:am.History.kinds.egg_source,exact:true})).toHaveCount(2);
 for(const size of [{width:768,height:1024},{width:1024,height:768}]){
  await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
