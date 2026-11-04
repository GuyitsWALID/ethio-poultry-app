import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseTodayCommand} from '../src/lib/today-workspace/contracts.ts';
import en from '../messages/en.json' with {type:'json'};
import am from '../messages/am.json' with {type:'json'};
const id='44000000-0000-4000-8000-000000000001';
test('Existing expenses remain v1-compatible and monthly evidence survives command validation',()=>{
 const command={schema_version:1,command_id:id,type:'record_expense',farm_id:id,work_date:'2026-11-04',payload:{category:'rent',description:'Farm rent',amount:500}};
 assert.equal(parseTodayCommand(command).payload.entry_kind,'one_off');
 const result=parseTodayCommand({...command,payload:{...command.payload,entry_kind:'monthly',remember_template:true,recurring_template_id:id}});
 assert.equal(result.payload.recurring_template_id,id);assert.equal(result.payload.remember_template,true);
});
test('New expense and purchase controls have matching bilingual catalogs',()=>{
 assert.deepEqual(Object.keys(en.Expenses).sort(),Object.keys(am.Expenses).sort());
 for(const value of Object.values(am.Expenses))assert.match(value,/[\u1200-\u137f]/);
 assert.equal(en.Navigation.expensesPurchases,'Expenses & purchases');
});
test('More and Today share forms and retain distinct ledger operations',()=>{
 const today=readFileSync('src/components/today/embedded-task-card.tsx','utf8'),page=readFileSync('src/components/expenses-workspace.tsx','utf8');
 for(const form of ['ExpenseEntryForm','PurchaseEntryForm']){assert.ok(today.includes(form));assert.ok(page.includes(form));}
 assert.ok(page.includes('/api/profit/cost-entries'));assert.ok(page.includes('/api/inventory/receipts'));assert.ok(page.includes('buildHistoryHref'));
 assert.ok(page.includes('from:result.costEntry.entry_date,to:result.costEntry.entry_date'),'Monthly retries link to the original stored date, not the newly requested date');
 const operation=readFileSync('src/lib/farm-operations.ts','utf8');assert.ok(operation.includes('.rpc("record_operational_expense"'));
});
test('Monthly confirmation and receipt replay keep atomic audit, scope and no-duplicate rules',()=>{
 const sql=readFileSync('supabase/migrations/20261104000000_farm_expense_confirmations.sql','utf8');
 for(const seam of ['expense-month:','expense-request:','for share','manager_has_effective_warehouse_access','confirmation_month','expense_request_hash','governance_audit_events','receive_inventory_stock_before_expense_workspace'])assert.ok(sql.includes(seam),seam);
 assert.match(sql,/where warehouse_id is null/);assert.match(sql,/to_jsonb\(existing\)->>'voided_at' is not null/);assert.match(sql,/different expense evidence/);
 assert.doesNotMatch(sql,/update public\.(cost_entries|stock_ledger|recurring_cost_templates)/i);
});
