do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'flock_status'
      and e.enumlabel = 'archived'
  ) then
    alter type public.flock_status add value 'archived';
  end if;
end $$;
