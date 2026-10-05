-- Task 7.4: the CEO redesign has no release path during the manager pilot.
-- A timestamp alone is not acceptance evidence. Task 8.7 must introduce a
-- separately reviewed acceptance/release boundary after the real pilot passes.
do $$ begin
  if exists (
    select 1 from public.organizations
    where simplified_ceo_workspace_enabled or today_pilot_accepted_at is not null
  ) then
    raise exception 'CEO pilot gate has existing activation or acceptance values; review evidence before migration.';
  end if;
end $$;

create function public.guard_ceo_workspace_pilot_gate()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.simplified_ceo_workspace_enabled or new.today_pilot_accepted_at is not null then
    raise exception 'CEO simplification requires accepted manager pilot evidence and a separately reviewed release.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_ceo_workspace_pilot_gate() from public, anon, authenticated, service_role;
create trigger guard_ceo_workspace_pilot_gate
before insert or update of simplified_ceo_workspace_enabled, today_pilot_accepted_at
on public.organizations for each row execute function public.guard_ceo_workspace_pilot_gate();

comment on column public.organizations.today_pilot_accepted_at is
  'Reserved for verified seven-day manager pilot acceptance. Writes are blocked until the separately reviewed Task 8.7 release boundary exists.';
comment on column public.organizations.simplified_ceo_workspace_enabled is
  'CEO redesign remains disabled during the manager pilot, including for service-role writes. Task 8.7 must introduce the evidenced release boundary.';
