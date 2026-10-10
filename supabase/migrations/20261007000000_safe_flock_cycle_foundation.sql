-- Preserve canonical house batches. Shared membership is explicit, never inferred
-- from a supplier, label or arrival date. No historical populations are rewritten.
create table public.batch_cycles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  farm_id uuid not null references public.farms(id) on delete restrict,
  cycle_code text not null check (length(btrim(cycle_code)) between 1 and 120),
  production_purpose public.flock_type not null,
  status text not null check (status in ('active','archived')),
  placement_date date not null,
  placed_at timestamptz,
  completed_at timestamptz,
  completion_verified boolean not null default false,
  legacy_singleton boolean not null default false,
  created_by_request uuid references public.governance_requests(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(org_id,cycle_code),
  check (not completion_verified or (status='archived' and completed_at is not null)),
  check (placed_at is null or completed_at is null or placed_at < completed_at)
);
alter table public.batches add column batch_cycle_id uuid references public.batch_cycles(id) on delete restrict;
alter table public.flocks add column placed_at timestamptz, add column completed_at timestamptz;
alter table public.flock_transfers add column governance_request_id uuid references public.governance_requests(id) on delete restrict;
create unique index flock_transfers_one_approved_movement on public.flock_transfers(governance_request_id) where governance_request_id is not null;
alter table public.daily_task_attestations add column derived_from_id uuid references public.daily_task_attestations(id) on delete restrict;
alter table public.daily_task_attestations add column governance_request_id uuid references public.governance_requests(id) on delete restrict;
create index batches_cycle_membership on public.batches(batch_cycle_id);
create index batch_cycles_farm on public.batch_cycles(org_id,farm_id);

-- Only a single matching placement with exact starting population is unambiguous.
-- Keep all other rows unmapped so lifecycle operations fail closed for review.
with candidates as (
  select b.id,b.org_id,b.farm_id,b.batch_code,b.placement_date,b.status,f.flock_type
  from public.batches b join public.flocks f on f.batch_id=b.id
  join public.houses h on h.id=b.house_id and h.farm_id=b.farm_id and h.org_id=b.org_id
  join public.farms farm on farm.id=b.farm_id and farm.org_id=b.org_id and farm.branch_id=b.branch_id
  where b.voided_at is null and b.farm_id=f.farm_id and b.house_id=f.house_id
    and b.org_id=f.org_id and b.total_count=f.initial_count
    and b.placement_date=f.placement_date
    and ((b.status='active' and f.status in ('active','quarantined')) or (b.status<>'active' and f.status not in ('active','quarantined')))
    and (select count(*) from public.flocks x where x.batch_id=b.id)=1
)
insert into public.batch_cycles(id,org_id,farm_id,cycle_code,production_purpose,status,placement_date,legacy_singleton)
select id,org_id,farm_id,batch_code,flock_type,case when status='active' then 'active' else 'archived' end,placement_date,true
from candidates;
update public.batches b set batch_cycle_id=c.id from public.batch_cycles c where c.id=b.id and c.legacy_singleton;

