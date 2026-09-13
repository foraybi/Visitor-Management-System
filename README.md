# زوار — Visitor Management System

A visitor check-in system for a multi-tenant office building. React 19, Vite 8,
TypeScript and Supabase. Runs on Vercel today, and on any Node host next to a
self-hosted Supabase.

## Two apps, one repository

The code builds into two separate applications, selected by `VITE_APP_TARGET`.
Vite replaces that variable with a string literal at build time, so the other
app is removed from the bundle entirely.

| | Kiosk | Staff |
|---|---|---|
| Domain | `kiosk.<domain>` | `app.<domain>` |
| Target | `VITE_APP_TARGET=kiosk` | `VITE_APP_TARGET=staff` |
| Who | A visitor at a lobby tablet | Front desk, admin, super admin |
| Data access | `/api/kiosk/*` only | Supabase directly, bounded by Row Level Security |
| Server endpoints | `/api/kiosk/*` | `/api/staff/accounts` |
| Database key in the browser | None | Publishable key, meant to be public |
| Service worker | Yes, installed as a PWA | No |

## The security model in one paragraph

The tablet holds no database credentials. It sends a per-device token to four
server endpoints, which hold the service key and return only what each screen
renders. Everything else goes through Row Level Security, which reads the
application role from `profiles` rather than from the JWT, because the
`user_metadata` claim is writable by the user it describes. `anon` has no access
to any table. Staff accounts are created on the server with the admin API, so
public sign-up is switched off. An admin can create front desk accounts. Only a
super admin can create admins, and a super admin is created only with the
bootstrap SQL.

## Getting started

```bash
npm install
cp .env.example .env      # fill in your Supabase details
npm run dev:all           # staff app, kiosk and API together
```

## Testing before you go live

Test on your real Supabase cloud project, with the app running on your computer.
Nothing is deployed until you choose to.

**1. Finish setting up the cloud project.** This lists exactly what is left, and
changes nothing:

```bash
npm run check:cloud
```

Run it again after each fix until it says Ready. The usual items:

- Run `supabase/migrations/20260913000001_admin_access_and_grants.sql` in the SQL
  editor. Without it, the super admin script below is refused.
- Put your password into `supabase/scripts/bootstrap-superadmin.sql` and run it.
- Turn off "Allow new users to sign up" under Authentication, Sign In / Providers.
- Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env`. The service key is
  under Project Settings, API. Never give it a `VITE_` prefix.
- Remove any `VITE_APP_TARGET` line from `.env`.

**2. Add test data and check permissions.**

```bash
npm run seed:cloud     # test admin and front desk accounts, sample data, a test tablet
npm run smoke:cloud    # checks what each role can and cannot do
```

The seed never touches your own super admin account. Test passwords are random,
printed once, and saved in `test-accounts.local`.

**3. Run the apps.**

```bash
npm run dev:all
```

| Role | Open | Sign in with |
|---|---|---|
| Super admin | http://localhost:5173 | your own account |
| Admin | http://localhost:5173 | `admin@vms.test`, password printed by the seed |
| Front desk | http://localhost:5173 | `frontdesk@vms.test`, password printed by the seed |
| Visitor | `kioskLink` in `test-accounts.local` | no sign-in |

The staff roles share one address, and a browser keeps one sign-in per address.
Sign out between roles, or use a separate browser profile for each.

**4. Remove the test data before real visitors arrive.**

```bash
npm run flush-data
```

This deletes the sample data, the test accounts and the test tablet, and keeps
your super admin.

### What to try as each role

**Super admin**
1. Staff accounts offers a role picker. Create an admin.
2. Your own row has no remove button.
3. Upload a document logo and an employee photo. Both must display.

**Admin**
1. Staff accounts lists front desk accounts only, with no role picker.
2. Create a front desk account and sign in as it straight away. No verification
   email is involved.
3. Remove that account. It can no longer sign in.

**Front desk**
1. Signing in lands on the front desk screen, and visiting `/admin` sends you back.
2. The visitors table shows the sample visits, and Khalid Alharbi is inside.
3. Export a PDF with the app in Arabic. The Arabic text must render.

**Visitor, at the kiosk**
1. Tap to begin and check in as a visitor. You get a four-digit code.
2. With the front desk screen open alongside, the new visit appears without a
   reload.
3. Check out with the code. Checking out again with the same code is refused.
4. Check in as an employee with passport `X1234567`. That is James Carter.
5. The inactive employee `1000000004` is refused.
6. Start a check-in, type an ID number and wait ninety seconds. The screen returns
   to the welcome state with the form cleared.

### Testing the kiosk on a tablet

The computer runs the app, and the tablet opens it over Wi-Fi.

1. Put the computer and the tablet on the same Wi-Fi network.
2. Run `npm run dev:all`. It prints the tablet address, such as
   `http://10.198.1.77:5174`.
3. On the tablet, open `kioskLinkLan` from `test-accounts.local` once. That
   registers the tablet. Opening the plain address before that shows "This tablet
   is not registered".
4. Tap to begin and run through the visitor list above.

To lock an iPad to the kiosk, turn on Settings, Accessibility, Guided Access. Then
triple-click the top or side button while the kiosk is open. On Android, use
screen pinning.

**On an iPad, test in Safari itself, not from a home-screen icon.** A web app
added to the iPad home screen keeps its own storage, separate from Safari, so it
does not see the registration. Android tablets share storage between Chrome and
the installed app, so the real kiosk tablets are not affected.

**Plain Wi-Fi addresses cannot test everything.** Browsers allow the offline
shell, installing the app and keeping the screen awake only over HTTPS. Test
those three on a Vercel preview deployment, which is HTTPS and is not your
production site.

### Testing against a local database instead

