alter table if exists public.organizations
  add column if not exists branch_count integer,
  add column if not exists primary_location text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

alter table public.organizations enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'organizations_org_access'
  ) then
    create policy organizations_org_access
    on public.organizations
    for all
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.org_id = organizations.id
      )
    )
    with check (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.org_id = organizations.id
      )
    );
  end if;
end $$;