create table public.batch_cycle_closures (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete restrict,
  cycle_id uuid not null unique references public.batch_cycles(id) on delete restrict,
  request_id uuid not null unique references public.governance_requests(id) on delete restrict,
  completed_at timestamptz not null, mode text not null check (mode in ('close','legacy_attestation')),
  supporting_reference text, applied_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.batch_cycle_clearances (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete restrict,
  closure_id uuid not null references public.batch_cycle_closures(id) on delete restrict,
  flock_id uuid not null unique references public.flocks(id) on delete restrict,
  house_id uuid not null references public.houses(id) on delete restrict,
  daily_record_id uuid references public.daily_farm_records(id) on delete restrict,
  before_clearance_birds integer not null check (before_clearance_birds >= 0),
  source_snapshot jsonb not null, created_at timestamptz not null default now()
);
create table public.bird_sale_head_count_attestations (
  sale_id uuid primary key references public.daily_sales_records(id) on delete restrict,
  org_id uuid not null references public.organizations(id) on delete restrict,
  request_id uuid not null references public.governance_requests(id) on delete restrict,
  head_count integer not null check (head_count > 0), supporting_reference text not null check (length(btrim(supporting_reference)) >= 3),
  source_revision text not null, created_at timestamptz not null default now()
);
create table public.batch_cycle_dispositions (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete restrict,
  clearance_id uuid not null references public.batch_cycle_clearances(id) on delete restrict,
  kind text not null check (kind in ('sale','other')),
  quantity integer not null check (quantity > 0),
  sale_id uuid references public.daily_sales_records(id) on delete restrict,
  reason text, supporting_reference text,
  check ((kind='sale' and sale_id is not null) or (kind='other' and sale_id is null and length(btrim(reason))>=8 and length(btrim(supporting_reference))>=3)),
  created_at timestamptz not null default now()
);
create index cycle_dispositions_sale_capacity on public.batch_cycle_dispositions(sale_id) where sale_id is not null;
create table public.lifecycle_record_changes (
  id bigint generated always as identity primary key, org_id uuid not null references public.organizations(id) on delete restrict,
  request_id uuid not null references public.governance_requests(id) on delete restrict,
  source_table text not null, source_id uuid not null,
  before_values jsonb not null, after_values jsonb not null,
  after_revision text not null, approved_fields text[] not null,
  created_at timestamptz not null default now()
);

create function public.reject_lifecycle_evidence_edit() returns trigger language plpgsql as $$
begin raise exception 'Cycle evidence is append-only. Request a reviewed correction.' using errcode='42501'; end $$;
do $$ declare t text; begin
  foreach t in array array['batch_cycle_closures','batch_cycle_clearances','bird_sale_head_count_attestations','batch_cycle_dispositions','lifecycle_record_changes'] loop
    execute format('create trigger immutable_lifecycle_evidence before update or delete on public.%I for each row execute function public.reject_lifecycle_evidence_edit()',t);
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    if t in ('batch_cycle_closures','bird_sale_head_count_attestations','lifecycle_record_changes') then
      execute format('create policy lifecycle_tenant_evidence on public.%I for select to authenticated using ((org_id=public.current_org_id() and (public.current_active_role()=''ceo'' or (public.current_active_role()=''farm_manager'' and exists(select 1 from public.governance_requests r where r.id=request_id and public.has_active_farm_access(r.farm_id))))) or public.has_active_break_glass(org_id))',t);
    end if;
  end loop;
end $$;
-- Membership evidence follows the farm of its closure; no browser mutations.
create policy lifecycle_clearances_read on public.batch_cycle_clearances for select to authenticated using (
  (org_id=public.current_org_id() and (public.current_active_role()='ceo' or (public.current_active_role()='farm_manager' and exists(select 1 from public.batch_cycle_closures c join public.batch_cycles b on b.id=c.cycle_id where c.id=closure_id and public.has_active_farm_access(b.farm_id))))) or public.has_active_break_glass(org_id));
create policy lifecycle_dispositions_read on public.batch_cycle_dispositions for select to authenticated using (
  (org_id=public.current_org_id() and (public.current_active_role()='ceo' or (public.current_active_role()='farm_manager' and exists(select 1 from public.batch_cycle_clearances c join public.flocks f on f.id=c.flock_id where c.id=clearance_id and public.has_active_farm_access(f.farm_id))))) or public.has_active_break_glass(org_id));
alter table public.batch_cycles enable row level security;
revoke all on public.batch_cycles from anon,authenticated;
grant select on public.batch_cycles to authenticated;
grant all on public.batch_cycles to service_role;
create policy batch_cycles_assigned_read on public.batch_cycles for select to authenticated using (
  (org_id=public.current_org_id() and (public.current_active_role()='ceo' or (public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id)))) or public.has_active_break_glass(org_id));

-- Retire legacy branch/claim-based visibility as well as legacy entry. Reads
-- use the same current profile and effective farm assignment as the interfaces.
drop policy if exists "Farm managers can view flocks in their assigned branches" on public.flocks;
drop policy if exists flocks_org_access on public.flocks;
drop policy if exists "Farm managers can view batches in their assigned branches" on public.batches;
create policy flocks_current_assignment_read on public.flocks for select to authenticated using (
  (org_id=public.current_org_id() and (public.current_active_role()='ceo' or (public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id)))) or public.has_active_break_glass(org_id));
create policy batches_current_assignment_read on public.batches for select to authenticated using (
  (org_id=public.current_org_id() and (public.current_active_role()='ceo' or (public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id)))) or public.has_active_break_glass(org_id));

-- One opaque revision binds the entire proposal to the reviewed membership and
-- final-day sources. It is not a replacement ledger or a client progress token.
create function public.lifecycle_farm_revision(p_org uuid,p_farm uuid,p_day date) returns text
language sql stable security definer set search_path=public,extensions as $$
  select encode(extensions.digest(jsonb_build_object(
    'houses',(select coalesce(jsonb_agg(to_jsonb(h) order by h.id),'[]') from public.houses h where h.org_id=p_org and h.farm_id=p_farm),
    'cycles',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.batch_cycles c where c.org_id=p_org and c.farm_id=p_farm),
    'batches',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.batches b where b.org_id=p_org and b.farm_id=p_farm),
    'flocks',(select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]') from public.flocks f where f.org_id=p_org and f.farm_id=p_farm),
    'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.daily_farm_records d join public.flocks f on f.id=d.flock_id where f.org_id=p_org and f.farm_id=p_farm and d.record_date=p_day),
    'feed',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.feed_day_closures d join public.flocks f on f.id=d.flock_id where f.org_id=p_org and f.farm_id=p_farm and d.record_date=p_day)
  )::text,'sha256'),'hex')
