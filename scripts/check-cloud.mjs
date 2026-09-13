#!/usr/bin/env node
/**
 * Check whether a Supabase project is ready for this app, without changing it.
 *
 *   npm run check:cloud
 *
 * Reads .env only, never .env.local, so it always checks the cloud project.
 * Every request is a read. It prints no keys and no rows, only what is done and
 * what is still to do.
 *
 * With just the publishable key it can tell which migrations have run, whether
 * public sign-up is off, and whether any data is still publicly readable. With
 * the service role key as well, it also confirms that a super admin exists.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error('Put VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env first.');
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const anon = createClient(url, anonKey, options);

const results = [];
const ok = (name, detail = '') => results.push({ state: 'ok', name, detail });
const todo = (name, detail) => results.push({ state: 'todo', name, detail });
const danger = (name, detail) => results.push({ state: 'danger', name, detail });

const PERMISSION_DENIED = '42501';
const MISSING_TABLE = new Set(['PGRST205', '42P01']);
const MISSING_FUNCTION = 'PGRST202';

/** What an anonymous read of a table reveals. */
async function probeTable(table) {
  const { data, error } = await anon.from(table).select('*', { head: false }).limit(1);
  if (!error) return { kind: data.length > 0 ? 'readable' : 'empty' };
  if (error.code === PERMISSION_DENIED) return { kind: 'denied' };
  if (MISSING_TABLE.has(error.code)) return { kind: 'missing' };
  return { kind: 'unknown', detail: `${error.code ?? ''} ${error.message}`.trim() };
}

function jwtRole(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const host = new URL(url).host;
  console.log(`\nChecking ${host}\n`);

  // ── Authentication settings ───────────────────────────────────────────────
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
    const settings = await response.json();
    if (settings.external?.email === false) {
      danger('Email sign-in', 'The email provider is off, so nobody can sign in. Turn Email back on under Authentication, Sign In / Providers.');
    } else {
      ok('Email sign-in is on');
    }
    if (settings.disable_signup) {
      ok('Public sign-up is off');
    } else {
      todo('Public sign-up is still on', 'Authentication, Sign In / Providers: turn off "Allow new users to sign up". Staff accounts are created from the admin console instead.');
    }
  } catch (cause) {
    todo('Authentication settings', `Could not read them: ${cause.message}`);
  }

  // ── Migrations, inferred from what the public key can and cannot reach ────
  const { error: roleFnError } = await anon.rpc('current_app_role');
  if (roleFnError?.code === MISSING_FUNCTION) {
    todo('Migration 20260909000001_roles.sql', 'Not run yet.');
  } else if (roleFnError?.code === PERMISSION_DENIED || /permission denied/i.test(roleFnError?.message ?? '')) {
    ok('Migration 20260909000001_roles.sql');
  } else {
    todo('Migration 20260909000001_roles.sql', 'Ran, but the public key can still call current_app_role. Run it again.');
  }

  const tables = {
    visit_code_counters: '20260909000002_visit_codes.sql',
    kiosk_devices: '20260909000003_kiosk_devices.sql',
    kiosk_rate_limit: '20260909000005_kiosk_rate_limit.sql',
  };
  for (const [table, migration] of Object.entries(tables)) {
    const probe = await probeTable(table);
    if (probe.kind === 'missing') todo(`Migration ${migration}`, 'Not run yet.');
    else if (probe.kind === 'unknown') todo(`Migration ${migration}`, `Could not tell: ${probe.detail}`);
    else ok(`Migration ${migration}`);
  }

  // The latest migration revokes the public key from every table, so a
  // permission error here is the sign it ran. An empty result means the
  // policies ran but not the grants; any row means data is public.
  let publicRows = false;
  let grantsApplied = true;
  for (const table of ['visitors', 'employees', 'companies', 'profiles']) {
    const probe = await probeTable(table);
    if (probe.kind === 'readable') {
      publicRows = true;
      danger(`${table} is publicly readable`, 'Anyone with the public key can read it. Run 20260909000004_policies.sql and 20260913000001_admin_access_and_grants.sql now.');
    } else if (probe.kind !== 'denied') {
      grantsApplied = false;
    }
  }
  if (!publicRows && grantsApplied) {
    ok('Migration 20260909000004_policies.sql');
    ok('Migration 20260913000001_admin_access_and_grants.sql');
  } else if (!publicRows) {
    ok('Migration 20260909000004_policies.sql', 'No data is publicly readable.');
    todo('Migration 20260913000001_admin_access_and_grants.sql', 'Not run yet. Without it the first super admin cannot be created from the SQL editor.');
  }

  // ── Server credentials and the super admin ────────────────────────────────
  if (!serviceKey) {
    todo('Server key in .env', 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The kiosk and staff account endpoints need them. Never add a VITE_ prefix.');
    todo('Super admin', 'Cannot check without the server key.');
  } else {
    const role = jwtRole(serviceKey);
    if (role && role !== 'service_role') {
      danger('SUPABASE_SERVICE_ROLE_KEY', `That key is a "${role}" key, not the service role key.`);
    } else {
      const service = createClient(process.env.SUPABASE_URL ?? url, serviceKey, options);
      const { data, error } = await service.from('profiles').select('email').eq('role', 'superadmin');
      if (error) {
        todo('Super admin', `Could not check: ${error.message}`);
      } else if (data.length === 0) {
        todo('Super admin', 'None yet. Run supabase/scripts/bootstrap-superadmin.sql with your password filled in.');
      } else {
        ok('Server key works');
        ok('Super admin exists', data.map((p) => p.email).join(', '));
      }
    }
    if (process.env.SUPABASE_URL && new URL(process.env.SUPABASE_URL).host !== host) {
      danger('SUPABASE_URL', 'Points at a different project than VITE_SUPABASE_URL.');
    }
  }

  // ── Local settings that change which app runs ─────────────────────────────
  if (process.env.VITE_APP_TARGET) {
    todo(`.env sets VITE_APP_TARGET=${process.env.VITE_APP_TARGET}`, 'Remove that line. It makes npm run dev show only one app. npm run dev:all sets the target for each app itself.');
  }

  const colour = { ok: '\x1b[32m  done \x1b[0m', todo: '\x1b[33m  to do\x1b[0m', danger: '\x1b[31m URGENT\x1b[0m' };
  for (const r of results) {
    console.log(`${colour[r.state]}  ${r.name}${r.detail ? `\n           ${r.detail}` : ''}`);
  }

  const open = results.filter((r) => r.state !== 'ok').length;
  console.log(open === 0 ? '\nReady. Nothing left to do.\n' : `\n${open} item(s) left.\n`);
  process.exitCode = open === 0 ? 0 : 1;
}

main().catch((cause) => {
  console.error(`Check failed: ${cause.message ?? cause}`);
  process.exit(1);
});
