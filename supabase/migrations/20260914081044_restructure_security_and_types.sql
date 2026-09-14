-- =============================================================================
-- Restructure: private helpers, least-privilege grants, real types, constraints
-- =============================================================================
-- Findings from the Supabase security and performance advisors, and a review
-- against the Postgres best practices, fixed in one pass.
--
-- Security
--   * The role helpers and trigger functions lived in `public`, so they were
--     Data API endpoints (/rest/v1/rpc/...). Two SECURITY DEFINER functions were
--     executable by `anon`. Helpers move to a `private` schema the API does not
--     expose; the three RPCs the kiosk API calls become SECURITY INVOKER, so only
--     service_role, which holds the table grants, can use them at all.
--   * `authenticated` held TRUNCATE, TRIGGER and REFERENCES on every table, and
--     INSERT/UPDATE/DELETE on tables the app only reads. Grants are now exactly
--     what the staff app does. Front desk can update only `exit_time` and
--     `status` on a visit, not rewrite who the visitor was.
--   * Default privileges handed every future table and function to anon and
--     authenticated. They no longer do; exposure is opt-in.
--   * Anyone could list every file in `document-logos`, because a public bucket
--     does not need a SELECT policy to serve its URLs but had one anyway. Front
--     desk could also replace the organisation's letterhead. Both buckets now
--     accept images only, with a size limit.
--   * Front desk could mark an employee verified, which is an admin decision.
--   * Two super admins demoting or deleting each other at the same moment could
--     both pass the "not the last super admin" check. That check now takes a
--     lock, and also covers demotion, not only deletion.
--
-- Schema
--   * Dates and times were TEXT. `visitors.date`, `visit_code_counters.visit_date`
--     and `employees.hire_date` become DATE; `entry_time` and `exit_time` become
--     TIMESTAMPTZ. The API returns the same strings for dates and ISO 8601 for
--     timestamps, which is what every reader already parses.
--   * CHECK constraints for every enumerated column TypeScript was asserting.
--   * The visitors -> companies foreign key was NOT VALID. It is validated.
--
-- Performance
--   * Policies were FOR ALL alongside a separate SELECT policy, so every read
--     evaluated two policies. One policy per action now.
--   * A duplicate index, two indexes made redundant by unique indexes, and a
--     low-selectivity status index are dropped; the indexes the queries actually
--     need are added.
--   * `kiosk_rate_limit` was never pruned. Each hit now removes that device's
--     expired windows.

-- ── 0. Private schema ───────────────────────────────────────────────────────
-- Not listed in the API's exposed schemas, so nothing here is reachable over
-- REST. `authenticated` needs USAGE because policies call these helpers with the
-- caller's privileges.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ── 1. Role helpers ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so a policy on `profiles` can read the caller's role without
-- recursing through that same policy. An empty search_path and qualified names
-- mean no object created later in another schema can shadow what these call.

create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('superadmin', 'admin', 'frontdesk'), false)
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('superadmin', 'admin'), false)
$$;

revoke all on function private.current_app_role(), private.is_staff(), private.is_admin()
  from public, anon;
grant execute on function private.current_app_role(), private.is_staff(), private.is_admin()
  to authenticated, service_role;

-- ── 2. Trigger functions ────────────────────────────────────────────────────

