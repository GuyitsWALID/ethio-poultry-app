-- Reviewed historical count corrections never reopen a house or restate a sale.
-- Physical outflows, stock and original closure evidence remain immutable.
alter table public.governance_requests drop constraint governance_requests_request_type_check;
alter table public.governance_requests add constraint governance_requests_request_type_check check (request_type in (
 'batch_create','batch_archive','flock_place','flock_transfer','flock_close','flock_archive','feed_template','breed_target','health_schedule','warning_threshold','locked_correction','void_record','egg_opening_balance','sales_unit_conversion','batch_cycle_create','batch_cycle_close','archived_cycle_correction'));

create table public.batch_cycle_corrections (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 cycle_id uuid not null references public.batch_cycles(id), request_id uuid not null unique references public.governance_requests(id),
 supporting_reference text not null check(length(btrim(supporting_reference))>=3),
 before_revision text not null, after_revision text not null, closure_snapshot jsonb not null,
 applied_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
alter table public.batch_cycle_corrections enable row level security;
revoke all on public.batch_cycle_corrections from public,anon,authenticated;
grant select on public.batch_cycle_corrections to authenticated;
grant all on public.batch_cycle_corrections to service_role;
create policy cycle_corrections_read on public.batch_cycle_corrections for select to authenticated using (
 org_id=public.current_org_id() and (public.current_active_role()='ceo' or (public.current_active_role()='farm_manager' and
 exists(select 1 from public.batch_cycles c where c.id=cycle_id and public.has_active_farm_access(c.farm_id)))));
create trigger immutable_cycle_correction before update or delete on public.batch_cycle_corrections
 for each row execute function public.reject_lifecycle_evidence_edit();

create function public.archived_cycle_revision(p_org uuid,p_cycle uuid) returns text
language sql stable security definer set search_path=public,extensions as $$
 select encode(extensions.digest(jsonb_build_object(
 'cycle',(select to_jsonb(c) from public.batch_cycles c where c.id=p_cycle and c.org_id=p_org),
 'batches',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.batches b where b.batch_cycle_id=p_cycle and b.org_id=p_org),
 'flocks',(select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]') from public.flocks f join public.batches b on b.id=f.batch_id where b.batch_cycle_id=p_cycle and f.org_id=p_org),
 'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.daily_farm_records d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where b.batch_cycle_id=p_cycle and d.org_id=p_org),
 'mortality',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') from public.mortality_events m join public.flocks f on f.id=m.flock_id join public.batches b on b.id=f.batch_id where b.batch_cycle_id=p_cycle and m.org_id=p_org),
 'culls',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') from public.flock_cull_events m join public.flocks f on f.id=m.flock_id join public.batches b on b.id=f.batch_id where b.batch_cycle_id=p_cycle and m.org_id=p_org),
 'closures',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.batch_cycle_closures c where c.cycle_id=p_cycle and c.org_id=p_org),
 'clearances',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from public.batch_cycle_clearances e join public.batch_cycle_closures c on c.id=e.closure_id where c.cycle_id=p_cycle and e.org_id=p_org),
 'corrections',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from public.batch_cycle_corrections e where e.cycle_id=p_cycle and e.org_id=p_org)
 )::text,'sha256'),'hex')
$$;

create function public.validate_archived_cycle_correction(r public.governance_requests) returns void
language plpgsql security definer set search_path=public as $$
#variable_conflict use_column
declare c public.batch_cycles; x jsonb; d public.daily_farm_records; f public.flocks; e public.batch_cycle_clearances;
 previous_record public.daily_farm_records; next_record public.daily_farm_records; previous_value jsonb; next_value jsonb;
