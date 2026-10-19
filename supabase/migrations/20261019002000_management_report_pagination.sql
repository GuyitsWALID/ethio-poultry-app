-- Keyset pagination after current authorization, without loading snapshot bodies.
create index management_report_runs_org_page on public.management_report_runs(org_id,created_at desc,id desc);
create function public.page_accessible_management_reports(p_actor uuid,p_org uuid,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.profiles where id=p_actor and org_id=p_org and is_active and role in ('ceo','farm_manager')) then
    raise exception 'Management report access is required.' using errcode='42501'; end if;
  if (p_before_time is null)<>(p_before_id is null) then
    raise exception 'Invalid saved-report cursor.' using errcode='22023'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb)
    from (select id,report_name,period_from,period_to,status,failure_message,generated_at,created_at
      from public.management_report_runs
      where org_id=p_org and public.can_read_management_report(p_actor,id)
        and (p_before_time is null or (created_at,id)<(p_before_time,p_before_id))
      order by created_at desc,id desc limit 51) r);
end $$;
revoke all on function public.page_accessible_management_reports(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.page_accessible_management_reports(uuid,uuid,timestamptz,uuid) to service_role;
