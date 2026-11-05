\set ON_ERROR_STOP on
begin;
insert into public.organizations(id,name,today_workspace_enabled) values('44000000-0000-4000-8000-000000000001','Expense fixture',true);
insert into public.profiles(id,org_id,full_name,role,is_active) values
 ('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001','Expense manager','farm_manager',true),
 ('44000000-0000-4000-8000-000000000003','44000000-0000-4000-8000-000000000001','Expense CEO','ceo',true);
insert into public.branches(id,org_id,name) values('44000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000001','Expense branch');
insert into public.farms(id,org_id,branch_id,name) values
 ('44000000-0000-4000-8000-000000000005','44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000004','Expense farm'),
 ('44000000-0000-4000-8000-000000000006','44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000004','Unassigned farm');
insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values('44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000005',now()-interval '1 day');
insert into public.warehouses(id,org_id,branch_id,farm_id,name,type) values
 ('44000000-0000-4000-8000-000000000007','44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000005','Farm store','farm_store'),
 ('44000000-0000-4000-8000-000000000008','44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000004',null,'Shared store','central_warehouse');
insert into public.inventory_items(id,org_id,name,category,unit,unit_cost) values('44000000-0000-4000-8000-000000000009','44000000-0000-4000-8000-000000000001','Expense feed','feed','kg',10);
create temporary table expense_fixture(id uuid,template uuid);
do $$declare c public.cost_entries; retry public.cost_entries; payload jsonb:=jsonb_build_object('farm_id','44000000-0000-4000-8000-000000000005','category','rent','description','Farm rent','amount',500,'entry_kind','monthly','remember_template',true);
 day date:=(now() at time zone 'Africa/Addis_Ababa')::date;begin
 c:=public.record_operational_expense('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001',day,payload,'44000000-0000-4000-8000-000000000010');
 retry:=public.record_operational_expense('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001',day,payload,'44000000-0000-4000-8000-000000000010');
 if c.id<>retry.id or c.warehouse_id is not null or c.confirmation_month<>date_trunc('month',day)::date then raise exception 'Farm confirmation/retry failed';end if;
 retry:=public.record_operational_expense('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001',day,payload,gen_random_uuid());
 if c.id<>retry.id then raise exception 'Monthly confirmation duplicated';end if;
 insert into expense_fixture values(c.id,c.recurring_template_id);
 begin perform public.record_operational_expense('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001',day,payload||'{"amount":600}',gen_random_uuid());raise exception 'Expected different-month-evidence conflict';exception when serialization_failure then null;end;
 begin perform public.record_operational_expense('44000000-0000-4000-8000-000000000003','44000000-0000-4000-8000-000000000001',day,payload,gen_random_uuid());raise exception 'CEO mutation allowed';exception when insufficient_privilege then null;end;
 begin perform public.record_operational_expense('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001',day,payload||'{"farm_id":"44000000-0000-4000-8000-000000000006"}',gen_random_uuid());raise exception 'Other farm accepted';exception when insufficient_privilege then null;end;
 begin perform public.record_operational_expense('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001',day,payload||'{"warehouse_id":"44000000-0000-4000-8000-000000000008"}',gen_random_uuid());raise exception 'Shared store accepted without permission';exception when insufficient_privilege then null;end;
 begin perform public.record_operational_expense('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001',day+1,payload,gen_random_uuid());raise exception 'Future cost accepted';exception when object_not_in_prerequisite_state then null;end;
end $$;
create function pg_temp.reject_expense_audit() returns trigger language plpgsql as $$begin if new.event_type='cost_entry.recorded' then raise exception 'Forced expense audit failure';end if;return new;end $$;
create trigger expense_fixture_audit before insert on public.governance_audit_events for each row execute function pg_temp.reject_expense_audit();
do $$begin
 begin perform public.record_operational_expense('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001',(now() at time zone 'Africa/Addis_Ababa')::date,
 '{"farm_id":"44000000-0000-4000-8000-000000000005","category":"utility","description":"Audit rollback","amount":100,"entry_kind":"monthly","remember_template":true}',gen_random_uuid());
 raise exception 'Audit failure did not roll back';exception when raise_exception then if sqlerrm<>'Forced expense audit failure' then raise;end if;end;
 if exists(select 1 from public.recurring_cost_templates where description='Audit rollback') then raise exception 'Audit failure left a template';end if;
end $$;
drop trigger expense_fixture_audit on public.governance_audit_events;
do $$declare r jsonb;s jsonb;begin
 r:=public.receive_inventory_stock('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000007','44000000-0000-4000-8000-000000000009',null,20,10,(now() at time zone 'Africa/Addis_Ababa')::date,'miscellaneous','Supplier','EXP-RECEIPT',null,'expense-test-receipt');
 s:=public.receive_inventory_stock('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000007','44000000-0000-4000-8000-000000000009',null,20,10,(now() at time zone 'Africa/Addis_Ababa')::date,'miscellaneous','Supplier','EXP-RECEIPT',null,'expense-test-receipt');
 if r->>'movement_id'<>s->>'movement_id' or (select count(*) from public.cost_entries where org_id='44000000-0000-4000-8000-000000000001')<>1 then raise exception 'Purchase duplicated financial cost';end if;
 begin perform public.receive_inventory_stock('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000007','44000000-0000-4000-8000-000000000009',null,21,10,(now() at time zone 'Africa/Addis_Ababa')::date,'miscellaneous','Supplier','EXP-RECEIPT',null,'expense-test-receipt');raise exception 'Changed receipt replay accepted';exception when serialization_failure then null;end;
end $$;
select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"44000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 if (select count(*) from public.recurring_cost_templates where description='Farm rent')<>1 then raise exception 'Inherited farm-template read missing';end if;
 begin insert into public.recurring_cost_templates(org_id,farm_id,category,description,default_amount) values('44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000005','rent','Unauthorized',50);raise exception 'Direct template mutation allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.user_farm_access set revoked_at=now() where farm_id='44000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$begin if exists(select 1 from public.recurring_cost_templates where description='Farm rent') then raise exception 'Revocation retained template access';end if;end $$;
reset role;
rollback;