-- SECURITY INVOKER, so current_user is the role that fired the trigger. Through
-- the Data API that is `authenticated` or `anon`; from the SQL editor, psql, the
-- auth server or service_role it is a trusted database role.
create or replace function private.enforce_role_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor text;
begin
  if current_user in ('authenticated', 'anon') then
    actor := private.current_app_role();

    if tg_op = 'INSERT' then
      if new.role in ('admin', 'superadmin') and actor is distinct from 'superadmin' then
        raise exception 'only a superadmin may create an % account', new.role
          using errcode = '42501';
      end if;
      if new.role = 'frontdesk' and (actor is null or actor not in ('admin', 'superadmin')) then
        raise exception 'only an admin or superadmin may create staff accounts'
          using errcode = '42501';
      end if;
    end if;

    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      if actor is distinct from 'superadmin' then
        raise exception 'only a superadmin may change a role' using errcode = '42501';
      end if;
      if old.id = (select auth.uid()) and old.role = 'superadmin' then
        raise exception 'a superadmin cannot change its own role' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Applies to every role, the SQL editor included: demoting the last super
  -- admin leaves nobody able to assign roles, and nothing in the app undoes it.
  if tg_op = 'UPDATE' and old.role = 'superadmin' and new.role is distinct from 'superadmin' then
    perform pg_advisory_xact_lock(hashtext('public.profiles.superadmin'));
    if (select count(*) from public.profiles where role = 'superadmin') <= 1 then
      raise exception 'cannot demote the last superadmin' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- SECURITY DEFINER because the delete usually arrives as a cascade from
-- auth.users, run by the auth server's role, which cannot read profiles. The
-- advisory lock serialises concurrent removals, so two sessions cannot each see
-- the other as the spare super admin.
create or replace function private.prevent_last_superadmin_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'superadmin' then
    perform pg_advisory_xact_lock(hashtext('public.profiles.superadmin'));
    if (select count(*) from public.profiles where role = 'superadmin') <= 1 then
      raise exception 'cannot remove the last superadmin' using errcode = '42501';
    end if;
  end if;
  return old;
end;
$$;

-- Front desk adds employees as pending; only an admin may verify one.
create or replace function private.enforce_employee_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.verification_status = 'verified'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified')
     and not private.is_admin() then
    raise exception 'only an admin may verify an employee' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function
  private.enforce_role_assignment(),
  private.prevent_last_superadmin_delete(),
  private.enforce_employee_verification()
from public, anon, authenticated;

-- ── 3. Remove the old policies, triggers and public helpers ─────────────────
-- Policies and triggers depend on the functions, so they go first. Every policy
-- on these tables is dropped by query rather than by name, so nothing added by
-- hand in the dashboard survives unreviewed.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where (schemaname = 'public' and tablename in (
             'floors', 'companies', 'employees', 'visitors', 'profiles',
             'form_config', 'document_settings', 'kiosk_devices',
             'visit_code_counters', 'kiosk_rate_limit'))
       or (schemaname = 'storage' and tablename = 'objects' and policyname like 'storage\_%')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

drop trigger if exists profiles_enforce_role_assignment on public.profiles;
drop trigger if exists profiles_prevent_last_superadmin_delete on public.profiles;

drop function if exists public.is_staff();
drop function if exists public.is_admin();
drop function if exists public.current_app_role();
drop function if exists public.enforce_role_assignment();
drop function if exists public.prevent_last_superadmin_delete();

create trigger profiles_enforce_role_assignment
  before insert or update on public.profiles
  for each row execute function private.enforce_role_assignment();

create trigger profiles_prevent_last_superadmin_delete
  before delete on public.profiles
  for each row execute function private.prevent_last_superadmin_delete();

create trigger employees_enforce_verification
  before insert or update on public.employees
  for each row execute function private.enforce_employee_verification();

-- ── 4. Real types ───────────────────────────────────────────────────────────

alter table public.visitors
  alter column "date"     type date        using "date"::date,
  alter column entry_time type timestamptz using entry_time::timestamptz,
  alter column exit_time  type timestamptz using nullif(exit_time, '')::timestamptz;

alter table public.employees
  alter column hire_date type date using nullif(hire_date, '')::date;

alter table public.visit_code_counters
  alter column visit_date type date using visit_date::date;

-- ── 5. Not null where the app already assumes a value ───────────────────────

update public.floors            set created_at = now() where created_at is null;
update public.companies         set created_at = now() where created_at is null;
update public.employees         set created_at = now() where created_at is null;
update public.visitors          set created_at = now() where created_at is null;
update public.profiles          set created_at = now() where created_at is null;
update public.form_config       set updated_at = now() where updated_at is null;
update public.document_settings set updated_at = now() where updated_at is null;

