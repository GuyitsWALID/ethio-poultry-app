update public.batches
set age_at_placement_days = 0
where age_at_placement_days is null;

alter table public.batches
  alter column age_at_placement_days set not null,
  drop constraint if exists batches_age_non_negative,
  add constraint batches_age_non_negative check (age_at_placement_days >= 0);

update public.flocks
set age_at_placement_days = 0
where age_at_placement_days is null;

alter table public.flocks
  alter column age_at_placement_days set not null;
