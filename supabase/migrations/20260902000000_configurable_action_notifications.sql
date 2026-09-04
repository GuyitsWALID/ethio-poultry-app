-- Priority 8: configurable in-app and external notifications for accountable actions.

create table if not exists public.notification_preferences(
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  in_app_minimum_severity text not null default 'low' check(in_app_minimum_severity in ('low','medium','high','off')),
  email_enabled boolean not null default false,
  email_minimum_severity text not null default 'high' check(email_minimum_severity in ('low','medium','high')),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict
);

create index if not exists notification_preferences_org on public.notification_preferences(org_id);

create table if not exists public.notifications(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  action_id uuid not null references public.operational_actions(id) on delete cascade,
  action_event_id bigint not null references public.operational_action_events(id) on delete cascade,
  event_type text not null,
  severity text not null check(severity in ('high','medium','low')),
  title text not null,
  message text not null,
  route text not null,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_id,action_event_id)
);

create index if not exists notifications_recipient_unread on public.notifications(recipient_id,created_at desc) where read_at is null and archived_at is null;
create index if not exists notifications_org_action on public.notifications(org_id,action_id,created_at desc);

create table if not exists public.notification_delivery_attempts(
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check(channel in ('email')),
  attempt_number integer not null check(attempt_number between 1 and 3),
  status text not null check(status in ('sent','failed')),
  provider text not null,
  provider_message_id text,
  failure_code text,
  retry_after timestamptz,
  attempted_at timestamptz not null default now(),
  unique(notification_id,channel,attempt_number)
);

create index if not exists notification_delivery_attempts_notification on public.notification_delivery_attempts(notification_id,attempted_at desc);

create or replace function public.prevent_notification_delivery_attempt_change() returns trigger
language plpgsql as $$ begin raise exception 'Notification delivery history is append-only.' using errcode='42501'; end $$;

drop trigger if exists notification_delivery_attempts_append_only on public.notification_delivery_attempts;
create trigger notification_delivery_attempts_append_only before update or delete on public.notification_delivery_attempts
for each row execute function public.prevent_notification_delivery_attempt_change();

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_delivery_attempts enable row level security;

drop policy if exists notification_preferences_read_own on public.notification_preferences;
create policy notification_preferences_read_own on public.notification_preferences for select using(
  profile_id=auth.uid() and org_id=public.current_org_id()
);

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select using(
  recipient_id=auth.uid() and org_id=public.current_org_id()
);

drop policy if exists notification_delivery_attempts_read_own on public.notification_delivery_attempts;
create policy notification_delivery_attempts_read_own on public.notification_delivery_attempts for select using(
  exists(select 1 from public.notifications n where n.id=notification_id and n.recipient_id=auth.uid() and n.org_id=public.current_org_id())
);

grant select on public.notification_preferences,public.notifications,public.notification_delivery_attempts to authenticated;
revoke insert,update,delete on public.notification_preferences,public.notifications,public.notification_delivery_attempts from anon,authenticated;
revoke all on sequence public.notification_delivery_attempts_id_seq from anon,authenticated;

comment on table public.notification_preferences is 'Per-user notification channel and severity preferences; urgent operational custody remains visible in the action desk.';
comment on table public.notifications is 'Durable user-specific in-app notices derived from append-only operational action events.';
comment on table public.notification_delivery_attempts is 'Append-only external notification delivery evidence with bounded retry state.';
