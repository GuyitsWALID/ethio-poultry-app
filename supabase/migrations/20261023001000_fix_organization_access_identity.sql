-- Organization access must follow the active profile, which is the canonical
-- tenant identity used by the application. New users do not carry a top-level
-- org_id JWT claim, so claim-only policies hide their organization row.
drop policy if exists organizations_org_access on public.organizations;

create policy organizations_org_access
on public.organizations
for all
to authenticated
using (id = public.current_org_id())
with check (id = public.current_org_id());
