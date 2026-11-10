-- Delivery history remains append-only; claims and outcomes are separate events.
alter table public.notification_delivery_attempts add column claim_token uuid, add column lease_expires_at timestamptz;
do $$ declare v_unique text; begin
 select conname into v_unique from pg_constraint where conrelid='public.notification_delivery_attempts'::regclass
   and contype='u' and pg_get_constraintdef(oid)='UNIQUE (notification_id, channel, attempt_number)';
 if v_unique is null then raise exception 'Delivery uniqueness seam changed'; end if;
 execute format('alter table public.notification_delivery_attempts drop constraint %I',v_unique);
 alter table public.notification_delivery_attempts drop constraint notification_delivery_attempts_status_check;
end $$;
alter table public.notification_delivery_attempts
 add constraint notification_delivery_phase check(status in ('claimed','sending','sent','failed','uncertain','cancelled')),
 add constraint notification_delivery_unique_phase unique(notification_id,channel,attempt_number,status);
create index notifications_email_queue on public.notifications(created_at,id) where archived_at is null;
create index notification_delivery_latest on public.notification_delivery_attempts(notification_id,channel,id desc);

create function public.claim_notification_emails(p_limit integer default 25)
returns setof jsonb language plpgsql security definer set search_path=public as $$
declare n public.notifications; a public.notification_delivery_attempts; v_attempt integer; v_token uuid;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid dispatch limit' using errcode='22023'; end if;
 for n in select notice.* from public.notifications notice join public.notification_preferences p on p.profile_id=notice.recipient_id and p.org_id=notice.org_id
   left join lateral(select * from public.notification_delivery_attempts history where history.notification_id=notice.id and history.channel='email' order by history.id desc limit 1) latest on true
   where notice.archived_at is null and p.email_enabled and notice.created_at>=p.updated_at
   and array_position(array['low','medium','high'],notice.severity)>=array_position(array['low','medium','high'],p.email_minimum_severity)
   and public.notification_recipient_has_access(notice.id)
   and (latest.id is null or (latest.status='failed' and latest.attempt_number<3 and latest.retry_after<=clock_timestamp())
     or (latest.status in ('claimed','sending') and latest.lease_expires_at<=clock_timestamp()))
   order by notice.created_at,notice.id limit p_limit for update of notice skip locked
 loop
   select * into a from public.notification_delivery_attempts where notification_id=n.id and channel='email' order by id desc limit 1;
   if a.status='sending' then
     insert into public.notification_delivery_attempts(org_id,notification_id,channel,attempt_number,status,provider,claim_token,failure_code)
       values(n.org_id,n.id,'email',a.attempt_number,'uncertain','cloudflare-email',a.claim_token,'SEND_LEASE_EXPIRED');
     return next to_jsonb(n)||jsonb_build_object('dispatch_status','uncertain');
     continue;
   end if;
   if a.status='claimed' then
     insert into public.notification_delivery_attempts(org_id,notification_id,channel,attempt_number,status,provider,claim_token,failure_code,retry_after)
       values(n.org_id,n.id,'email',a.attempt_number,'failed','cloudflare-email',a.claim_token,'CLAIM_LEASE_EXPIRED',clock_timestamp());
   end if;
   v_attempt:=coalesce(a.attempt_number,0)+1;
   if v_attempt>3 then continue; end if;
   v_token:=gen_random_uuid();
   insert into public.notification_delivery_attempts(org_id,notification_id,channel,attempt_number,status,provider,claim_token,lease_expires_at)
     values(n.org_id,n.id,'email',v_attempt,'claimed','cloudflare-email',v_token,clock_timestamp()+interval '5 minutes');
   return next to_jsonb(n)||jsonb_build_object('attempt_number',v_attempt,'claim_token',v_token);
 end loop;
end $$;

create function public.record_notification_email_phase(p_notification uuid,p_token uuid,p_status text,p_message_id text default null,p_code text default null,p_retry boolean default false)
returns text language plpgsql security definer set search_path=public as $$
declare n public.notifications; a public.notification_delivery_attempts; v_status text:=p_status;
begin
 select * into n from public.notifications where id=p_notification for update;
 if not found then raise exception 'Notification unavailable' using errcode='42501'; end if;
 select * into a from public.notification_delivery_attempts where notification_id=n.id and channel='email' order by id desc limit 1;
 if a.claim_token is distinct from p_token or p_token is null then raise exception 'Delivery claim changed' using errcode='40001'; end if;
 if a.status in ('sent','failed','uncertain','cancelled') then return a.status; end if;
 if p_status='sending' then
   if a.status='sending' then return 'already_sending'; end if;
   if a.lease_expires_at<=clock_timestamp() then return 'expired'; end if;
   if n.archived_at is not null or not public.notification_recipient_has_access(n.id) or not exists(
     select 1 from public.notification_preferences p where p.profile_id=n.recipient_id and p.org_id=n.org_id and p.email_enabled
     and n.created_at>=p.updated_at and array_position(array['low','medium','high'],n.severity)>=array_position(array['low','medium','high'],p.email_minimum_severity))
   then v_status:='cancelled'; end if;
 elsif p_status not in ('sent','failed','uncertain') or (p_status in ('sent','uncertain') and a.status<>'sending')
   or (p_status='sent' and nullif(p_message_id,'') is null) then raise exception 'Invalid delivery transition' using errcode='22023';
 end if;
 insert into public.notification_delivery_attempts(org_id,notification_id,channel,attempt_number,status,provider,claim_token,lease_expires_at,provider_message_id,failure_code,retry_after)
 values(n.org_id,n.id,'email',a.attempt_number,v_status,'cloudflare-email',p_token,
   case when v_status='sending' then clock_timestamp()+interval '5 minutes' end,
   case when v_status='sent' then p_message_id end,left(p_code,80),
   case when v_status='failed' and p_retry and a.attempt_number<3 then clock_timestamp()+interval '5 minutes'*(2^(a.attempt_number-1)) end);
 return v_status;
end $$;
revoke all on function public.claim_notification_emails(integer) from public,anon,authenticated;
revoke all on function public.record_notification_email_phase(uuid,uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;
grant execute on function public.record_notification_email_phase(uuid,uuid,text,text,text,boolean) to service_role;
revoke insert,update,delete on public.notification_delivery_attempts from service_role;