begin
 select * into c from public.batch_cycles where id=(r.proposed_values->>'cycle_id')::uuid and org_id=r.org_id for update;
 if not found or c.farm_id is distinct from r.farm_id or not c.completion_verified or c.status<>'archived' then
   raise exception 'Select a verified archived cycle.' using errcode='42501'; end if;
 if not exists(select 1 from public.batch_cycle_closures where cycle_id=c.id and mode='close') then
   raise exception 'Legacy empty-house attestation does not authorize historical count reconstruction.' using errcode='23514'; end if;
 perform 1 from public.batches where batch_cycle_id=c.id order by id for update;
 perform 1 from public.flocks f join public.batches b on b.id=f.batch_id where b.batch_cycle_id=c.id order by f.id for update of f;
 perform 1 from public.daily_farm_records d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where b.batch_cycle_id=c.id order by d.id for update of d;
 perform 1 from public.mortality_events m join public.flocks f on f.id=m.flock_id join public.batches b on b.id=f.batch_id where b.batch_cycle_id=c.id order by m.id for update of m;
 perform 1 from public.flock_cull_events m join public.flocks f on f.id=m.flock_id join public.batches b on b.id=f.batch_id where b.batch_cycle_id=c.id order by m.id for update of m;
 if r.proposed_values->>'expected_revision' is distinct from public.archived_cycle_revision(r.org_id,c.id) then
   raise exception 'Archived sources changed. Refresh and request CEO approval again.' using errcode='40001'; end if;
 if jsonb_typeof(r.proposed_values->'records') is distinct from 'array' or jsonb_array_length(r.proposed_values->'records') not between 1 and 500
   or length(btrim(coalesce(r.proposed_values->>'supporting_reference','')))<3
   or (select count(distinct x->>'id') from jsonb_array_elements(r.proposed_values->'records') x)<>jsonb_array_length(r.proposed_values->'records') then
   raise exception 'Review the exact records and supporting evidence.' using errcode='22023'; end if;
 for x in select value from jsonb_array_elements(r.proposed_values->'records') loop
   if (select count(*) from jsonb_object_keys(x))<>8 or not (x ?& array['id','opening_birds','deaths','culls','transfers_in','transfers_out','other_removals','closing_birds']) then
     raise exception 'Only the reviewed bird-count fields can change.' using errcode='22023'; end if;
   select * into d from public.daily_farm_records where id=(x->>'id')::uuid and org_id=r.org_id and voided_at is null;
   select f.* into f from public.flocks f join public.batches b on b.id=f.batch_id where f.id=d.flock_id and b.batch_cycle_id=c.id and f.org_id=r.org_id;
   if not found or f.status<>'archived' or f.current_count<>0
     or (public.current_active_role()='farm_manager' and not public.has_active_farm_access(f.farm_id))
     or (public.current_active_role()='ceo' and not exists(select 1 from public.user_farm_access a join public.profiles p on p.id=a.profile_id
       where a.org_id=r.org_id and a.farm_id=f.farm_id and a.profile_id=r.requested_by and a.revoked_at is null
       and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()) and p.is_active and p.role::text='farm_manager')) then
     raise exception 'Every corrected record needs an assigned archived flock with zero birds present.' using errcode='42501'; end if;
   if exists(select 1 from jsonb_each(x) p where p.key<>'id' and (jsonb_typeof(p.value)<>'number' or p.value::text !~ '^[0-9]+$' or p.value::text::numeric>2147483647)) then
     raise exception 'Bird counts must be nonnegative whole numbers.' using errcode='22023'; end if;
   if (x->>'closing_birds')::bigint<>(x->>'opening_birds')::bigint+(x->>'transfers_in')::bigint-(x->>'deaths')::bigint-(x->>'culls')::bigint-(x->>'transfers_out')::bigint-(x->>'other_removals')::bigint then
     raise exception 'The proposed bird counts do not balance.' using errcode='23514'; end if;
   select * into e from public.batch_cycle_clearances where flock_id=f.id and org_id=r.org_id;
   if e.daily_record_id=d.id and ((x->>'closing_birds')::integer<>0 or
       (x->>'other_removals')::integer-coalesce((e.source_snapshot->'daily'->>'other_removals')::integer,0)<>e.before_clearance_birds) then
     raise exception 'The correction must preserve the approved physical final departures and zero closing count. Review departure evidence separately.' using errcode='23514'; end if;
   -- Never fabricate a missing day to bridge a new population discrepancy.
   select * into previous_record from public.daily_farm_records where flock_id=f.id and org_id=r.org_id and voided_at is null and record_date<d.record_date order by record_date desc limit 1;
   select value into previous_value from jsonb_array_elements(r.proposed_values->'records') where value->>'id'=previous_record.id::text;
   if previous_record.record_date=d.record_date-1 then
     if (x->>'opening_birds')::integer is distinct from coalesce((previous_value->>'closing_birds')::integer,previous_record.closing_birds) then
       raise exception 'Opening birds must match the previous closing record.' using errcode='23514'; end if;
   elsif d.record_date=f.placement_date then
     if (x->>'opening_birds')::integer<>f.initial_count then raise exception 'Starting birds must match the original placement.' using errcode='23514'; end if;
   elsif (x->>'opening_birds')::integer is distinct from d.opening_birds then
     raise exception 'Missing earlier evidence prevents changing this opening count.' using errcode='23514'; end if;
   select * into next_record from public.daily_farm_records where flock_id=f.id and org_id=r.org_id and voided_at is null and record_date>d.record_date order by record_date limit 1;
   select value into next_value from jsonb_array_elements(r.proposed_values->'records') where value->>'id'=next_record.id::text;
   if next_record.record_date=d.record_date+1 then
     if (x->>'closing_birds')::integer is distinct from coalesce((next_value->>'opening_birds')::integer,next_record.opening_birds) then
       raise exception 'Closing birds must match the next opening record.' using errcode='23514'; end if;
   elsif e.daily_record_id<>d.id and (x->>'closing_birds')::integer is distinct from d.closing_birds then
     raise exception 'Missing later evidence prevents changing this closing count.' using errcode='23514'; end if;
   -- Existing Health/Today loss evidence is not silently edited by a count correction.
   if (x->>'deaths')::integer is distinct from d.deaths and exists(select 1 from public.mortality_events where flock_id=f.id and record_date=d.record_date and org_id=r.org_id) then
     raise exception 'Recorded death events support this count. Correct the loss evidence before resubmitting.' using errcode='23514'; end if;
   if (x->>'culls')::integer is distinct from d.culls and exists(select 1 from public.flock_cull_events where flock_id=f.id and record_date=d.record_date and org_id=r.org_id) then
     raise exception 'Recorded cull events support this count. Correct the loss evidence before resubmitting.' using errcode='23514'; end if;
 end loop;
