-- =============================================================================
-- STEP 2: make yourself a super admin who can sign in
-- =============================================================================
-- Run STEP 1 first:
--   supabase/migrations/20260913000001_admin_access_and_grants.sql
-- Until that has run, the database refuses to create a super admin from the
-- SQL editor, whatever this file does.
--
-- HOW TO USE
--   1. The account must already exist under Authentication > Users.
--   2. Replace YOUR-PASSWORD-HERE with your password. Keep the single quotes.
--      It appears once. Replace-all is safe.
--   3. If the email is not yours, replace it too. Replace-all is safe.
--   4. Run the whole file. The last query says whether it worked.
--
-- Nothing in this file can reject you. Any failure will be an ordinary SQL
-- error, not a message written by me.

create extension if not exists pgcrypto with schema extensions;

-- ── Set a password and confirm the email ────────────────────────────────────
-- An invited user has no password until the invitation is accepted, which is
-- why signing in says "Invalid login credentials". This sets one. It also drops
-- the old role claim, which the app no longer reads and should not keep.

update auth.users
set encrypted_password = extensions.crypt('YOUR-PASSWORD-HERE', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'role',
    updated_at = now()
where lower(email) = lower('csfo.41@gmail.com');

-- ── Give that account the super admin role ──────────────────────────────────
-- The app reads the role from this table, never from the login token.

insert into public.profiles (id, email, full_name, role)
select id, lower(email), 'Fawaz Oraybi', 'superadmin'
from auth.users
where lower(email) = lower('csfo.41@gmail.com')
on conflict (id) do update
  set role = 'superadmin',
      email = excluded.email,
      full_name = excluded.full_name;

-- ── Did it work? ────────────────────────────────────────────────────────────
-- Expect exactly one row:
--   has_password     true
--   email_confirmed  true
--   role             superadmin
--
-- No rows means no account with that email exists. Create it under
-- Authentication > Users, then run this file again.

select u.email,
       u.encrypted_password is not null as has_password,
       u.email_confirmed_at is not null as email_confirmed,
       p.role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('csfo.41@gmail.com');
