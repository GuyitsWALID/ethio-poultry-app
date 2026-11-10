\set ON_ERROR_STOP on
begin;
create function pg_temp.reject_sale_audit() returns trigger language plpgsql as $$ begin
 if new.event_type='sales_record.recorded' then raise exception 'Injected sale audit failure'; end if;
 return new;
end $$;
do $$
declare org uuid:='33000000-0000-4000-8000-000000000001'; manager uuid:='33000000-0000-4000-8000-000000000002';
 farm uuid:='33000000-0000-4000-8000-000000000003'; branch uuid:='33000000-0000-4000-8000-000000000004';
 day date:=(now() at time zone 'Africa/Addis_Ababa')::date; sale public.daily_sales_records; replay public.daily_sales_records;
 payload jsonb:='{"product_category":"bird","product_label":"Birds","quantity":10,"unit":"bird","unit_price":25.5,"paid_amount":100}';
 request uuid:='33000000-0000-4000-8000-000000000005'; n integer;
begin
 insert into public.organizations(id,name) values(org,'Operational integrity fixture');
 insert into public.profiles(id,org_id,full_name,role,is_active) values(manager,org,'Manager','farm_manager',true);
 insert into public.branches(id,org_id,name) values(branch,org,'Branch');
 insert into public.farms(id,org_id,branch_id,name) values(farm,org,branch,'Farm');
 insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values(org,manager,farm,now()-interval '1 day');
 sale:=public.record_operational_sale(manager,farm,day,payload,request);
 replay:=public.record_operational_sale(manager,farm,day,payload,request);
 if sale.id<>replay.id or sale.balance_due<>155 or sale.gross_amount<>255 then raise exception 'Sale retry or amounts incorrect'; end if;
 select count(*) into n from public.governance_audit_events where entity_id=sale.id::text and event_type='sales_record.recorded';
 if n<>1 then raise exception 'Duplicate or missing sale audit'; end if;
 create trigger injected_sale_audit_failure before insert on public.governance_audit_events for each row execute function pg_temp.reject_sale_audit();
 begin
  perform public.record_operational_sale(manager,farm,day,payload,'33000000-0000-4000-8000-000000000006');
  raise exception 'Audit failure was ignored';
 exception when raise_exception then if sqlerrm<>'Injected sale audit failure' then raise; end if; end;
 drop trigger injected_sale_audit_failure on public.governance_audit_events;
 if exists(select 1 from public.daily_sales_records where sale_request_id='33000000-0000-4000-8000-000000000006') then
  raise exception 'Sale survived audit failure'; end if;
 begin
  perform public.record_operational_sale(manager,farm,day,payload||'{"quantity":11}',request);
  raise exception 'Changed retry accepted';
 exception when serialization_failure then null; end;
 if has_function_privilege('authenticated','public.record_operational_sale(uuid,uuid,date,jsonb,uuid)','execute')
  or has_function_privilege('anon','public.record_operational_sale(uuid,uuid,date,jsonb,uuid)','execute') then raise exception 'Private writer exposed'; end if;
 -- Expiry is computed even when there is no materialized lock row.
 begin perform public.assert_operating_entry_date(org,farm,day-40); raise exception 'Expired date accepted'; exception when sqlstate '55000' then null; end;
 begin perform public.assert_operating_entry_date(org,farm,day+1); raise exception 'Future date accepted'; exception when sqlstate '55000' then null; end;
 update public.organizations set operational_day_lock_grace_days=14 where id=org;
 perform public.assert_operating_entry_date(org,farm,day-10);
 -- Legacy direct service writes cannot bypass the same date checks.
 begin update public.daily_sales_records set sale_date=day+1 where id=sale.id; raise exception 'Legacy future write accepted'; exception when sqlstate '55000' then null; end;
 perform set_config('app.governance_apply','true',true);
 update public.daily_sales_records set sale_date=day-40 where id=sale.id;
 perform set_config('app.governance_apply','false',true);
 begin update public.daily_sales_records set sale_date=day where id=sale.id; raise exception 'Original expired date bypassed'; exception when sqlstate '55000' then null; end;
 perform set_config('app.governance_apply','true',true);
 update public.daily_sales_records set sale_date=day where id=sale.id;
 perform set_config('app.governance_apply','false',true);
 insert into public.farm_operating_days(org_id,farm_id,operating_date,status) values(org,farm,day,'closed');
 begin update public.daily_sales_records set notes='Changed' where id=sale.id; raise exception 'Closed day accepted'; exception when sqlstate '55000' then null; end;
 -- Idempotent recovery does not perform another write after the day closes.
 replay:=public.record_operational_sale(manager,farm,day,payload,request);
 if replay.id<>sale.id then raise exception 'Closed-day replay duplicated sale'; end if;
 update public.user_farm_access set revoked_at=now() where profile_id=manager and farm_id=farm;
 begin perform public.record_operational_sale(manager,farm,day,payload,request); raise exception 'Revoked replay exposed sale'; exception when insufficient_privilege then null; end;
end $$;
rollback;
