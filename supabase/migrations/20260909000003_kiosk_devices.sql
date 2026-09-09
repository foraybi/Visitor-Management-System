-- =============================================================================
-- S4. Per-device kiosk identity
-- =============================================================================
-- The tablet no longer holds Supabase credentials. It carries a device token and
-- sends it to /api/kiosk/*, which validates it here and then acts as
-- service_role on the tablet's behalf.
--
-- The token is visible in the tablet's developer tools, and that is acceptable
-- by design: it authorises four narrow operations and reads nothing. What it
-- buys is revocation. A lost tablet is one row flipped, without rotating a key
-- shared by every other device.
--
-- Only the hash is stored. A leaked database backup therefore does not yield
-- working device tokens.

begin;

create table if not exists public.kiosk_devices (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  token_hash   text not null unique,
  active       boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on column public.kiosk_devices.token_hash is
  'SHA-256 of the device token, hex encoded. The token itself is shown once at provisioning and never stored.';

create index if not exists idx_kiosk_devices_active
  on public.kiosk_devices (token_hash) where active;

alter table public.kiosk_devices enable row level security;

-- Staff may see and manage devices; nobody else may read them at all. The kiosk
-- API acts as service_role and bypasses these.
drop policy if exists kiosk_devices_admin_read on public.kiosk_devices;
create policy kiosk_devices_admin_read on public.kiosk_devices
  for select to authenticated
  using ((select public.current_app_role()) in ('admin', 'superadmin'));

drop policy if exists kiosk_devices_admin_write on public.kiosk_devices;
create policy kiosk_devices_admin_write on public.kiosk_devices
  for all to authenticated
  using ((select public.current_app_role()) in ('admin', 'superadmin'))
  with check ((select public.current_app_role()) in ('admin', 'superadmin'));

commit;
