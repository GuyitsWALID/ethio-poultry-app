-- Distinguish recurring monthly operating costs from one-off expenses.

alter table public.cost_entries
  add column if not exists entry_kind text not null default 'one_off';

alter table public.cost_entries
  drop constraint if exists cost_entries_entry_kind_valid;

alter table public.cost_entries
  add constraint cost_entries_entry_kind_valid
  check (entry_kind in ('monthly', 'one_off'));

create index if not exists cost_entries_org_kind_date_idx
  on public.cost_entries(org_id, entry_kind, entry_date desc);

comment on column public.cost_entries.entry_kind is
  'Classifies a recurring monthly operating cost versus an irregular one-off expense; it does not create an automatic recurrence.';
