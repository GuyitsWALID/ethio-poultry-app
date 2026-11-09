-- Legacy reason text is history, not authorization to issue nonexistent stock.
do $$ declare definition text; updated text;
 condition text:='if v_available < v_group.quantity and nullif(btrim(p_override_reason), '''') is null then';
 message text:='Insufficient feed stock. Record a receipt or provide an authorized override reason.';
begin
 definition:=pg_get_functiondef('public.close_feed_day(uuid,uuid,date,text)'::regprocedure);
 if (length(definition)-length(replace(definition,condition,'')))/length(condition)<>1
   or position(message in definition)=0 or position('and s.voided_at is null' in definition)=0 then
   raise exception 'Feed-close stock guard changed; review the migration before release.';
 end if;
 updated:=replace(definition,condition,'if v_available < v_group.quantity then');
 updated:=replace(updated,message,'Insufficient feed stock. Record a genuine missing receipt or resolve the discrepancy through the authorized stock-correction workflow before retrying.');
 execute updated;
end $$;
revoke all on function public.close_feed_day(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.close_feed_day(uuid,uuid,date,text) to service_role;
notify pgrst,'reload schema';
