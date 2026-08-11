create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  default_route text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_code_check check (code = lower(code))
);

create table if not exists public.role_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  role_code text not null references public.roles(code) on delete cascade,
  created_at timestamptz not null default now(),
  constraint role_aliases_alias_check check (alias = lower(alias))
);

insert into public.roles (code, display_name, default_route)
values
  ('super_admin', 'Super Admin', '/app/admin'),
  ('system_admin', 'System Admin', '/app/admin'),
  ('ceo', 'CEO / Manager', '/app/admin'),
  ('farm_manager', 'Farm Manager', '/app/farms'),
  ('veterinarian', 'Veterinarian', '/app/health'),
  ('store_keeper', 'Store Keeper', '/app/inventory')
on conflict (code) do update
set display_name = excluded.display_name,
    default_route = excluded.default_route,
    updated_at = now();

insert into public.role_aliases (alias, role_code)
values
  ('manager', 'ceo'),
  ('ceo', 'ceo'),
  ('farm_manager', 'farm_manager'),
  ('veterinarian', 'veterinarian'),
  ('store_keeper', 'store_keeper'),
  ('system_admin', 'system_admin'),
  ('super_admin', 'super_admin')
on conflict (alias) do update
set role_code = excluded.role_code;

create or replace function public.normalize_user_role(input_role text)
returns public.user_role
language plpgsql
stable
as $$
declare
  normalized text;
begin
  normalized := lower(trim(coalesce(input_role, '')));

  if normalized = '' then
    return 'ceo'::public.user_role;
  end if;

  if exists (
    select 1
    from public.role_aliases ra
    where ra.alias = normalized
      and ra.role_code = 'ceo'
  ) then
    return 'ceo'::public.user_role;
  end if;

  if normalized in ('super_admin', 'system_admin', 'farm_manager', 'veterinarian', 'store_keeper') then
    return normalized::public.user_role;
  end if;

  return 'ceo'::public.user_role;
end;
$$;

create or replace function public.set_default_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is null then
    new.role := public.normalize_user_role(
      coalesce(
        current_setting('request.jwt.claims', true)::jsonb ->> 'role',
        current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_default_role on public.profiles;
create trigger trg_profiles_default_role
before insert on public.profiles
for each row
execute function public.set_default_profile_role();
