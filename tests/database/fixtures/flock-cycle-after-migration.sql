\set ON_ERROR_STOP on
begin transaction read only;
do $$ begin
  if (select count(*) from public.batch_cycles where org_id='1f000000-0000-4000-8000-000000000001')<>2 then raise exception 'Backfill inferred ambiguous shared membership'; end if;
  if not exists(select 1 from public.batches where id='1f000000-0000-4000-8000-000000000010' and batch_cycle_id=id) then raise exception 'Canonical active batch ID was not preserved'; end if;
  if not exists(select 1 from public.batch_cycles where id='1f000000-0000-4000-8000-000000000011' and status='archived' and not completion_verified and completed_at is null and legacy_singleton) then raise exception 'Backfill invented legacy completion evidence'; end if;
  if exists(select 1 from public.batches where id in ('1f000000-0000-4000-8000-000000000012','1f000000-0000-4000-8000-000000000013') and batch_cycle_id is not null) then raise exception 'Ambiguous or inconsistent cycle was silently mapped'; end if;
  if not exists(select 1 from public.flocks where id='1f000000-0000-4000-8000-000000000021' and current_count=90 and initial_count=100 and completed_at is null) then raise exception 'Migration rewrote historical populations'; end if;
end $$;
rollback;