$$;
revoke all on function public.lifecycle_farm_revision(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.lifecycle_farm_revision(uuid,uuid,date) to service_role;

create function public.lifecycle_sale_revision(p_sale uuid,p_org uuid) returns text language sql stable security definer set search_path=public,extensions as $$
  select encode(extensions.digest(to_jsonb(s)::text,'sha256'),'hex') from public.daily_sales_records s where s.id=p_sale and s.org_id=p_org
$$;
revoke all on function public.lifecycle_sale_revision(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lifecycle_sale_revision(uuid,uuid) to service_role;

-- Retirement is unconditional: turning Today off cannot re-enable the unsafe
-- branch-wide archive-and-clone operation.
create or replace function public.create_branch_batch_cycle(p_org_id uuid,p_branch_id uuid,p_batch jsonb,p_flock_slots jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
begin raise exception 'Automatic batch replacement has been retired. Open Flocks, finish and archive the previous cycle, then submit a new cycle for CEO approval.' using errcode='0A000'; end $$;

create function public.guard_house_occupancy_v1() returns trigger language plpgsql security definer set search_path=public as $$
declare v_previous record;
begin
  if new.status not in ('active','quarantined') then return new; end if;
  if tg_op='UPDATE' and new.house_id=old.house_id and old.status in ('active','quarantined') then return new; end if;
  -- Same lock is used by the approved create/transfer implementations. Two
  -- concurrent arrivals cannot both observe an empty house.
  perform 1 from public.houses where id=new.house_id and org_id=new.org_id and farm_id=new.farm_id for update;
  if not found then raise exception 'The placement house does not belong to this farm.' using errcode='23514'; end if;
  if exists(select 1 from public.flocks f where f.house_id=new.house_id and f.id<>new.id and (f.status in ('active','quarantined') or not exists(select 1 from public.batch_cycle_clearances c where c.flock_id=f.id))) then
    raise exception 'This house is occupied or its previous cycle has no verified clearance. Finish and archive that cycle first.' using errcode='23514';
  end if;
  for v_previous in select c.completed_at from public.batch_cycle_clearances e join public.batch_cycle_closures c on c.id=e.closure_id where e.house_id=new.house_id loop
    if new.placed_at is null or new.placed_at<=v_previous.completed_at then
      raise exception 'The actual placement must be after every previous cycle finished.' using errcode='23514';
    end if;
  end loop;
  if new.placement_date>(now() at time zone 'Africa/Addis_Ababa')::date or new.placed_at>now() then
    raise exception 'Future arrivals cannot be activated as already placed.' using errcode='23514'; end if;
  return new;
end $$;
create trigger guard_house_occupancy before insert or update of house_id,farm_id,status on public.flocks for each row execute function public.guard_house_occupancy_v1();

create function public.protect_cycle_closure_sources_v1() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='daily_sales_records' then
    if exists(select 1 from public.batch_cycle_dispositions where sale_id=old.id) and (
      tg_op='DELETE' or (to_jsonb(new) - array['paid_amount','balance_due','payment_method','customer_phone','notes','updated_at'])
        is distinct from (to_jsonb(old) - array['paid_amount','balance_due','payment_method','customer_phone','notes','updated_at'])) then
      raise exception 'This bird sale supports an archived cycle. Its physical evidence needs a reviewed lifecycle correction.' using errcode='42501'; end if;
  elsif tg_table_name='daily_farm_records' then
    if exists(select 1 from public.batch_cycle_clearances where daily_record_id=old.id) and (tg_op='DELETE' or
      row(new.org_id,new.flock_id,new.record_date,new.opening_birds,new.closing_birds,new.deaths,new.culls,new.transfers_in,new.transfers_out,new.other_removals,new.feed_intake_grams,new.voided_at)
        is distinct from row(old.org_id,old.flock_id,old.record_date,old.opening_birds,old.closing_birds,old.deaths,old.culls,old.transfers_in,old.transfers_out,old.other_removals,old.feed_intake_grams,old.voided_at)) then
      if coalesce(current_setting('app.lifecycle_apply',true),'false')<>'true' then
        raise exception 'This final record supports an archived cycle. Request a reviewed lifecycle correction.' using errcode='42501'; end if;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger protect_cycle_sale before update or delete on public.daily_sales_records for each row execute function public.protect_cycle_closure_sources_v1();
create trigger protect_cycle_daily before update or delete on public.daily_farm_records for each row execute function public.protect_cycle_closure_sources_v1();

alter table public.governance_requests drop constraint governance_requests_request_type_check;
alter table public.governance_requests add constraint governance_requests_request_type_check check (request_type in (
  'batch_create','batch_archive','flock_place','flock_transfer','flock_close','flock_archive','feed_template','breed_target','health_schedule','warning_threshold','locked_correction','void_record','egg_opening_balance','sales_unit_conversion','batch_cycle_create','batch_cycle_close'));

-- Explicitly supersede unsafe old lifecycle approvals, leaving unrelated ones
-- untouched. Keep their source/evidence/history for resubmission and audit.
update public.governance_requests set status='returned',returned_at=now(),decision_note='Refresh the cycle membership and bird accounting in Flocks, then request CEO approval again.',approval_expires_at=null,updated_at=now()
where status in ('pending','approved') and request_type in ('batch_create','batch_archive','flock_place','flock_close','flock_archive');

comment on table public.batch_cycles is 'Explicit farm-scoped production cohorts; canonical house batch IDs and historical ledgers remain unchanged.';
