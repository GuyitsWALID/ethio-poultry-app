\set ON_ERROR_STOP on
begin;
create temporary table report_period_test_ids(org uuid,ceo uuid,manager uuid,period uuid);
grant select on report_period_test_ids to authenticated;
do $$
declare o uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); m uuid:=gen_random_uuid();
  b uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); p uuid:=gen_random_uuid();
begin
  insert into public.organizations(id,name)values(o,'Aggregate permission regression');
  insert into public.profiles(id,org_id,full_name,role,is_active) values(c,o,'CEO','ceo',true),(m,o,'Manager','farm_manager',true);
  insert into public.branches(id,org_id,name)values(b,o,'Branch');
  insert into public.farms(id,org_id,branch_id,name)values(f,o,b,'Farm');
  insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at)values(o,m,f,now()-interval '1 day');
  insert into public.monthly_cost_periods(id,org_id,farm_id,branch_id,period_start,period_end,total_absorbed_cost)
    values(p,o,f,b,'2026-09-01','2026-09-30',9999);
  insert into report_period_test_ids values(o,c,m,p);
end $$;
select set_config('request.jwt.claim.sub',(select manager::text from report_period_test_ids),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.monthly_cost_periods where id=(select period from report_period_test_ids)) then
    raise exception 'A farm assignment exposed an unverifiable cross-store aggregate'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select ceo::text from report_period_test_ids),true);
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.monthly_cost_periods where id=(select period from report_period_test_ids)) then
    raise exception 'CEO lost authorized financial history'; end if;
end $$;
reset role;
rollback;
