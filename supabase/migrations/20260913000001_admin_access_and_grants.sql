-- =============================================================================
-- Admin access from the SQL editor, explicit grants, portable storage references
-- =============================================================================
-- Three corrections to the earlier hardening migrations.
--
-- 1. The role trigger blocked the SQL editor.
--    `enforce_role_assignment` trusted only `auth.role() = 'service_role'`. That
--    reads a JWT claim, and the SQL editor, psql and pg_dump restores carry no
--    JWT at all, so a database administrator creating the first super admin was
--    refused as if they were an anonymous web request. The bootstrap SQL in the
--    roles migration could never have run. The trigger now restricts exactly the
--    roles the Data API uses for end users, `authenticated` and `anon`, and
--    trusts direct database roles, which already own the schema.
--
-- 2. FORCE ROW LEVEL SECURITY protected against nobody.
--    It only affects the table owner, which is the database administrator. API
--    clients are never the owner, so it added no protection against them, and it
--    made administrative SQL on profiles, visitors and employees fail.
--
-- 3. Grants were implicit.
--    Supabase cloud grants every new public table to anon and authenticated by
--    default. A self-hosted or restored database may not, and depending on
--    defaults is how a migration behaves differently on two servers. Grants are
--    now explicit, and anon is revoked everywhere: Row Level Security already
--    denies it, and this makes the denial independent of policy correctness.

-- ── 1. Role trigger ─────────────────────────────────────────────────────────
-- SECURITY INVOKER, so current_user is the role that fired the trigger rather
-- than the function owner. Through the Data API that is `authenticated`, `anon`
-- or `service_role`; from the SQL editor or psql it is the administrator.

create or replace function public.enforce_role_assignment()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  actor := public.current_app_role();

  if tg_op = 'INSERT' then
    if new.role in ('admin', 'superadmin') and actor is distinct from 'superadmin' then
      raise exception 'only a superadmin may create an % account', new.role
        using errcode = '42501';
    end if;
    if new.role = 'frontdesk' and (actor is null or actor not in ('admin', 'superadmin')) then
      raise exception 'only an admin or superadmin may create staff accounts'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if actor is distinct from 'superadmin' then
      raise exception 'only a superadmin may change a role' using errcode = '42501';
    end if;
    if old.id = auth.uid() and old.role = 'superadmin' then
      raise exception 'a superadmin cannot change its own role' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- ── 2. Drop FORCE ───────────────────────────────────────────────────────────

alter table public.visitors  no force row level security;
alter table public.employees no force row level security;
alter table public.profiles  no force row level security;

-- ── 3. Explicit grants ──────────────────────────────────────────────────────

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Row Level Security decides which rows. These decide whether the table is
-- reachable at all.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Internal bookkeeping for the kiosk API. Nothing signed in touches these.
revoke all on public.visit_code_counters from authenticated;
revoke all on public.kiosk_rate_limit    from authenticated;

revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;

-- ── Storage references ──────────────────────────────────────────────────────
-- These columns held full public URLs, which bake the cloud project's hostname
-- into every row: after moving to a self-hosted server, every photo and logo
-- would still point at the old project. They now hold the object path inside
-- the bucket, and the application builds the URL from whatever server it is
-- configured for. Old URL values are still understood when read.

comment on column public.employees.photo_data_url is
  'Object path inside the employee-photos bucket (private; served through signed URLs). Legacy rows may hold a full URL or a data URL.';
comment on column public.document_settings.logo_url is
  'Object path inside the document-logos bucket. Legacy rows may hold a full URL.';