alter table public.floors            alter column created_at set not null;
alter table public.companies         alter column created_at set not null;
alter table public.employees         alter column created_at set not null;
alter table public.visitors          alter column created_at set not null;
alter table public.profiles          alter column created_at set not null;
alter table public.form_config       alter column updated_at set not null;
alter table public.document_settings alter column updated_at set not null;

update public.document_settings set
  admission_name        = coalesce(admission_name, ''),
  admission_label       = coalesce(admission_label, 'Admission Name'),
  form_id_version       = coalesce(form_id_version, ''),
  form_id_version_label = coalesce(form_id_version_label, 'Form ID / Version'),
  vision_number         = coalesce(vision_number, ''),
  vision_number_label   = coalesce(vision_number_label, 'Vision Number'),
  form_name             = coalesce(form_name, 'Visitor Management Report'),
  logo_url              = coalesce(logo_url, '');

alter table public.document_settings
  alter column admission_name        set not null,
  alter column admission_label       set not null,
  alter column form_id_version       set not null,
  alter column form_id_version_label set not null,
  alter column vision_number         set not null,
  alter column vision_number_label   set not null,
  alter column form_name             set not null,
  alter column logo_url              set not null;

-- ── 6. Constraints ──────────────────────────────────────────────────────────

alter table public.employees
  add constraint employees_nationality_type_check
    check (nationality_type in ('national_id', 'iqama', 'passport')),
  add constraint employees_gender_check
    check (gender in ('male', 'female')),
  add constraint employees_employment_status_check
    check (employment_status in ('active', 'inactive')),
  add constraint employees_job_type_check
    check (job_type in ('full_time', 'part_time', 'internship', 'contract')),
  add constraint employees_verification_status_check
    check (verification_status in ('verified', 'pending'));

-- A closed visit has an exit time and an open one does not. Check-out sets both
-- together, so a row with only one of them is a failed half-write.
alter table public.visitors
  add constraint visitors_visit_code_format_check check (visit_code ~ '^[0-9]{4}$'),
  add constraint visitors_exit_matches_status_check
    check ((status = 'exited') = (exit_time is not null));

alter table public.visitors validate constraint visitors_visited_company_id_fkey;

-- Codes are four digits, and check-out accepts no more. Refusing the ten
-- thousandth check-in of a day is better than issuing a code nobody can use.
alter table public.visit_code_counters
  add constraint visit_code_counters_last_code_check check (last_code between 0 and 9999);

alter table public.kiosk_rate_limit
  add constraint kiosk_rate_limit_hits_check check (hits >= 0);

alter table public.kiosk_devices
  add constraint kiosk_devices_token_hash_format_check check (token_hash ~ '^[0-9a-f]{64}$');

alter table public.floors
  add constraint floors_number_key unique (number);

alter table public.profiles
  add constraint profiles_email_lowercase_check check (email = lower(email));

-- Single-row settings tables.
alter table public.form_config
  add constraint form_config_singleton_check check (id = 1),
  add constraint form_config_fields_array_check check (jsonb_typeof(fields) = 'array');

alter table public.document_settings
  add constraint document_settings_singleton_check check (id = 1);

-- ── 7. Indexes ──────────────────────────────────────────────────────────────

-- Identical to idx_employees_company.
drop index if exists public.idx_employees_company_id;
-- The unique constraint on token_hash already indexes it.
drop index if exists public.idx_kiosk_devices_active;
-- `date` leads the unique (date, visit_code) index, which serves the same scans.
drop index if exists public.idx_visitors_date;
-- Two values; the planner would not use it once the table is large.
drop index if exists public.idx_visitors_status;
-- Replaced by a partial index matching the only query: active employees.
drop index if exists public.idx_employees_id_number;

