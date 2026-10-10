-- Appended to the canonical shared-cycle fixture immediately after closure.
insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
select '17000000-0000-4000-8000-000000000050',c.org_id,'archived_cycle_correction',c.farm_id,'batch_cycles',c.id,array['archived_bird_history'],jsonb_build_object(
 'cycle_id',c.id,'expected_revision',public.archived_cycle_revision(c.org_id,c.id),'supporting_reference','Paper count sheet 17',
 'records',(select jsonb_agg(jsonb_build_object('id',d.id,'opening_birds',100,'deaths',3,'culls',0,'transfers_in',0,'transfers_out',0,'other_removals',97,'closing_birds',0))
 from public.daily_farm_records d where d.org_id=c.org_id)),
 'Deaths were misclassified on the paper count.','17000000-0000-4000-8000-000000000002','archived_cycle_correction','Cycle manager','farm_manager',now()
from public.batch_cycles c where c.org_id='17000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 begin perform public.apply_governance_request('17000000-0000-4000-8000-000000000050'); raise exception 'Pending correction applied'; exception when serialization_failure then null; end;
 if has_function_privilege('authenticated','public.validate_archived_cycle_correction(public.governance_requests)','execute') then raise exception 'Internal adapter exposed'; end if;
end $$;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin perform public.decide_governance_request('17000000-0000-4000-8000-000000000050','approved','Reviewed the paper count and unchanged departures.'); end $$;
reset role;
-- Approval cannot become blanket authority after another source changes.
do $$ begin
 begin
  perform set_config('app.governance_apply','true',true);
  update public.daily_farm_records set water_consumed_liters=21 where org_id='17000000-0000-4000-8000-000000000001';
  perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
  begin perform public.apply_governance_request('17000000-0000-4000-8000-000000000050'); raise exception 'Stale archived approval applied'; exception when serialization_failure then null; end;
  raise exception 'rollback_stale_probe';
 exception when raise_exception then if sqlerrm<>'rollback_stale_probe' then raise; end if; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare r public.governance_requests; begin
 r:=public.apply_governance_request('17000000-0000-4000-8000-000000000050');
 if r.status<>'applied' then raise exception 'Correction did not apply'; end if;
 perform public.apply_governance_request(r.id);
 if (select count(*) from public.batch_cycle_corrections where org_id=r.org_id)<>1 then raise exception 'Replay duplicated amendment'; end if;
 if exists(select 1 from public.flocks where org_id=r.org_id and (status<>'archived' or current_count<>0)) then raise exception 'Correction resurrected birds'; end if;
 if exists(select 1 from public.daily_farm_records where org_id=r.org_id and (deaths<>3 or culls<>0 or closing_birds<>0 or other_removals<>97)) then raise exception 'Exact corrected values not applied'; end if;
 if (select sum(quantity) from public.batch_cycle_dispositions where org_id=r.org_id)<>194 then raise exception 'Correction restated physical sales'; end if;
 if (select count(*) from public.batch_cycle_closures where org_id=r.org_id)<>1 then raise exception 'Original closure changed'; end if;
end $$;
reset role;
-- Correction evidence cannot be overwritten even by service-level operations.
do $$ declare r public.governance_requests; begin
 begin update public.batch_cycle_corrections set supporting_reference='overwritten'; raise exception 'Correction evidence mutable'; exception when insufficient_privilege then null; end;
 select * into r from public.governance_requests where id='17000000-0000-4000-8000-000000000050';
 if (select count(*) from public.exact_lifecycle_corrections(r.org_id))<>2 then raise exception 'Approved corrected snapshots not recognized'; end if;
 if (select count(*) from public.daily_task_attestations a where a.org_id=r.org_id and a.superseded_at is null and a.task_code='routine_supplies'
   and a.source_fingerprint=public.today_source_fingerprint(a.farm_id,a.flock_id,a.work_date,a.task_code))<>2 then raise exception 'Correction stranded valid zero-supply confirmations'; end if;
 r.proposed_values:=jsonb_set(r.proposed_values,'{expected_revision}',to_jsonb(public.archived_cycle_revision(r.org_id,r.source_id)));
 -- Revoking the assignment invalidates even a previously reviewed correction.
 begin
  update public.user_farm_access set revoked_at=now() where org_id=r.org_id and profile_id=r.requested_by and revoked_at is null;
  begin perform public.validate_archived_cycle_correction(r); raise exception 'Revoked manager retained correction access'; exception when insufficient_privilege then null; end;
  raise exception 'rollback_revocation_probe';
 exception when raise_exception then if sqlerrm<>'rollback_revocation_probe' then raise; end if; end;
 -- A balanced proposal still cannot rewrite physical final departures.
 r.proposed_values:=jsonb_set(r.proposed_values,'{records,0,deaths}','4');
 r.proposed_values:=jsonb_set(r.proposed_values,'{records,0,other_removals}','96');
 begin perform public.validate_archived_cycle_correction(r); raise exception 'Physical departures were restated'; exception when check_violation then null; end;
 r.proposed_values:=jsonb_set(r.proposed_values,'{records,0,deaths}','3');
 r.proposed_values:=jsonb_set(r.proposed_values,'{records,0,other_removals}','97');
 r.proposed_values:=jsonb_set(r.proposed_values,'{records,0,closing_birds}','1');
 begin perform public.validate_archived_cycle_correction(r); raise exception 'Unbalanced or resurrecting correction accepted'; exception when check_violation then null; end;
