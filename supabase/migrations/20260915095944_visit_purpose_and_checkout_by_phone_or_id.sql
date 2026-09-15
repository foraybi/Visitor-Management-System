-- =============================================================================
-- Visit purpose at check-in, and check-out by mobile or ID number.
--
-- Visitors pick why they came from a fixed list. Everyone checks out with the
-- mobile number or ID number they checked in with; the visit code is no longer
-- typed at the tablet and is shown to the front desk and admin only.
-- =============================================================================

alter table public.visitors add column if not exists visit_purpose text;

alter table public.visitors
  add constraint visitors_visit_purpose_check check (
    visit_purpose is null or visit_purpose in (
      'mentor_consultation', 'job_interview', 'innovation_center_company',
      'startup_complex_company', 'meeting', 'other'
    )
  );

-- ── Check-in: store the purpose ─────────────────────────────────────────────

create or replace function public.kiosk_check_in(p_token_hash text, p_today date, p_visit jsonb)
returns jsonb
language plpgsql
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
    signature_data_url, entry_time, exit_time, status, "date", visit_purpose
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
    p_today,
    nullif(p_visit ->> 'visit_purpose', '')
  );

  return jsonb_build_object('visitCode', v_code, 'floor', v_floor);
end;
$$;

-- ── Check-out by mobile or ID number ────────────────────────────────────────
-- p_visit_code stays for the few minutes the previous API version is still
-- deployed; the new API never sends it. An employee's visit row has no phone,
-- so a mobile number also matches the employee record's phone.

drop function if exists public.kiosk_check_out(text, date, text, text);

create function public.kiosk_check_out(
  p_token_hash text,
  p_today date,
  p_visit_code text default null,
  p_id_number text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_device uuid;
  v_name text;
  v_count integer;
begin
  v_device := private.kiosk_device(p_token_hash);
  if v_device is null then
    return jsonb_build_object('error', 'unauthorised_device');
  end if;
  if not public.kiosk_rate_limit_hit(v_device, 'checkout', 8, 60) then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  with closed as (
    update public.visitors v
    set exit_time = now(), status = 'exited'
    where v."date" = p_today
      and v.status = 'active'
      and (
        (p_id_number is not null and v.nationality_id_number = p_id_number)
        or (p_phone is not null and (
          v.phone = p_phone
          or (v.visitor_type = 'employee' and v.nationality_id_number in (
            select e.nationality_id_number from public.employees e where e.phone = p_phone
          ))
        ))
        or (p_id_number is null and p_phone is null and p_visit_code is not null and v.visit_code = p_visit_code)
      )
    returning v.name
  )
  select min(name), count(*) into v_name, v_count from closed;

  if v_count = 0 then
    return jsonb_build_object('error', 'no_active_visit');
  end if;
  return jsonb_build_object('name', coalesce(v_name, ''));
end;
$$;

revoke all on function public.kiosk_check_out(text, date, text, text, text) from public, anon, authenticated;
grant execute on function public.kiosk_check_out(text, date, text, text, text) to service_role;
