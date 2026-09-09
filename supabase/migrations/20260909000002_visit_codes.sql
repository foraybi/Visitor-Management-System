-- =============================================================================
-- S5. Fix the day-two data loss
-- =============================================================================
-- `visitors.id` was the four-digit number shown to the visitor, generated in the
-- browser by counting today's rows and padding. It restarted at 0001 every
-- morning while the column was a TEXT PRIMARY KEY, so the first check-in of the
-- second day collided with the first check-in of the first day. The insert error
-- was swallowed by a console.error, so the visitor was handed an id card while
-- nothing reached the database. Certain, silent, and starting on day two.
--
-- Two changes: the primary key becomes a uuid, and the visitor-facing number
-- becomes `visit_code`, allocated server-side from a per-day counter. Allocating
-- it in Postgres also removes the race between two tablets checking in at once,
-- which the browser-side count could never avoid.

begin;

-- ── The visitor-facing code ─────────────────────────────────────────────────

alter table public.visitors add column if not exists visit_code text;
update public.visitors set visit_code = id where visit_code is null;
alter table public.visitors alter column visit_code set not null;

-- ── Swap the primary key to a uuid ──────────────────────────────────────────
-- Guarded so re-running the migration is harmless.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visitors'
      and column_name = 'id' and data_type <> 'uuid'
  ) then
    alter table public.visitors add column id_uuid uuid not null default gen_random_uuid();
    alter table public.visitors drop constraint if exists visitors_pkey;
    alter table public.visitors drop column id;
    alter table public.visitors rename column id_uuid to id;
    alter table public.visitors add primary key (id);
  end if;
end $$;

-- One code per day. Two visitors on different days may share 0001; two visitors
-- on the same day may not.
create unique index if not exists visitors_visit_code_per_day
  on public.visitors (date, visit_code);

-- Front desk filters by company, which had no index.
create index if not exists idx_visitors_company on public.visitors (visited_company_id);

-- ── Allocating a code ───────────────────────────────────────────────────────
-- A counter row per day. The upsert is a single atomic statement, so two
-- concurrent tablets cannot be handed the same number.

create table if not exists public.visit_code_counters (
  visit_date text primary key,
  last_code  integer not null default 0
);

alter table public.visit_code_counters enable row level security;
-- No policies: only service_role, which bypasses RLS, ever touches this.

create or replace function public.allocate_visit_code(p_date text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_code integer;
begin
  insert into public.visit_code_counters (visit_date, last_code)
  values (p_date, 1)
  on conflict (visit_date)
    do update set last_code = public.visit_code_counters.last_code + 1
  returning last_code into next_code;

  return lpad(next_code::text, 4, '0');
end;
$$;

revoke execute on function public.allocate_visit_code(text) from public, anon, authenticated;
grant execute on function public.allocate_visit_code(text) to service_role;

-- Seed the counters from any history already present, so today's numbering
-- continues rather than restarting and colliding with the rows just migrated.
insert into public.visit_code_counters (visit_date, last_code)
select date, max(coalesce(nullif(regexp_replace(visit_code, '\D', '', 'g'), ''), '0')::int)
from public.visitors
group by date
on conflict (visit_date) do update
  set last_code = greatest(public.visit_code_counters.last_code, excluded.last_code);

-- ── Referential integrity ───────────────────────────────────────────────────
-- `visited_company_id` never had a foreign key, so orphan visits were possible.
-- Left as NOT VALID: existing rows may already be orphaned, and blocking this
-- migration on historic data would stop the fix above from shipping. New rows
-- are checked from here on.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'visitors_visited_company_id_fkey'
  ) then
    alter table public.visitors
      add constraint visitors_visited_company_id_fkey
      foreign key (visited_company_id) references public.companies (id)
      on delete restrict
      not valid;
  end if;
end $$;

-- ── Constrain the columns TypeScript was asserting blindly ──────────────────

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visitors_status_check') then
    alter table public.visitors add constraint visitors_status_check
      check (status in ('active', 'exited'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visitors_visitor_type_check') then
    alter table public.visitors add constraint visitors_visitor_type_check
      check (visitor_type in ('visitor', 'employee'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visitors_nationality_type_check') then
    alter table public.visitors add constraint visitors_nationality_type_check
      check (nationality_type in ('national_id', 'iqama', 'passport'));
  end if;
end $$;

commit;