end $$;
-- Broader correction: exact loss causes and a complete amended allocation are
-- reviewed together, leaving the original closure and money unchanged.
do $$ declare r public.governance_requests; p jsonb; sale uuid; token text; n integer; event_rows jsonb; begin
 select * into r from public.governance_requests where id='17000000-0000-4000-8000-000000000050';
 select sale_id into sale from public.batch_cycle_dispositions where org_id=r.org_id limit 1;
 token:=public.lifecycle_sale_revision(sale,r.org_id);
 p:=r.proposed_values;
 p:=jsonb_set(p,'{expected_revision}',to_jsonb(public.archived_cycle_revision(r.org_id,r.source_id)));
 p:=jsonb_set(p,'{records}',(select jsonb_agg(jsonb_build_object('id',d.id,'opening_birds',100,'deaths',4,'culls',0,'transfers_in',0,'transfers_out',0,'other_removals',96,'closing_birds',0) order by d.id) from public.daily_farm_records d where org_id=r.org_id));
 select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'record_id',d.id,'kind','death','count',4,'explanation','Verified paper death register') order by d.id) into event_rows from public.daily_farm_records d where org_id=r.org_id;
 p:=jsonb_set(p,'{loss_events}',event_rows);
 p:=jsonb_set(p,'{departures}',(select jsonb_agg(jsonb_build_object('flock_id',flock_id,'kind','sale','quantity',96,'sale_id',sale,'sale_revision',token) order by flock_id) from public.daily_farm_records where org_id=r.org_id));
 -- Validation failure must not partially create a loss or allocation.
 r.proposed_values:=jsonb_set(p,'{loss_events,0,count}','5');
 begin perform public.validate_archived_cycle_correction(r); raise exception 'Inconsistent event sum accepted'; exception when check_violation then null; end;
 if exists(select 1 from public.mortality_events where org_id=r.org_id) then raise exception 'Validation mutated loss ledger'; end if;
 insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
 values('17000000-0000-4000-8000-000000000051',r.org_id,r.request_type,r.farm_id,r.source_table,r.source_id,r.changed_fields,p,'Reviewed register and physical departure sheet.',r.requested_by,r.intent,'Cycle manager','farm_manager',now());
 perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
 perform public.decide_governance_request('17000000-0000-4000-8000-000000000051','approved','Reviewed both houses and unchanged sale revenue.');
 perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
 perform public.apply_governance_request('17000000-0000-4000-8000-000000000051');
 perform public.apply_governance_request('17000000-0000-4000-8000-000000000051');
 if (select sum(count) from public.mortality_events where org_id=r.org_id)<>8 then raise exception 'Loss correction not exact'; end if;
 if (select sum(quantity) from public.batch_cycle_dispositions where org_id=r.org_id)<>194 then raise exception 'Original departures rewritten'; end if;
 if (select sum(quantity) from public.effective_cycle_dispositions where org_id=r.org_id)<>192 then raise exception 'Effective allocations incorrect'; end if;
 if exists(select 1 from public.effective_cycle_clearances where org_id=r.org_id and before_clearance_birds<>96) then raise exception 'Profile clearance evidence stale'; end if;
 if exists(select 1 from public.flocks where org_id=r.org_id and (current_count<>0 or status<>'archived')) then raise exception 'Broader correction resurrected birds'; end if;
 if (select count(*) from public.batch_cycle_accounting_amendments where org_id=r.org_id)<>1 then raise exception 'Replay duplicated accounting amendment'; end if;
 if public.lifecycle_sale_revision(sale,r.org_id)<>token then raise exception 'Correction changed sale money or quantities'; end if;
 -- A balanced amendment cannot allocate 198 birds against the original
 -- 194-bird sale, even though the current cycle has released two allocations.
 r.proposed_values:=p;
 r.proposed_values:=jsonb_set(r.proposed_values,'{expected_revision}',to_jsonb(public.archived_cycle_revision(r.org_id,r.source_id)));
 r.proposed_values:=jsonb_set(r.proposed_values,'{records}',(select jsonb_agg(z||jsonb_build_object('deaths',1,'other_removals',99)) from jsonb_array_elements(p->'records') z));
 r.proposed_values:=jsonb_set(r.proposed_values,'{loss_events}',(select jsonb_agg(z||jsonb_build_object('count',1)) from jsonb_array_elements(p->'loss_events') z));
 r.proposed_values:=jsonb_set(r.proposed_values,'{departures}',(select jsonb_agg(z||jsonb_build_object('quantity',99)) from jsonb_array_elements(p->'departures') z));
 begin perform public.validate_archived_cycle_correction(r); raise exception 'Sale capacity exceeded'; exception when check_violation then if sqlerrm<>'Sale head-count capacity is already allocated.' then raise; end if; end;
 if (select sum(quantity) from public.effective_cycle_dispositions where org_id=r.org_id)<>192 then raise exception 'Failed validation changed current allocations'; end if;
 -- Follow-up review changes an existing event, adds culls, then explicitly
 -- removes incorrect death events. Original snapshots remain in audit evidence.
 for n in 52..53 loop
  select proposed_values into p from public.governance_requests where id='17000000-0000-4000-8000-000000000051';
  p:=p-'departures';
  p:=jsonb_set(p,'{expected_revision}',to_jsonb(public.archived_cycle_revision(r.org_id,r.source_id)));
  p:=jsonb_set(p,'{records}',(select jsonb_agg(jsonb_build_object('id',d.id,'opening_birds',100,'deaths',case when n=52 then 3 else 0 end,'culls',case when n=52 then 1 else 4 end,'transfers_in',0,'transfers_out',0,'other_removals',96,'closing_birds',0) order by d.id) from public.daily_farm_records d where org_id=r.org_id));
  select jsonb_agg(value) into event_rows from (
    select jsonb_build_object('id',m.id,'record_id',d.id,'kind','death','count',case when n=52 then 3 else 0 end,'explanation','Reviewed cause classification') as value from public.mortality_events m join public.daily_farm_records d on d.flock_id=m.flock_id and d.record_date=m.record_date where m.org_id=r.org_id
    union all
    select jsonb_build_object('id',coalesce(c.id,gen_random_uuid()),'record_id',d.id,'kind','cull','count',case when n=52 then 1 else 4 end,'explanation','Verified intentional removal') from public.daily_farm_records d left join public.flock_cull_events c on c.flock_id=d.flock_id and c.record_date=d.record_date where d.org_id=r.org_id
  ) q;
  p:=jsonb_set(p,'{loss_events}',event_rows);
  insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
  values(('17000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,r.org_id,r.request_type,r.farm_id,r.source_table,r.source_id,r.changed_fields,p,'Reviewed exact loss classification correction.',r.requested_by,r.intent,'Cycle manager','farm_manager',now());
  perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
  perform public.decide_governance_request(('17000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'approved','Reviewed exact event changes.');
  perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
  perform public.apply_governance_request(('17000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid);
 end loop;
 if exists(select 1 from public.mortality_events where org_id=r.org_id) or (select sum(count) from public.flock_cull_events where org_id=r.org_id)<>8 then raise exception 'Reviewed loss removal/update failed'; end if;
 if (select count(*) from public.lifecycle_record_changes where org_id=r.org_id and source_table='mortality_events' and after_values='{}')<>2 then raise exception 'Removed loss evidence not preserved'; end if;
 begin update public.batch_cycle_accounting_amendments set departures='[]' where org_id=r.org_id; raise exception 'Accounting amendment mutable'; exception when insufficient_privilege then null; end;
end $$;
rollback;
