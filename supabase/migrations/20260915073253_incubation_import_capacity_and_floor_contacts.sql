-- =============================================================================
-- Incubated companies: CSV/Excel import, founder and employee capacity, and the
-- administration contacts shown when a company's list is full.
-- =============================================================================

-- ── Company incubation details ──────────────────────────────────────────────
-- A null limit means the company has no cap, which keeps companies created
-- before this migration working exactly as they did.

alter table public.companies
  add column if not exists cr_number text,
  add column if not exists founders_limit integer,
  add column if not exists employees_limit integer,
  add column if not exists incubation_start date,
  add column if not exists incubation_end date,
  add column if not exists import_ref text;

alter table public.companies
  add constraint companies_founders_limit_check check (founders_limit is null or founders_limit between 0 and 1000),
  add constraint companies_employees_limit_check check (employees_limit is null or employees_limit between 0 and 100000),
  add constraint companies_incubation_range_check check (
    incubation_start is null or incubation_end is null or incubation_end >= incubation_start
  ),
  add constraint companies_cr_number_length_check check (cr_number is null or length(cr_number) <= 32);

-- One import row creates at most one company, so re-importing the same file
-- cannot duplicate it.
create unique index if not exists companies_import_ref_key on public.companies (import_ref) where import_ref is not null;

-- ── Employee type ───────────────────────────────────────────────────────────

alter table public.employees
  add column if not exists employee_type text not null default 'employee';

alter table public.employees
  add constraint employees_employee_type_check check (employee_type in ('founder', 'employee'));

-- The registration export does not always carry a gender, and inventing one
-- would falsify the record. The existing check still limits it to male/female.
alter table public.employees alter column gender drop not null;

create index if not exists employees_company_type_idx on public.employees (company_id, employee_type);

-- ── Only an admin changes incubation details ────────────────────────────────
-- Front desk and admin share the authenticated role, so column grants cannot
-- separate them. This trigger does.

create or replace function private.protect_company_incubation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not private.is_admin() then
    if tg_op = 'INSERT' then
      if new.founders_limit is not null or new.employees_limit is not null
         or new.incubation_start is not null or new.incubation_end is not null
         or new.cr_number is not null or new.import_ref is not null then
        raise exception 'only an admin may set incubation details' using errcode = '42501';
      end if;
    elsif (new.founders_limit, new.employees_limit, new.incubation_start, new.incubation_end, new.cr_number, new.import_ref)
          is distinct from
          (old.founders_limit, old.employees_limit, old.incubation_start, old.incubation_end, old.cr_number, old.import_ref) then
      raise exception 'only an admin may change incubation details' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_protect_incubation on public.companies;
create trigger companies_protect_incubation
  before insert or update on public.companies
  for each row execute function private.protect_company_incubation();

-- ── Front desk cannot add past a company's limit ────────────────────────────
-- An admin is not capped: they can raise the limit or record an exception.
-- The advisory lock serialises two front desk screens adding to the same
-- company at the same moment.

create or replace function private.enforce_company_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if current_user not in ('authenticated', 'anon') or private.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.company_id = old.company_id and new.employee_type = old.employee_type then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('company_capacity:' || new.company_id));

  select case new.employee_type when 'founder' then c.founders_limit else c.employees_limit end
    into v_limit
  from public.companies c
  where c.id = new.company_id;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_used
  from public.employees e
  where e.company_id = new.company_id
    and e.employee_type = new.employee_type
    and e.id <> new.id;

  if v_used >= v_limit then
    raise exception 'capacity_full' using errcode = 'P0001', detail = new.employee_type;
  end if;
  return new;
end;
$$;

drop trigger if exists employees_enforce_capacity on public.employees;
create trigger employees_enforce_capacity
  before insert or update of company_id, employee_type on public.employees
  for each row execute function private.enforce_company_capacity();

-- ── Administration contacts per floor ───────────────────────────────────────

