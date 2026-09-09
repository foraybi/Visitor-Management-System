-- =============================================================================
-- Rate limiting for the kiosk endpoints
-- =============================================================================
-- `lookup-employee` answers "is this identity number a known employee". That is
-- a yes/no oracle over the staff directory, so without a limit a stolen device
-- token could be used to enumerate identity numbers. `check-out` is similar for
-- visit codes, which are only four digits.
--
-- The counter lives in Postgres rather than in the function, because serverless
-- instances do not share memory and a per-instance limit is no limit at all.

begin;

create table if not exists public.kiosk_rate_limit (
  device_id    uuid not null references public.kiosk_devices (id) on delete cascade,
  action       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (device_id, action, window_start)
);

alter table public.kiosk_rate_limit enable row level security;
-- No policies. Only service_role, which bypasses RLS, touches this.

/**
 * Record one attempt and report whether it is allowed.
 *
 * Fixed windows rather than a sliding log: cheaper, and the imprecision at a
 * window edge does not matter when the limit exists to stop enumeration rather
 * than to meter usage.
 */
create or replace function public.kiosk_rate_limit_hit(
  p_device_id      uuid,
  p_action         text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  bucket timestamptz;
  count_after integer;
begin
  bucket := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.kiosk_rate_limit (device_id, action, window_start, hits)
  values (p_device_id, p_action, bucket, 1)
  on conflict (device_id, action, window_start)
    do update set hits = public.kiosk_rate_limit.hits + 1
  returning hits into count_after;

  return count_after <= p_limit;
end;
$$;

revoke execute on function public.kiosk_rate_limit_hit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.kiosk_rate_limit_hit(uuid, text, integer, integer)
  to service_role;

/** Housekeeping. Windows older than a day carry no information. */
create or replace function public.kiosk_rate_limit_prune()
returns void language sql security definer
set search_path = public, pg_temp
as $$
  delete from public.kiosk_rate_limit where window_start < now() - interval '1 day'
$$;

grant execute on function public.kiosk_rate_limit_prune() to service_role;

commit;
