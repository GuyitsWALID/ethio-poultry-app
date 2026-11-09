-- One feed-close boundary serves Today and legacy entry; retain its grants and guards.
do $$
declare definition text; updated text;
 unaliased text:='where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date';
 aliased text:='where s.org_id = v_org_id and s.flock_id = p_flock_id and s.record_date = p_record_date';
begin
 definition:=pg_get_functiondef('public.close_feed_day(uuid,uuid,date,text)'::regprocedure);
 if (length(definition)-length(replace(definition,unaliased,'')))/length(unaliased)<>3
   or (length(definition)-length(replace(definition,aliased,'')))/length(aliased)<>2 then
   raise exception 'Feed-close source queries changed; review voided-session filtering before release.';
 end if;
 updated:=replace(definition,unaliased,unaliased||' and voided_at is null');
 updated:=replace(updated,aliased,aliased||' and s.voided_at is null');
 execute updated;
end $$;

revoke all on function public.close_feed_day(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.close_feed_day(uuid,uuid,date,text) to service_role;
notify pgrst,'reload schema';