create table if not exists public.floor_contacts (
  id uuid primary key default gen_random_uuid(),
  floor integer not null check (floor > 0),
  name text not null check (length(btrim(name)) between 1 and 120),
  phone text not null default '' check (length(phone) <= 32),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists floor_contacts_floor_idx on public.floor_contacts (floor, sort_order);

alter table public.floor_contacts enable row level security;

create policy floor_contacts_select on public.floor_contacts
  for select to authenticated using ((select private.is_staff()));
create policy floor_contacts_insert on public.floor_contacts
  for insert to authenticated with check ((select private.is_admin()));
create policy floor_contacts_update on public.floor_contacts
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy floor_contacts_delete on public.floor_contacts
  for delete to authenticated using ((select private.is_admin()));

revoke all on public.floor_contacts from anon, public;
grant select, insert, update, delete on public.floor_contacts to authenticated;
grant all on public.floor_contacts to service_role;

-- ── Import ──────────────────────────────────────────────────────────────────
-- One call, one transaction: every selected company and its founder is created,
-- or none are. Rows already imported (same import_ref) are skipped.

create or replace function public.admin_import_companies(p_companies jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_founder jsonb;
  v_company_id text;
  v_next integer;
  v_created integer := 0;
  v_skipped integer := 0;
  v_founders integer := 0;
begin
  if not private.is_admin() then
    raise exception 'only an admin may import companies' using errcode = '42501';
  end if;
  if p_companies is null or jsonb_typeof(p_companies) <> 'array' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('employee_number'));
  select coalesce(max(e.employee_number::integer), 0) into v_next
  from public.employees e
  where e.employee_number ~ '^\d{1,9}$';

  for v_item in select value from jsonb_array_elements(p_companies) loop
    if nullif(v_item ->> 'importRef', '') is not null
       and exists (select 1 from public.companies c where c.import_ref = v_item ->> 'importRef') then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_company_id := gen_random_uuid()::text;

    insert into public.companies (
      id, name, name_ar, phone, floor, employee_count,
      cr_number, founders_limit, employees_limit, incubation_start, incubation_end, import_ref
    ) values (
      v_company_id,
      v_item ->> 'name',
      v_item ->> 'nameAr',
      coalesce(v_item ->> 'phone', ''),
      (v_item ->> 'floor')::integer,
      0,
      nullif(v_item ->> 'crNumber', ''),
      (v_item ->> 'foundersLimit')::integer,
      (v_item ->> 'employeesLimit')::integer,
      nullif(v_item ->> 'incubationStart', '')::date,
      nullif(v_item ->> 'incubationEnd', '')::date,
      nullif(v_item ->> 'importRef', '')
    );
    v_created := v_created + 1;

    v_founder := v_item -> 'founder';
    if v_founder is not null and jsonb_typeof(v_founder) = 'object' then
      v_next := v_next + 1;
      insert into public.employees (
        id, company_id, employee_number, name, name_ar, phone, email,
        nationality_type, nationality_id_number, country_code, gender,
        employment_status, job_type, verification_status, employee_type
      ) values (
        gen_random_uuid()::text,
        v_company_id,
        lpad(v_next::text, 4, '0'),
        v_founder ->> 'name',
        v_founder ->> 'nameAr',
        coalesce(v_founder ->> 'phone', ''),
        nullif(v_founder ->> 'email', ''),
        v_founder ->> 'nationalityType',
        v_founder ->> 'nationalityIdNumber',
        coalesce(v_founder ->> 'countryCode', ''),
        nullif(v_founder ->> 'gender', ''),
        'active',
        'full_time',
        'verified',
        'founder'
      );
      v_founders := v_founders + 1;
    end if;
  end loop;

  return jsonb_build_object('created', v_created, 'skipped', v_skipped, 'founders', v_founders);
end;
$$;

revoke all on function public.admin_import_companies(jsonb) from public, anon;
grant execute on function public.admin_import_companies(jsonb) to authenticated, service_role;
