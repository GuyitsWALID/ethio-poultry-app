import {test,expect,type Page} from '@playwright/test';
import en from '../../messages/en.json';
import am from '../../messages/am.json';
test.skip(process.env.E2E_LOCAL_LIFECYCLE!=='true','Requires the disposable migrated local runner.');
const farm='12000000-0000-4000-8000-000000000003';
async function login(page:Page){await page.goto('/auth/sign-in');await page.getByRole('textbox',{name:'Work email',exact:true}).fill(process.env.E2E_FARM_MANAGER_EMAIL!);await page.locator('input[name=password]').fill(process.env.E2E_FARM_MANAGER_PASSWORD!);await page.getByRole('button',{name:'Open my workspace',exact:true}).click();await expect(page).toHaveURL(/\/app\//);}
test('Farm-level monthly cost, exact History, shared Today forms, purchase and bilingual tablet',async({page})=>{
 page.setDefaultTimeout(30000);await page.addInitScript(()=>localStorage.setItem('ethiopoultry.today.guide.dismissed.v1','true'));await login(page);
 await page.goto(`/app/expenses-purchases?farm_id=${farm}`);await expect(page.getByRole('heading',{name:en.Expenses.title,exact:true}).last()).toBeVisible();
 const form=page.locator('form');await form.getByRole('combobox',{name:en.Expenses.kind,exact:true}).selectOption('monthly');
 await form.getByRole('combobox',{name:en.Expenses.category,exact:true}).selectOption('rent');await form.getByLabel(en.Expenses.description,{exact:true}).fill('Browser farm rent');await form.getByLabel(en.Expenses.amount,{exact:true}).fill('1500');
 await form.getByRole('checkbox',{name:en.Expenses.remember,exact:true}).check();expect(await form.evaluate(f=>(f as HTMLFormElement).checkValidity())).toBe(true);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/profit/cost-entries')&&r.request().method()==='POST');await form.getByRole('button',{name:en.Expenses.confirm,exact:true}).click();
 const first=await response;expect(first.status()).toBe(201);const entry=(await first.json()).costEntry;expect(entry.warehouse_id).toBeNull();expect(entry.recurring_template_id).toBeTruthy();
 const retry=await page.request.post('/api/profit/cost-entries',{data:{farm_id:farm,entry_date:entry.entry_date,entry_kind:'monthly',category:'rent',description:'Browser farm rent',amount:1500,remember_template:true}});expect(retry.status()).toBe(201);expect((await retry.json()).costEntry.id).toBe(entry.id);
 await page.getByRole('link',{name:en.Expenses.openSaved,exact:true}).click();await expect(page).toHaveURL(/history_record=/);await expect(page.getByText('Browser farm rent').first()).toBeVisible();
 await page.goto(`/app/today?farm_id=${farm}&task=expenses`);const card=page.locator('#today-task-expenses');await expect(card).toBeVisible();if(await card.locator('button[aria-expanded=false]').count())await card.locator('button[aria-expanded]').click();
 await expect(card.getByRole('combobox',{name:en.Expenses.template,exact:true})).toBeVisible();await card.getByRole('combobox',{name:en.Expenses.template,exact:true}).selectOption(entry.recurring_template_id);await expect(card.getByLabel(en.Expenses.amount,{exact:true})).toHaveValue('1500');
 await page.goto(`/app/expenses-purchases?farm_id=${farm}&view=purchases`);await page.getByRole('combobox',{name:en.Expenses.warehouseRequired,exact:true}).selectOption({index:1});await page.getByRole('combobox',{name:en.Expenses.itemMode,exact:true}).selectOption('new');
 await page.getByLabel(en.Expenses.itemName,{exact:true}).fill('Browser purchased feed');await page.getByLabel(en.Expenses.unit,{exact:true}).fill('kg');await page.getByLabel(en.Expenses.quantity,{exact:true}).fill('20');await page.getByLabel(en.Expenses.unitCost,{exact:true}).fill('10');
 const receipt=page.waitForResponse(r=>r.url().endsWith('/api/inventory/receipts')&&r.request().method()==='POST');await page.getByRole('button',{name:en.Expenses.savePurchase,exact:true}).click();expect((await receipt).status()).toBe(201);await expect(page.getByRole('link',{name:en.Expenses.openSaved,exact:true})).toBeVisible();
 await page.getByRole('group',{name:/Language|ቋንቋ/}).getByRole('button',{name:'አማ',exact:true}).click();await expect(page.getByRole('heading',{name:am.Expenses.title,exact:true}).last()).toBeVisible();
 for(const size of [{width:768,height:1024},{width:1024,height:768}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await expect(page.getByRole('status').filter({hasText:am.Expenses.saved})).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/expenses-amharic-tablet.png',fullPage:true});
});
