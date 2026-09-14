-- =============================================================================
-- Make one account the super admin
-- =============================================================================
-- Run in the Supabase dashboard: SQL Editor, paste, Run.
--
-- HOW TO USE
--   1. The account must already exist in THIS project. Either pick an email
--      from the list this file prints at the bottom, or create the account
--      first: Authentication > Users > Add user > Create new user, tick
--      "Auto Confirm User", and set the password there.
--   2. Replace YOUR-EMAIL-HERE below with that email. Keep the quotes.
--   3. Run. The list at the bottom should show that email with role superadmin.
--
-- If the email is not an account in this project the script stops with an
-- error naming the accounts that do exist, and changes nothing.
--
-- Password: leave new_password as '' to keep the account's current password.
-- Only fill it in for an existing account whose password you do not know, and
-- then choose a password you use nowhere else: the text of every statement run
-- here, including this one, is written to the database logs.

do $$
declare
  target_email text := lower(trim('YOUR-EMAIL-HERE'));
  new_password text := '';
  target_id    uuid;
begin
  -- Not filled in yet: change nothing, just print the account list below.
  if target_email = lower('YOUR-EMAIL-HERE') then
    raise notice 'Email not filled in. Showing the accounts only.';
    return;
  end if;

  select id into target_id from auth.users where lower(email) = target_email;

  if target_id is null then
    raise exception 'No account with email % in this project. Accounts that exist: %. Create it under Authentication > Users > Add user (Auto Confirm User), then run this again.',
      target_email,
      coalesce((select string_agg(email, ', ' order by created_at) from auth.users), 'none');
  end if;

  if new_password <> '' then
    if length(new_password) < 8 then
      raise exception 'The password must be at least 8 characters.';
    end if;
    update auth.users
    set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf'))
    where id = target_id;
  end if;

  -- Confirm the email, and drop the old role claim from the editable metadata.
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'role',
      updated_at = now()
  where id = target_id;

  -- The app reads the role from this table, never from the login token.
  insert into public.profiles (id, email, full_name, role)
  select id, lower(email), coalesce(raw_user_meta_data ->> 'full_name', email), 'superadmin'
  from auth.users
  where id = target_id
  on conflict (id) do update
    set role = 'superadmin',
        email = excluded.email;
end $$;

-- ── Every account, and what it can do ───────────────────────────────────────
-- A row saying "no profile row" cannot sign in, whatever its password is.

select u.email,
       coalesce(p.role, '-- no profile row, cannot sign in --') as role,
       u.email_confirmed_at is not null as email_confirmed,
       u.last_sign_in_at::date as last_sign_in,
       u.created_at::date as created
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;
