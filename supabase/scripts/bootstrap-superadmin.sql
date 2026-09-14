-- =============================================================================
-- STEP 2: make one existing account the super admin
-- =============================================================================
-- Run STEP 1 first:
--   supabase/migrations/20260913000001_admin_access_and_grants.sql
-- If you see "only a superadmin may create" or "only a superadmin may change a
-- role" when running this file, STEP 1 has not been run yet.
--
-- HOW TO USE
--   1. Run this file exactly as it is. It changes nothing, and the list at the
--      bottom shows every account that exists and the role it has.
--   2. Copy your email from that list. Replace YOUR-EMAIL-HERE with it, and
--      replace YOUR-PASSWORD-HERE with the password you want. Keep the quotes.
--      Replace-all is safe for both.
--   3. Run the file again. The list at the bottom should now show your email
--      with role superadmin.
--
-- Setting the password is harmless for an account that already has one. It
-- simply becomes the password you typed here.

create extension if not exists pgcrypto with schema extensions;

-- ── Set the password and confirm the email ──────────────────────────────────
-- Also drops the old role claim from the login token, which the app no longer
-- reads and which used to be editable by the user it described.

update auth.users
set encrypted_password = extensions.crypt('YOUR-PASSWORD-HERE', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'role',
    updated_at = now()
where lower(email) = lower('YOUR-EMAIL-HERE');

-- ── Give that account the super admin role ──────────────────────────────────
-- The app reads the role from this table, never from the login token. An
-- account with no row here cannot sign in at all.

insert into public.profiles (id, email, full_name, role)
select id, lower(email), coalesce(raw_user_meta_data ->> 'full_name', email), 'superadmin'
from auth.users
where lower(email) = lower('YOUR-EMAIL-HERE')
on conflict (id) do update
  set role = 'superadmin',
      email = excluded.email;

-- ── Every account, and what it can do ───────────────────────────────────────
-- Exactly one row should say superadmin. A row saying "no profile row" cannot
-- sign in, whatever its password is.

select u.email,
       coalesce(p.role, '-- no profile row, cannot sign in --') as role,
       u.encrypted_password is not null as has_password,
       u.email_confirmed_at is not null as email_confirmed,
       u.created_at::date as created
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;
