-- =============================================================================
-- S2. Replace every policy
-- =============================================================================
-- Every previous policy was either `USING (true)` or `auth.role() =
-- 'authenticated'`. The first made the visitors table world-readable to anyone
-- holding the publishable key, which by definition shipped inside the tablet
-- bundle: names, phones, emails, national id, iqama and passport numbers, and
-- signature images, for every visitor ever recorded, plus the ability to mark
-- anyone as exited.
--
-- The second is a different mistake. `auth.role()` returns the Postgres role,
-- `anon` or `authenticated`. It has nothing to do with the application role,
-- which is why admin and front desk were indistinguishable server-side: a front
-- desk account could delete an admin's profile or grant itself `role = 'admin'`.
--
-- anon now has no access to any table. The kiosk does not need it, because the
-- kiosk no longer talks to Supabase; it calls /api/kiosk/*, which acts as
-- service_role. service_role bypasses RLS entirely and so appears in no policy
-- below.

begin;

-- ── Clear the slate ─────────────────────────────────────────────────────────
-- Named drops would miss anything added by hand in the dashboard, and the point
-- of this migration is that nothing survives unreviewed.

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'floors', 'companies', 'employees', 'visitors',
        'profiles', 'form_config', 'document_settings'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.floors            enable row level security;
alter table public.companies         enable row level security;
alter table public.employees         enable row level security;
alter table public.visitors          enable row level security;
alter table public.profiles          enable row level security;
alter table public.form_config       enable row level security;
alter table public.document_settings enable row level security;

-- Force RLS so a table owner connecting directly is still subject to it.
alter table public.visitors  force row level security;
alter table public.employees force row level security;
alter table public.profiles  force row level security;

-- ── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.is_staff()
returns boolean language sql stable
set search_path = public, pg_temp
as $$ select public.current_app_role() in ('superadmin', 'admin', 'frontdesk') $$;

create or replace function public.is_admin()
returns boolean language sql stable
set search_path = public, pg_temp
as $$ select public.current_app_role() in ('superadmin', 'admin') $$;

grant execute on function public.is_staff(), public.is_admin() to authenticated, service_role;

-- ── visitors ────────────────────────────────────────────────────────────────
-- Front desk reads and closes visits. Only an admin may delete one, because a
-- deleted visit is the only way to lose the record of who was in the building.

create policy visitors_staff_read on public.visitors
  for select to authenticated using ((select public.is_staff()));

create policy visitors_staff_update on public.visitors
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy visitors_admin_delete on public.visitors
  for delete to authenticated using ((select public.is_admin()));

-- No insert policy for any signed-in user. Check-ins arrive only through
-- /api/kiosk/check-in, which allocates the visit code server-side.

-- ── companies and employees ─────────────────────────────────────────────────
-- The staff directory carries identity numbers, photographs and hire dates. It
-- was world-readable. It is now staff-only.

create policy companies_staff_read on public.companies
  for select to authenticated using ((select public.is_staff()));

create policy companies_staff_insert on public.companies
  for insert to authenticated with check ((select public.is_staff()));

create policy companies_staff_update on public.companies
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy companies_admin_delete on public.companies
  for delete to authenticated using ((select public.is_admin()));

create policy employees_staff_read on public.employees
  for select to authenticated using ((select public.is_staff()));

create policy employees_staff_insert on public.employees
  for insert to authenticated with check ((select public.is_staff()));

create policy employees_staff_update on public.employees
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy employees_admin_delete on public.employees
  for delete to authenticated using ((select public.is_admin()));

-- ── floors ──────────────────────────────────────────────────────────────────

create policy floors_staff_read on public.floors
  for select to authenticated using ((select public.is_staff()));

create policy floors_admin_write on public.floors
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ── profiles ────────────────────────────────────────────────────────────────
-- Previously FOR ALL to any authenticated user, so a front desk account could
-- read every staff row, delete an admin, or insert itself a row with
-- role = 'admin'. The role column itself is additionally guarded by the trigger
-- in the roles migration, which RLS cannot express.

-- Everyone may read their own row. The client needs this to learn its own role.
create policy profiles_read_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

-- An admin sees front desk accounts and its own. A super admin sees everything.
create policy profiles_admin_read on public.profiles
  for select to authenticated
  using (
    (select public.current_app_role()) = 'superadmin'
    or ((select public.current_app_role()) = 'admin' and role = 'frontdesk')
  );

create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (
    (select public.current_app_role()) = 'superadmin'
    or ((select public.current_app_role()) = 'admin' and role = 'frontdesk')
  );

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (
    (select public.current_app_role()) = 'superadmin'
    or ((select public.current_app_role()) = 'admin' and role = 'frontdesk')
  )
  with check (
    (select public.current_app_role()) = 'superadmin'
    or ((select public.current_app_role()) = 'admin' and role = 'frontdesk')
  );

create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (
    (select public.current_app_role()) = 'superadmin'
    or ((select public.current_app_role()) = 'admin' and role = 'frontdesk')
  );

-- ── form_config and document_settings ───────────────────────────────────────

create policy form_config_staff_read on public.form_config
  for select to authenticated using ((select public.is_staff()));

create policy form_config_admin_write on public.form_config
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy doc_settings_staff_read on public.document_settings
  for select to authenticated using ((select public.is_staff()));

create policy doc_settings_admin_write on public.document_settings
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ── Storage ─────────────────────────────────────────────────────────────────
-- `employee-photos` was a public bucket, so photographs of identifiable staff
-- sat on URLs that needed no authentication. It becomes private, served through
-- signed URLs. `document-logos` stays public: it holds the organisation's own
-- letterhead, which is not personal data, and the PDF export reads it directly.

update storage.buckets set public = false where id = 'employee-photos';

do $$
declare
  r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'storage_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy storage_logo_public_read on storage.objects
  for select using (bucket_id = 'document-logos');

create policy storage_photos_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'employee-photos' and (select public.is_staff()));

create policy storage_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('employee-photos', 'document-logos') and (select public.is_staff())
  );

create policy storage_staff_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('employee-photos', 'document-logos') and (select public.is_staff())
  );

create policy storage_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('employee-photos', 'document-logos') and (select public.is_admin())
  );

commit;