For the later move to a self-hosted database, the same checks run against a local
Supabase in Docker:

```bash
npm run db:start && npm run db:env && npm run seed:local && npm run smoke:roles
```

`npm run db:stop` stops it. Delete `.env.local` afterwards, or every command
keeps using the local database.

## Setting up a database

The same steps apply to the cloud project and to a self-hosted server.

**1. Schema.** Run every file in `supabase/migrations/` in filename order. With
the Supabase CLI, `supabase db reset` does this for a local instance.

**2. Auth settings.**

| Setting | Cloud dashboard | Self-hosted Docker `.env` |
|---|---|---|
| Public sign-up off | Authentication, Sign In / Providers, turn off *Allow new users to sign up* | `DISABLE_SIGNUP=true` |
| Email confirmation | Leave on. Admin-created accounts are confirmed at creation | `ENABLE_EMAIL_AUTOCONFIRM=true` if there is no mail server |

`supabase/config.toml` sets both for a CLI-based local instance.

**3. First super admin.** Add the user under Authentication, Users. Then set
the email, name and a password at the top of
`supabase/scripts/bootstrap-superadmin.sql` and run it in the SQL editor. It sets
the password, confirms the email and creates the profile row. Every other account
is created from the admin console after that.

## Deleting all data

```bash
npm run flush-data -- --dry-run      # show what would be deleted
npm run flush-data                   # delete, after typing the server host
npm run flush-data -- --keep-staff   # delete data but keep every account
```

It deletes visits, companies, employees, floors, kiosk devices, settings, every
stored file, and every account except super admins. The schema stays. It needs
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`. Files are removed
through the storage API, because deleting storage rows in SQL leaves the files
on disk.

## Deploying on Vercel

Two projects, both pointing at this repository and the same root directory.

**`vms-staff`**, build command `npm run build:staff`

```
VITE_APP_TARGET=staff
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

**`vms-kiosk`**, build command `npm run build:kiosk`

```
VITE_APP_TARGET=kiosk
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

> **Never give the service key a `VITE_` prefix.** Vite inlines every `VITE_`
> variable into the browser bundle. `npm run verify:kiosk` and `verify:staff`
> fail if a service-role key reaches either bundle, and CI runs both.

Each project serves only its own endpoints. The kiosk endpoints answer 404 on the
staff project and the account endpoint answers 404 on the kiosk project.

## Hosting it yourself

Nothing in the app is tied to Vercel or to Supabase's cloud. The API handlers use
the standard Fetch `Request` and `Response`, and `server/index.ts` runs those same
handlers on plain Node, serving the built app alongside them.

```bash
npm ci
npm run build:kiosk            # or build:staff
npm run build:server
APP_TARGET=kiosk \
SUPABASE_URL=http://your-supabase-host:8000 \
SUPABASE_SERVICE_ROLE_KEY=... \
npm start                      # http://0.0.0.0:8787
```

Run one server per app, each with its own build directory, behind a reverse
proxy that terminates HTTPS. The kiosk needs HTTPS for the service worker, wake
lock and fullscreen. The server needs `node_modules` at runtime.

Moving from the cloud project to a self-hosted Supabase:

1. Set up the database as above on the new server.
2. Point `SUPABASE_URL` and `VITE_SUPABASE_URL` at it, rebuild, redeploy.
3. Provision the tablets again: device tokens live in the database.

Stored files are referenced by path inside the bucket, not by URL, so rows do not
carry the old server's hostname. Rows written before that change still hold full
URLs, and those are recognised and resolved against the new server.

## Each tablet

```bash
node --env-file=.env scripts/provision-kiosk-device.mjs "Lobby tablet 1"
node --env-file=.env scripts/provision-kiosk-device.mjs --list
node --env-file=.env scripts/provision-kiosk-device.mjs --revoke <device-id>
```

The token is printed once. The script shows what to paste into the tablet's
browser console. Lock the tablet with Android screen pinning or a managed kiosk
policy: the app's own fullscreen handling does nothing against the back button.

## Before you call it deployed

1. From a private window holding only the publishable key, `visitors`,
   `employees` and `profiles` must each return zero rows.
2. As front desk: no other profile rows, no `/admin`, no account creation.
3. As admin: can create front desk accounts, cannot create an admin or touch a
   super admin.
4. A new front desk account signs in immediately, with no verification email.
5. On the tablet, developer tools show `/api/kiosk/check-in` and no request to
   the database host.
6. Set the tablet's date to tomorrow and check in again. This is the regression
   test for the bug that lost every visit from day two.
7. With Wi-Fi off, the shell renders and a check-in shows a retry message, never
   an ID card.
8. An abandoned form clears itself after ninety seconds.
9. Two tablets checking in at once get different visit codes.
10. A revoked tablet is refused.
11. An uploaded employee photo displays, which confirms signed URLs work.

## Layout

```
api/kiosk/          Tablet endpoints
api/staff/          Staff account endpoint
api/_lib/           Shared handler code and the route table
server/             Self-hosted Node server
src/domain/         Pure logic: identity numbers, presence, permissions
src/data/           Kiosk gateway, write wrapper, storage, staff accounts
src/app/kiosk/      The tablet
src/app/staff/      Front desk and admin
supabase/           Migrations, local config, bootstrap SQL
scripts/            Build gates, flush, device provisioning
```

## Known gaps

- `src/components/admin/ManagementTab.tsx` is 900 lines holding four unrelated
  features.
- There is no shared UI layer, and antd, Tailwind and a large override
  stylesheet coexist.
- The employee form exists twice and the copies have drifted.
- No data retention policy for visitor identity numbers, which PDPL expects.
- `xlsx@0.18.5` carries advisories in its parsing path. This app only writes, so
  the risk is low, but `exceljs` is the replacement.
