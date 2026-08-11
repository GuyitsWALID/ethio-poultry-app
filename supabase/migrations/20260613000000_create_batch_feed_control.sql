create table if not exists public.batch_feed_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  name text not null,
  source_type text not null default 'manual' check (source_type in ('default', 'manual', 'upload')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists batch_feed_templates_one_active
on public.batch_feed_templates(batch_id)
where is_active;

create index if not exists idx_batch_feed_templates_org_batch on public.batch_feed_templates(org_id, batch_id);

create table if not exists public.batch_feed_template_rows (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.batch_feed_templates(id) on delete cascade,
  week_number integer not null check (week_number >= 0),
  age_day_start integer not null check (age_day_start >= 0),
  age_day_end integer not null check (age_day_end >= age_day_start),
  feed_intake_std_g_per_head numeric(10,2),
  feed_intake_recommended_g_per_head numeric(10,2),
  target_weight_min_g numeric(10,2),
  target_weight_max_g numeric(10,2),
  feed_type_plan text,
  light_on_time time,
  light_off_time time,
  row_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_batch_feed_template_rows_template on public.batch_feed_template_rows(template_id, row_order);
create index if not exists idx_batch_feed_template_rows_week on public.batch_feed_template_rows(template_id, week_number);

create table if not exists public.batch_feed_template_milestones (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.batch_feed_templates(id) on delete cascade,
  week_number integer check (week_number is null or week_number >= 0),
  trigger_day integer not null check (trigger_day >= 0),
  title text not null,
  category text not null default 'feed' check (category in ('feed', 'weight', 'vaccine', 'light', 'note')),
  notes text,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_batch_feed_template_milestones_template on public.batch_feed_template_milestones(template_id, trigger_day);

create table if not exists public.batch_weight_check_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  flock_id uuid not null references public.flocks(id) on delete cascade,
  template_row_id uuid references public.batch_feed_template_rows(id) on delete set null,
  due_week_number integer not null check (due_week_number >= 0),
  due_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'missed')),
  weight_record_id uuid references public.weight_records(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch_weight_check_tasks_unique unique (org_id, batch_id, flock_id, due_week_number)
);

create index if not exists idx_batch_weight_check_tasks_org_batch on public.batch_weight_check_tasks(org_id, batch_id);
create index if not exists idx_batch_weight_check_tasks_flock_due on public.batch_weight_check_tasks(flock_id, due_date);
create index if not exists idx_batch_weight_check_tasks_status on public.batch_weight_check_tasks(status);

alter table public.batch_feed_templates enable row level security;
alter table public.batch_feed_template_rows enable row level security;
alter table public.batch_feed_template_milestones enable row level security;
alter table public.batch_weight_check_tasks enable row level security;

drop policy if exists "batch_feed_templates_select_scope" on public.batch_feed_templates;
create policy "batch_feed_templates_select_scope"
on public.batch_feed_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = batch_feed_templates.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where p.id = auth.uid()
      and p.org_id = batch_feed_templates.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id and f.id = fl.farm_id
        )
      )
  )
);

drop policy if exists "batch_feed_templates_write_scope" on public.batch_feed_templates;
create policy "batch_feed_templates_write_scope"
on public.batch_feed_templates
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = batch_feed_templates.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where p.id = auth.uid()
      and p.org_id = batch_feed_templates.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
            or exists (
              select 1
              from public.farms f
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where uba.profile_id = p.id and f.id = fl.farm_id
            )
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = batch_feed_templates.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where p.id = auth.uid()
      and p.org_id = batch_feed_templates.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
            or exists (
              select 1
              from public.farms f
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where uba.profile_id = p.id and f.id = fl.farm_id
            )
          )
        )
      )
  )
);

drop policy if exists "batch_feed_template_rows_select_scope" on public.batch_feed_template_rows;
create policy "batch_feed_template_rows_select_scope"
on public.batch_feed_template_rows
for select
to authenticated
using (
  exists (
    select 1 from public.batch_feed_templates t
    where t.id = batch_feed_template_rows.template_id
  )
);

drop policy if exists "batch_feed_template_rows_write_scope" on public.batch_feed_template_rows;
create policy "batch_feed_template_rows_write_scope"
on public.batch_feed_template_rows
for all
to authenticated
using (
  exists (
    select 1
    from public.batch_feed_templates t
    join public.profiles p on p.id = auth.uid() and p.org_id = t.org_id
    join public.batches b on b.id = t.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where t.id = batch_feed_template_rows.template_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
            or exists (
              select 1
              from public.farms f
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where uba.profile_id = p.id and f.id = fl.farm_id
            )
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.batch_feed_templates t
    join public.profiles p on p.id = auth.uid() and p.org_id = t.org_id
    join public.batches b on b.id = t.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where t.id = batch_feed_template_rows.template_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
            or exists (
              select 1
              from public.farms f
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where uba.profile_id = p.id and f.id = fl.farm_id
            )
          )
        )
      )
  )
);

drop policy if exists "batch_feed_template_milestones_select_scope" on public.batch_feed_template_milestones;
create policy "batch_feed_template_milestones_select_scope"
on public.batch_feed_template_milestones
for select
to authenticated
using (
  exists (
    select 1 from public.batch_feed_templates t
    where t.id = batch_feed_template_milestones.template_id
  )
);

drop policy if exists "batch_feed_template_milestones_write_scope" on public.batch_feed_template_milestones;
create policy "batch_feed_template_milestones_write_scope"
on public.batch_feed_template_milestones
for all
to authenticated
using (
  exists (
    select 1
    from public.batch_feed_templates t
    join public.profiles p on p.id = auth.uid() and p.org_id = t.org_id
    join public.batches b on b.id = t.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where t.id = batch_feed_template_milestones.template_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
            or exists (
              select 1
              from public.farms f
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where uba.profile_id = p.id and f.id = fl.farm_id
            )
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.batch_feed_templates t
    join public.profiles p on p.id = auth.uid() and p.org_id = t.org_id
    join public.batches b on b.id = t.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where t.id = batch_feed_template_milestones.template_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
            or exists (
              select 1
              from public.farms f
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where uba.profile_id = p.id and f.id = fl.farm_id
            )
          )
        )
      )
  )
);

drop policy if exists "batch_weight_check_tasks_select_scope" on public.batch_weight_check_tasks;
create policy "batch_weight_check_tasks_select_scope"
on public.batch_weight_check_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = batch_weight_check_tasks.flock_id
    where p.id = auth.uid()
      and p.org_id = batch_weight_check_tasks.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id and f.id = fl.farm_id
        )
      )
  )
);

drop policy if exists "batch_weight_check_tasks_write_scope" on public.batch_weight_check_tasks;
create policy "batch_weight_check_tasks_write_scope"
on public.batch_weight_check_tasks
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = batch_weight_check_tasks.flock_id
    where p.id = auth.uid()
      and p.org_id = batch_weight_check_tasks.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
            or exists (
              select 1
              from public.farms f
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where uba.profile_id = p.id and f.id = fl.farm_id
            )
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = batch_weight_check_tasks.flock_id
    where p.id = auth.uid()
      and p.org_id = batch_weight_check_tasks.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id)
            or exists (
              select 1
              from public.farms f
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where uba.profile_id = p.id and f.id = fl.farm_id
            )
          )
        )
      )
  )
);
