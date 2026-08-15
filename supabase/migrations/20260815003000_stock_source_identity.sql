-- Ensure every stock movement has a stable source identity. Feed and Daily
-- Record availability checks deliberately exclude their own generated rows;
-- nullable source fields make SQL `not (...)` predicates evaluate to unknown
-- and can hide otherwise valid receipts from those checks.

create or replace function public.ensure_stock_source_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_kind is null or btrim(new.source_kind) = '' then
    new.source_kind := 'manual_inventory_movement';
  end if;
  if new.source_key is null or btrim(new.source_key) = '' then
    new.source_key := new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_stock_source_identity on public.stock_ledger;
create trigger ensure_stock_source_identity
before insert on public.stock_ledger
for each row execute function public.ensure_stock_source_identity();

update public.stock_ledger
set source_kind = 'manual_inventory_movement',
    source_key = id::text
where source_kind is null or source_key is null
   or btrim(source_kind) = '' or btrim(source_key) = '';

alter table public.stock_ledger
  drop constraint if exists stock_ledger_source_identity_complete;
alter table public.stock_ledger
  add constraint stock_ledger_source_identity_complete
  check (
    source_kind is not null and btrim(source_kind) <> ''
    and source_key is not null and btrim(source_key) <> ''
  ) not valid;
alter table public.stock_ledger validate constraint stock_ledger_source_identity_complete;

comment on function public.ensure_stock_source_identity() is
  'Assigns a stable source identity to manually recorded stock movements so generated-source exclusions remain null-safe.';
