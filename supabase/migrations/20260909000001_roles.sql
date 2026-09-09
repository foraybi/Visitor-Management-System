-- =============================================================================
-- S1. Three roles, with the role held in the database
-- =============================================================================
-- The role was read from `user_metadata`, which is the user-writable JWT claim.
-- Any signed-in account could call
--   supabase.auth.updateUser({ data: { role: 'admin' } })
-- from the browser console and gain the admin console, because no policy ever
-- inspected the application role.
--
-- `profiles.role` is now the only source of truth, and Postgres reads it there
-- rather than trusting anything the client can write.

begin;

-- ── The role set ────────────────────────────────────────────────────────────

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'frontdesk'));

-- ── Reading the caller's role ───────────────────────────────────────────────
-- SECURITY DEFINER so a policy on `profiles` can call it without recursing
-- through that same policy. STABLE so Postgres may evaluate it once per
-- statement; policies wrap the call in a scalar subquery to make that happen.

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke execute on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;

-- ── Role assignment is a super admin power ──────────────────────────────────
-- Row Level Security decides which rows an actor may touch. It cannot express
-- "you may edit this row but not this column", which is what stops an admin
-- promoting itself. A trigger can.

create or replace function public.enforce_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor text;
begin
  -- The kiosk API and the provisioning scripts act as service_role, which is
  -- trusted by definition and is how the first super admin is created.
  if auth.role() = 'service_role' then
    return new;
  end if;

  actor := public.current_app_role();

  if tg_op = 'INSERT' then
    -- Anyone may be handed a front desk account by an admin. Only a super admin
    -- may create another administrative account.
    if new.role in ('admin', 'superadmin') and actor is distinct from 'superadmin' then
      raise exception 'only a superadmin may create an % account', new.role
        using errcode = '42501';
    end if;
    if new.role = 'frontdesk' and actor not in ('admin', 'superadmin') then
      raise exception 'only an admin or superadmin may create staff accounts'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      if actor is distinct from 'superadmin' then
        raise exception 'only a superadmin may change a role'
          using errcode = '42501';
      end if;
      -- A super admin demoting itself could leave the system with no one able
      -- to assign roles, and nothing in the interface can undo that.
      if old.id = auth.uid() and old.role = 'superadmin' then
        raise exception 'a superadmin cannot change its own role'
          using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_role_assignment on public.profiles;
create trigger profiles_enforce_role_assignment
  before insert or update on public.profiles
  for each row execute function public.enforce_role_assignment();

-- ── Never delete the last super admin ───────────────────────────────────────

create or replace function public.prevent_last_superadmin_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role = 'superadmin'
     and (select count(*) from public.profiles where role = 'superadmin') <= 1 then
    raise exception 'cannot remove the last superadmin' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists profiles_prevent_last_superadmin_delete on public.profiles;
create trigger profiles_prevent_last_superadmin_delete
  before delete on public.profiles
  for each row execute function public.prevent_last_superadmin_delete();

commit;

-- =============================================================================
-- Bootstrapping the first super admin
-- =============================================================================
-- No interface path creates one. Run this once in the SQL editor, which acts as
-- service_role and therefore passes the trigger above, after creating the user
-- in Authentication > Users:
--
--   insert into public.profiles (id, email, full_name, role)
--   select id, email, 'Full Name', 'superadmin'
--   from auth.users where email = 'you@example.com'
--   on conflict (id) do update set role = 'superadmin';
--
-- Then clear the stale role from the user-writable claim, which is no longer
-- read but should not be left lying around looking authoritative:
--
--   update auth.users set raw_user_meta_data = raw_user_meta_data - 'role';
