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
npm run dev:api           # terminal 1: the API, on :8787
npm run dev               # terminal 2: the app, proxying /api to :8787
```

| Script | What it does |
|---|---|
| `npm run dev` / `npm run dev:api` | App and API in development |
| `npm run build:kiosk` / `build:staff` | Production build of one app |
| `npm run verify:kiosk` / `verify:staff` | Gate a build for leaked keys and size |
| `npm run build:server` / `npm start` | Self-hosted server, see below |
| `npm run flush-data` | Delete all application data, see below |
| `npm run typecheck` / `lint` / `test:run` | Checks |

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
