-- =============================================================================
-- One database call per kiosk request
-- =============================================================================
-- Each kiosk endpoint made three to five sequential round trips: look up the
-- tablet, update its last-seen time, then the work itself in several steps.
-- With the API and the database on different continents every round trip cost
-- 600-1000ms, while Postgres spent 2-19ms on each query. These functions do the
-- device check, the rate limit and the work in one call and one transaction.
--
-- Called only by the kiosk API as service_role. SECURITY INVOKER throughout: a
-- role without the table grants gets "permission denied" even if EXECUTE were
-- granted by mistake later. Expected refusals return {"error": "..."} so the
-- API can map them to the same HTTP responses as before.

-- ── The tablet check, shared by every function ──────────────────────────────
-- Checks the token hash and records the tablet as seen, as one statement.
-- Returns null for an unknown or revoked tablet.

create or replace function private.kiosk_device(p_token_hash text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  update public.kiosk_devices
  set last_seen_at = now()
  where token_hash = p_token_hash and active
  returning id
$$;

revoke all on function private.kiosk_device(text) from public, anon, authenticated;
grant execute on function private.kiosk_device(text) to service_role;

-- ── Company and floor picker ────────────────────────────────────────────────

create or replace function public.kiosk_directory(p_token_hash text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.kiosk_device(p_token_hash) is null then
    return jsonb_build_object('error', 'unauthorised_device');
  end if;

  return jsonb_build_object(
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'nameAr', c.name_ar, 'floor', c.floor) order by c.name)
      from public.companies c
    ), '[]'::jsonb),
    'floors', coalesce((
      select jsonb_agg(jsonb_build_object('number', f.number, 'name', f.name, 'nameAr', f.name_ar, 'imageUrl', coalesce(f.image_url, '')) order by f.number)
      from public.floors f
    ), '[]'::jsonb),
    'formFields', (select fc.fields from public.form_config fc where fc.id = 1)
  );
end;
$$;

-- ── Check-in ────────────────────────────────────────────────────────────────
-- The floor comes from the company record, never from the tablet. One
-- transaction: if saving the visit fails, the visit code is not used up.

create or replace function public.kiosk_check_in(p_token_hash text, p_today date, p_visit jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id text;
  v_floor integer;
  v_code text;
begin
  if private.kiosk_device(p_token_hash) is null then
    return jsonb_build_object('error', 'unauthorised_device');
  end if;

  select c.id, c.floor into v_company_id, v_floor
  from public.companies c
  where c.id = p_visit ->> 'visited_company_id';
  if not found then
    return jsonb_build_object('error', 'unknown_company');
  end if;

  v_code := public.allocate_visit_code(p_today);

  insert into public.visitors (
    visit_code, name, phone, email, nationality_type, nationality_id_number,
    country_code, country_name, visitor_type, visited_company_id, floor,
    signature_data_url, entry_time, exit_time, status, "date"
  ) values (
    v_code,
    p_visit ->> 'name',
    p_visit ->> 'phone',
    nullif(p_visit ->> 'email', ''),
    p_visit ->> 'nationality_type',
    p_visit ->> 'nationality_id_number',
    p_visit ->> 'country_code',
    p_visit ->> 'country_name',
    p_visit ->> 'visitor_type',
    v_company_id,
    v_floor,
    coalesce(p_visit ->> 'signature_data_url', ''),
    now(),
    null,
    'active',
    p_today
  );

  return jsonb_build_object('visitCode', v_code, 'floor', v_floor);
end;
$$;

-- ── Check-out ───────────────────────────────────────────────────────────────
-- By visit code, or for employees by identity number. Today's active visits
-- only. A visitor's visit cannot be closed by identity number. Rate limited to
-- 8 attempts a minute per tablet, because a visit code is four digits.

create or replace function public.kiosk_check_out(
  p_token_hash text,
  p_today date,
  p_visit_code text default null,
  p_id_number text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_device uuid;
  v_name text;
begin
  v_device := private.kiosk_device(p_token_hash);
  if v_device is null then
    return jsonb_build_object('error', 'unauthorised_device');
  end if;
  if not public.kiosk_rate_limit_hit(v_device, 'checkout', 8, 60) then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  if p_id_number is not null then
    with closed as (
      update public.visitors
      set exit_time = now(), status = 'exited'
      where "date" = p_today
        and status = 'active'
        and visitor_type = 'employee'
        and nationality_id_number = p_id_number
      returning name
    )
    select name into v_name from closed limit 1;
  else
    update public.visitors
    set exit_time = now(), status = 'exited'
    where "date" = p_today and status = 'active' and visit_code = p_visit_code
    returning name into v_name;
  end if;

  if not found then
    return jsonb_build_object('error', 'no_active_visit');
  end if;
  return jsonb_build_object('name', coalesce(v_name, ''));
end;
$$;

-- ── Employee lookup ─────────────────────────────────────────────────────────
-- Rate limited to 10 a minute per tablet, because it answers whether an
-- identity number belongs to an employee. A miss and an inactive employee
-- answer identically.

create or replace function public.kiosk_lookup_employee(p_token_hash text, p_id_number text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_device uuid;
  v_employee jsonb;
begin
  v_device := private.kiosk_device(p_token_hash);
  if v_device is null then
    return jsonb_build_object('error', 'unauthorised_device');
  end if;
  if not public.kiosk_rate_limit_hit(v_device, 'lookup', 10, 60) then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  select jsonb_build_object(
    'name', e.name,
    'nameAr', e.name_ar,
    'employeeNumber', e.employee_number,
    'company', case when c.id is null then null
               else jsonb_build_object('id', c.id, 'name', c.name, 'nameAr', c.name_ar, 'floor', c.floor) end
  ) into v_employee
  from public.employees e
  left join public.companies c on c.id = e.company_id
  where e.nationality_id_number = p_id_number and e.employment_status = 'active'
  limit 1;

  return jsonb_build_object('employee', v_employee);
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke all on function
  public.kiosk_directory(text),
  public.kiosk_check_in(text, date, jsonb),
  public.kiosk_check_out(text, date, text, text),
  public.kiosk_lookup_employee(text, text)
from public, anon, authenticated;

grant execute on function
  public.kiosk_directory(text),
  public.kiosk_check_in(text, date, jsonb),
  public.kiosk_check_out(text, date, text, text),
  public.kiosk_lookup_employee(text, text)
to service_role;