-- Front desk lists visits newest first.
create index if not exists idx_visitors_entry_time
  on public.visitors (entry_time desc);

-- /api/kiosk/lookup-employee.
create index if not exists idx_employees_active_id_number
  on public.employees (nationality_id_number)
  where employment_status = 'active';

-- Pruning expired windows.
create index if not exists idx_kiosk_rate_limit_window_start
  on public.kiosk_rate_limit (window_start);

-- ── 8. Kiosk RPCs ───────────────────────────────────────────────────────────
-- Called only by the kiosk API as service_role. SECURITY INVOKER: a role without
-- the table grants gets "permission denied" even if EXECUTE is granted by
-- mistake later.

drop function if exists public.allocate_visit_code(text);

create or replace function public.allocate_visit_code(p_date date)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_code integer;
begin
  insert into public.visit_code_counters as c (visit_date, last_code)
  values (p_date, 1)
  on conflict (visit_date)
    do update set last_code = c.last_code + 1
  returning c.last_code into next_code;

  return lpad(next_code::text, 4, '0');
end;
$$;

create or replace function public.kiosk_rate_limit_hit(
  p_device_id      uuid,
  p_action         text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  bucket      timestamptz;
  count_after integer;
begin
  if p_window_seconds is null or p_window_seconds <= 0 or p_limit is null or p_limit < 0 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;

  bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.kiosk_rate_limit as r (device_id, action, window_start, hits)
  values (p_device_id, p_action, bucket, 1)
  on conflict (device_id, action, window_start)
    do update set hits = r.hits + 1
  returning r.hits into count_after;

  -- Housekeeping without a scheduler: this device's windows older than a day
  -- carry no information. Uses the primary key's leading column.
  delete from public.kiosk_rate_limit
  where device_id = p_device_id
    and window_start < now() - interval '1 day';

  return count_after <= p_limit;
end;
$$;

create or replace function public.kiosk_rate_limit_prune()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.kiosk_rate_limit where window_start < now() - interval '1 day'
$$;

-- ── 9. Grants ───────────────────────────────────────────────────────────────
-- Grants decide whether a role reaches a table at all; policies decide which
-- rows. Start from nothing and grant what the staff app does.

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select, insert, update, delete on public.floors    to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.employees to authenticated;

-- Visits are created only by the kiosk API. Staff close them and nothing else.
grant select, delete                on public.visitors to authenticated;
grant update (exit_time, status)    on public.visitors to authenticated;

-- Accounts are created and removed by /api/staff/accounts as service_role.
grant select on public.profiles      to authenticated;
grant select on public.kiosk_devices to authenticated;

-- Saved with upsert.
grant select, insert, update on public.form_config       to authenticated;
grant select, insert, update on public.document_settings to authenticated;

-- visit_code_counters and kiosk_rate_limit: no grants. service_role only.

grant all on all tables in schema public to service_role;
grant execute on function
  public.allocate_visit_code(date),
  public.kiosk_rate_limit_hit(uuid, text, integer, integer),
  public.kiosk_rate_limit_prune()
to service_role;

-- New objects are no longer reachable by default. Grant each one deliberately.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- ── 10. Policies ────────────────────────────────────────────────────────────
-- One policy per action, so no read evaluates two. Helpers are wrapped in a
-- scalar subquery so Postgres evaluates them once per statement, not per row.

-- floors: staff read, admin write.
create policy floors_select on public.floors
  for select to authenticated using ((select private.is_staff()));
create policy floors_insert on public.floors
  for insert to authenticated with check ((select private.is_admin()));
create policy floors_update on public.floors
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy floors_delete on public.floors
  for delete to authenticated using ((select private.is_admin()));

-- companies and employees: staff maintain the directory, admin deletes.
create policy companies_select on public.companies
  for select to authenticated using ((select private.is_staff()));
create policy companies_insert on public.companies
  for insert to authenticated with check ((select private.is_staff()));
create policy companies_update on public.companies
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy companies_delete on public.companies
  for delete to authenticated using ((select private.is_admin()));

create policy employees_select on public.employees
  for select to authenticated using ((select private.is_staff()));
create policy employees_insert on public.employees
  for insert to authenticated with check ((select private.is_staff()));
create policy employees_update on public.employees
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy employees_delete on public.employees
  for delete to authenticated using ((select private.is_admin()));

-- visitors: staff read and close; only an admin deletes the record of a visit.
create policy visitors_select on public.visitors
  for select to authenticated using ((select private.is_staff()));
create policy visitors_update on public.visitors
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy visitors_delete on public.visitors
  for delete to authenticated using ((select private.is_admin()));

-- profiles: your own row; an admin also sees front desk; a super admin sees all.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.current_app_role()) = 'superadmin'
    or ((select private.current_app_role()) = 'admin' and role = 'frontdesk')
  );

