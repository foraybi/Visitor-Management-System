# زوار — Visitor Management System

A visitor check-in system for a multi-tenant office building. React 19, Vite 8,
TypeScript, Supabase, deployed on Vercel.

## Two apps, one repository

The code builds into two separate applications, selected by `VITE_APP_TARGET`.
Vite replaces that variable with a string literal at build time, so the branch in
`src/main.tsx` folds to a constant and the bundler removes the other app
entirely, along with everything it imports.

| | Kiosk | Staff |
|---|---|---|
| Domain | `kiosk.<domain>` | `app.<domain>` |
| Target | `VITE_APP_TARGET=kiosk` | `VITE_APP_TARGET=staff` |
| Who | A visitor at a lobby tablet | Front desk, admin, super admin |
| Data access | `/api/kiosk/*` only | Supabase directly, bounded by Row Level Security |
| Credentials on device | None | Publishable key, which is meant to be public |
| Service worker | Yes, installed as a PWA | No |
| Login page | None. It boots into the check-in screen | One, with no sign-up route |

They are separate origins on purpose. A service worker's scope is its origin, so
sharing one would cache staff code onto a tablet that sits unattended in a lobby.

## The security model in one paragraph

The tablet holds no database credentials. It sends a per-device token to four
Vercel Functions, which hold the Supabase service key server-side and return only
what each screen renders. Everything else goes through Row Level Security, which
reads the application role from `profiles` rather than from the JWT, because the
`user_metadata` claim is writable by the user it describes. `anon` has no access
to any table. Only a super admin may assign a role or create another
administrative account, enforced by a trigger, because Row Level Security cannot
express "you may edit this row but not this column".

**Developer tools on the tablet will show the requests it makes.** That cannot be
prevented in a browser. The design makes what they show worthless: an endpoint on
the app's own origin, carrying the form the visitor just filled in.

## Getting started

```bash
npm install
cp .env.example .env      # fill in your Supabase project details
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server. Defaults to the staff target |
| `npm run build:kiosk` | Kiosk build, with the service worker |
| `npm run build:staff` | Staff build |
| `npm run typecheck` | `tsc -b` across the app, the API and the config |
| `npm run lint` | ESLint |
| `npm run test` | Vitest, watching |
| `npm run test:run` | Vitest, once |

## Deploying

### 1. Database

Run the migrations in `supabase/migrations/` in filename order. There is no
Supabase CLI project here yet, so paste them into the SQL editor in order.

Then create the first super admin. No interface path creates one:

```sql
-- After adding the user under Authentication > Users
insert into public.profiles (id, email, full_name, role)
select id, email, 'Full Name', 'superadmin'
from auth.users where email = 'you@example.com'
on conflict (id) do update set role = 'superadmin';

-- The role is no longer read from here, so do not leave a stale one behind
update auth.users set raw_user_meta_data = raw_user_meta_data - 'role';
```

### 2. Two Vercel projects

Both point at this repository and the same root directory. They differ only in
environment variables and the production domain.

**`vms-staff`** — build command `npm run build:staff`

```
VITE_APP_TARGET=staff
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

**`vms-kiosk`** — build command `npm run build:kiosk`

```
VITE_APP_TARGET=kiosk
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

> **Never give the service key a `VITE_` prefix.** Vite inlines every `VITE_`
> variable into the client bundle, which would put full database access on the
> tablet. `scripts/verify-kiosk-build.sh` fails the build if anything
> credential-shaped appears in the kiosk output, and CI runs it.

`vercel.json` supplies the SPA rewrite, which `BrowserRouter` needs so a hard
refresh on `/frontdesk` does not 404, plus the security headers and the
cache rules. The service worker is served `must-revalidate`, or a tablet would
pin one build forever.

### 3. Each tablet

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/provision-kiosk-device.mjs "Lobby tablet 1"
```

The token is printed once and is not recoverable. The script tells you what to
paste into the tablet's browser console. Then:

```bash
node scripts/provision-kiosk-device.mjs --list
node scripts/provision-kiosk-device.mjs --revoke <device-id>
```

Revoking is one row. It does not affect any other tablet.

**Lock the tablet with Android, not JavaScript.** The app's fullscreen handling
and key blocking do nothing against the Android back button or the task
switcher. Use screen pinning under Settings, Security, App pinning for a single
tablet, or Managed Google Play with a kiosk policy for a fleet.

## Before you call it deployed

Run `scripts/verify-kiosk-build.sh` against the kiosk output, then check these by
hand. They are the failures that would not show up in a normal walkthrough.

1. From a private window holding only the publishable key, `select * from
   visitors`, `employees` and `profiles` must each return zero rows.
2. Sign in as front desk. It must not read another user's profile row, must not
   insert a row with `role = 'admin'`, and must not reach `/admin`.
3. Sign in as admin. It must not change any role or touch a super admin.
4. `supabase.auth.updateUser({ data: { role: 'admin' } })` must now change
   nothing.
5. On the tablet, open developer tools and complete a check-in. It must show a
   request to `/api/kiosk/check-in` and none to any Supabase host.
6. **Set the tablet's date to tomorrow and check in again.** This is the
   regression test for the bug that silently lost every visit from the second day
   onward.
7. Turn off Wi-Fi, reload. The shell must render. Attempt a check-in: it must
   show a retry message and must not show an ID card.
8. Start a check-in, type an ID number, walk away. After ninety seconds the
   screen must be back at the welcome state with the field cleared.
9. Check in from two tablets at once. The visit codes must differ.
10. Revoke a device. Its next check-in must be refused.

## Layout

```
api/kiosk/          Vercel Functions. The only path to a check-in
src/domain/         Pure logic: identity numbers, presence, permissions
src/data/           The seams: kiosk gateway, optimistic-write wrapper
src/app/kiosk/      The tablet
src/app/staff/      Front desk and admin
supabase/migrations The schema, in order
scripts/            Build gate and device provisioning
```

`src/domain` has no React and no network, which is why most of the test suite
lives there.

## Known gaps

Deliberately not done, and worth doing next.

- `src/components/admin/ManagementTab.tsx` is 900 lines holding four unrelated
  features, and is the only component that queries Supabase directly.
- There is no shared UI layer. The brand colour is hardcoded in dozens of places
  while `tailwind.config.ts` defines it as a token nothing uses, and antd,
  Tailwind and a large stylesheet of overrides coexist.
- The employee form exists twice and the copies have drifted; the front desk one
  silently drops several fields.
- No data retention policy. Visitor identity numbers accumulate indefinitely,
  which PDPL expects a position on.
- `xlsx@0.18.5` carries advisories. Both are in the parsing path and this app
  only writes, so the practical risk is low, but it will trip a scanner.
  `exceljs` is the replacement.