end $$;

-- Historical corrections must not run the live-flock loss delta trigger.
-- This narrow path is entered only by the approved adapter below.
do $$ declare definition text; anchor text:='if tg_op <> ''DELETE'' then'; begin
 select pg_get_functiondef('public.apply_daily_farm_record_counts()'::regprocedure) into definition;
 if position(anchor in definition)=0 then raise exception 'Daily count trigger seam changed; review before migration.'; end if;
 execute replace(definition,anchor,
  'if current_setting(''app.archived_cycle_correction'',true)=''true'' and exists(select 1 from public.batch_cycle_clearances where flock_id=new.flock_id and org_id=new.org_id) then return new; end if; '||anchor);
end $$;

alter function public.apply_governance_request(uuid) rename to apply_governance_request_pre_archived_correction;
revoke all on function public.apply_governance_request_pre_archived_correction(uuid) from public,anon,authenticated,service_role;
create function public.apply_governance_request(p_request_id uuid) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare r public.governance_requests; x jsonb; d public.daily_farm_records; after_row jsonb; before_hash text; after_hash text; snapshot jsonb;
 confirmations jsonb; confirmation jsonb; attestation_id uuid; attestation_before jsonb;
 flag text; governance_flag text; correction_flag text;
begin
 if public.current_active_role()<>'farm_manager' then raise exception 'Only an assigned Farm Manager can apply an approved change.' using errcode='42501'; end if;
 select * into r from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
 if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
 if r.request_type<>'archived_cycle_correction' then return public.apply_governance_request_pre_archived_correction(p_request_id); end if;
 if not public.has_active_farm_access(r.farm_id) then raise exception 'An active farm assignment is required.' using errcode='42501'; end if;
 if r.status='applied' then return r; end if;
 if r.status<>'approved' or r.decided_at is null or r.approval_expires_at is null or r.approval_expires_at<=now() or
 not exists(select 1 from public.profiles where id=r.decided_by and org_id=r.org_id and role::text='ceo' and is_active) then
   raise exception 'This CEO authorization is no longer available.' using errcode='40001'; end if;
 perform public.validate_archived_cycle_correction(r);
 before_hash:=public.archived_cycle_revision(r.org_id,(r.proposed_values->>'cycle_id')::uuid);
 select jsonb_agg(to_jsonb(e) order by e.id) into snapshot from public.batch_cycle_clearances e join public.batch_cycle_closures c on c.id=e.closure_id where c.cycle_id=(r.proposed_values->>'cycle_id')::uuid;
 flag:=current_setting('app.lifecycle_apply',true); governance_flag:=current_setting('app.governance_apply',true); correction_flag:=current_setting('app.archived_cycle_correction',true);
 perform set_config('app.lifecycle_apply','true',true); perform set_config('app.governance_apply','true',true); perform set_config('app.archived_cycle_correction','true',true);
 for x in select value from jsonb_array_elements(r.proposed_values->'records') order by value->>'id' loop
   select * into d from public.daily_farm_records where id=(x->>'id')::uuid;
   select coalesce(jsonb_agg(to_jsonb(a)),'[]') into confirmations from public.daily_task_attestations a
   where a.org_id=r.org_id and a.flock_id=d.flock_id and a.work_date=d.record_date and a.superseded_at is null
     and a.task_code in ('routine_supplies','health_deaths')
     and a.source_fingerprint=public.today_source_fingerprint(a.farm_id,a.flock_id,a.work_date,a.task_code);
   update public.daily_farm_records set opening_birds=(x->>'opening_birds')::integer,deaths=(x->>'deaths')::integer,culls=(x->>'culls')::integer,
    transfers_in=(x->>'transfers_in')::integer,transfers_out=(x->>'transfers_out')::integer,other_removals=(x->>'other_removals')::integer,closing_birds=(x->>'closing_birds')::integer,
    mortality_percentage=case when (x->>'opening_birds')::integer>0 then round((x->>'deaths')::numeric/(x->>'opening_birds')::numeric*100,2) else null end,
    updated_at=clock_timestamp() where id=d.id returning to_jsonb(daily_farm_records.*) into after_row;
   perform public.append_lifecycle_change(r,'daily_farm_records',d.id,to_jsonb(d),after_row,array['opening_birds','deaths','culls','transfers_in','transfers_out','other_removals','closing_birds','mortality_percentage']);
   -- Only carry valid explicit zero confirmations whose meaning is unchanged.
   -- Added losses invalidate a no-health confirmation; never invent one.
   for confirmation in select value from jsonb_array_elements(confirmations) loop
     attestation_before:=confirmation;
     update public.daily_task_attestations set superseded_at=clock_timestamp(),updated_at=clock_timestamp()
       where id=(confirmation->>'id')::uuid returning to_jsonb(daily_task_attestations.*) into after_row;
     perform public.append_lifecycle_change(r,'daily_task_attestations',(confirmation->>'id')::uuid,attestation_before,after_row,array['superseded_at']);
     if confirmation->>'task_code'='routine_supplies' or ((x->>'deaths')::integer+(x->>'culls')::integer=0) then
       insert into public.daily_task_attestations(org_id,farm_id,flock_id,work_date,task_code,source_fingerprint,confirmed_by,derived_from_id,governance_request_id)
       values(r.org_id,(confirmation->>'farm_id')::uuid,d.flock_id,d.record_date,confirmation->>'task_code',
         public.today_source_fingerprint((confirmation->>'farm_id')::uuid,d.flock_id,d.record_date,confirmation->>'task_code'),
         (confirmation->>'confirmed_by')::uuid,(confirmation->>'id')::uuid,r.id)
       returning id,to_jsonb(daily_task_attestations.*) into attestation_id,after_row;
       perform public.append_lifecycle_change(r,'daily_task_attestations',attestation_id,'{}',after_row,array['source_fingerprint','derived_from_id','governance_request_id']);
     end if;
   end loop;
 end loop;
 if exists(select 1 from public.flocks f join public.batches b on b.id=f.batch_id where b.batch_cycle_id=(r.proposed_values->>'cycle_id')::uuid and (f.current_count<>0 or f.status<>'archived')) then
   raise exception 'Historical correction cannot resurrect birds.' using errcode='23514'; end if;
 after_hash:=public.archived_cycle_revision(r.org_id,(r.proposed_values->>'cycle_id')::uuid);
 insert into public.batch_cycle_corrections(org_id,cycle_id,request_id,supporting_reference,before_revision,after_revision,closure_snapshot,applied_by)
 values(r.org_id,(r.proposed_values->>'cycle_id')::uuid,r.id,r.proposed_values->>'supporting_reference',before_hash,after_hash,snapshot,auth.uid());
 perform set_config('app.lifecycle_apply',coalesce(flag,''),true); perform set_config('app.governance_apply',coalesce(governance_flag,''),true); perform set_config('app.archived_cycle_correction',coalesce(correction_flag,''),true);
 update public.governance_requests set status='applied',applied_by=auth.uid(),applied_at=now(),updated_at=now() where id=r.id returning * into r;
 insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note)
 select r.org_id,r.id,'applied',auth.uid(),coalesce(full_name,'Farm Manager'),'farm_manager','Applied reviewed archived bird-history correction; physical closure unchanged.' from public.profiles where id=auth.uid();
 return r;
end $$;

alter function public.decide_governance_request(uuid,text,text) rename to decide_governance_request_pre_archived_correction;
revoke all on function public.decide_governance_request_pre_archived_correction(uuid,text,text) from public,anon,authenticated,service_role;
create function public.decide_governance_request(p_request_id uuid,p_decision text,p_note text) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare r public.governance_requests;
begin
 if public.current_active_role()<>'ceo' then raise exception 'Only the organization CEO can decide governance requests.' using errcode='42501'; end if;
 select * into r from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
 if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
 if r.request_type='archived_cycle_correction' and p_decision='approved' then perform public.validate_archived_cycle_correction(r); end if;
 return public.decide_governance_request_pre_archived_correction(p_request_id,p_decision,p_note);
end $$;
revoke all on function public.validate_archived_cycle_correction(public.governance_requests),public.archived_cycle_revision(uuid,uuid) from public,anon,authenticated;
grant execute on function public.archived_cycle_revision(uuid,uuid) to service_role;
revoke all on function public.apply_governance_request(uuid),public.decide_governance_request(uuid,text,text) from public,anon;
grant execute on function public.apply_governance_request(uuid),public.decide_governance_request(uuid,text,text) to authenticated;
