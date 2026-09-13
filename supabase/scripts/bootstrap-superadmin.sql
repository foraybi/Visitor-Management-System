-- =============================================================================
-- Make one existing auth user a super admin who can sign in
-- =============================================================================
-- Not a migration. Run it by hand in the SQL editor (or psql) whenever a server
-- needs its first super admin: the cloud project today, the self-hosted one
-- after the move.
--
-- Requires migration 20260913000001 first. Before it, the role trigger refuses
-- this insert from the SQL editor.
--
-- What it does, for the user whose email you set below:
--   * sets the password, so the account can sign in with email and password
--     (an invited user has no password until they accept the invitation)
--   * marks the email as confirmed, so sign-in is not refused as unverified
--   * creates or updates the profiles row with role 'superadmin'
--   * removes the stale role from user_metadata, which is no longer read
--
-- The password lands in the SQL editor's query history. Change it from the app
-- afterwards if that matters for this server.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_email     text := 'csfo.41@gmail.com';
  v_full_name text := 'Fawaz Oraybi';
  v_password  text := 'CHANGE-ME';   -- at least 8 characters
  v_user_id   uuid;
begin
  if v_password = 'CHANGE-ME' or length(v_password) < 8 then
    raise exception 'Set v_password to a real password of at least 8 characters before running.';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(v_email);

  if v_user_id is null then
    raise exception 'No auth user with email %. Add it under Authentication > Users first, then run this again.', v_email;
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = (coalesce(raw_user_meta_data, '{}'::jsonb) - 'role')
                           || jsonb_build_object('full_name', v_full_name),
      updated_at         = now()
  where id = v_user_id;

  insert into public.profiles (id, email, full_name, role)
  values (v_user_id, v_email, v_full_name, 'superadmin')
  on conflict (id) do update
    set role = 'superadmin',
        email = excluded.email,
        full_name = excluded.full_name;

  raise notice 'Super admin ready: % (%)', v_email, v_user_id;
end $$;