-- form_config and document_settings: staff read, admin saves.
create policy form_config_select on public.form_config
  for select to authenticated using ((select private.is_staff()));
create policy form_config_insert on public.form_config
  for insert to authenticated with check ((select private.is_admin()));
create policy form_config_update on public.form_config
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy document_settings_select on public.document_settings
  for select to authenticated using ((select private.is_staff()));
create policy document_settings_insert on public.document_settings
  for insert to authenticated with check ((select private.is_admin()));
create policy document_settings_update on public.document_settings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- kiosk_devices: admins may see which tablets exist. Provisioning and
-- revocation run as service_role.
create policy kiosk_devices_select on public.kiosk_devices
  for select to authenticated using ((select private.is_admin()));

-- visit_code_counters and kiosk_rate_limit keep RLS on with no policies: deny
-- everyone but service_role, which bypasses RLS.

-- ── 11. Storage ─────────────────────────────────────────────────────────────
-- A public bucket serves /object/public/ URLs without any policy. A SELECT
-- policy on it only adds the ability to list and download through the API, so
-- logos are readable through the API by staff alone (the PDF export downloads
-- the logo that way). Upsert needs SELECT, INSERT and UPDATE together.

create policy storage_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'employee-photos' and (select private.is_staff()));
create policy storage_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'employee-photos' and (select private.is_staff()));
create policy storage_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'employee-photos' and (select private.is_staff()))
  with check (bucket_id = 'employee-photos' and (select private.is_staff()));
create policy storage_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'employee-photos' and (select private.is_admin()));

create policy storage_logos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'document-logos' and (select private.is_staff()));
create policy storage_logos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'document-logos' and (select private.is_admin()));
create policy storage_logos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'document-logos' and (select private.is_admin()))
  with check (bucket_id = 'document-logos' and (select private.is_admin()));
create policy storage_logos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'document-logos' and (select private.is_admin()));

-- Raster images only. SVG is excluded: it can carry script, and the logo
-- bucket is public.
update storage.buckets
set file_size_limit    = 5 * 1024 * 1024,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id in ('employee-photos', 'document-logos');

-- ── 12. Stale authorisation data ────────────────────────────────────────────
-- The role used to be copied into user_metadata, which the user can edit. It is
-- not read anywhere, and should not sit there looking authoritative.

update auth.users
set raw_user_meta_data = raw_user_meta_data - 'role'
where raw_user_meta_data ? 'role';

-- ── 13. Documentation ───────────────────────────────────────────────────────

comment on schema private is
  'Helpers for policies and triggers. Not exposed through the Data API.';
comment on table public.visit_code_counters is
  'Per-day visit code counter. service_role only, through allocate_visit_code().';
comment on table public.kiosk_rate_limit is
  'Fixed-window rate limit counters for the kiosk API. service_role only.';
comment on column public.visitors.visit_code is
  'Four-digit code shown to the visitor. Unique per day, allocated by allocate_visit_code().';
comment on column public.companies.employee_count is
  'Unused: the app counts the embedded employees rows instead.';
