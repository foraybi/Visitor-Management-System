#!/usr/bin/env node
/**
 * Check every role against a real database, through the same paths the apps use.
 *
 * Starts its own API server on a spare port, signs in as each seeded account,
 * and asserts what each role can and cannot do: the Row Level Security policies,
 * the role trigger, the account endpoint and the kiosk endpoints. Everything it
 * creates is removed again.
 *
 * Run after `npm run seed:local`, against the local database:
 *
 *   npm run smoke:roles
 *
 * This proves the permission model before you click through the screens. It
 * does not replace clicking through them.
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = 8799;
const API = `http://127.0.0.1:${PORT}`;
const SMOKE_MARKER = 'smoke@vms.test';

if (!url || !anonKey || !serviceKey) {
  console.error('Needs SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see .env.local).');
  process.exit(1);
}

let seed;
try {
  seed = JSON.parse(readFileSync('test-accounts.local', 'utf8'));
} catch {
  console.error('No ./test-accounts.local. Run npm run seed:local first.');
  process.exit(1);
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(url, serviceKey, clientOptions);
const anon = createClient(url, anonKey, clientOptions);

const results = [];
let section = '';

async function check(name, fn) {
  try {
    await fn();
    results.push({ section, name, ok: true });
  } catch (cause) {
    results.push({ section, name, ok: false, detail: cause.message ?? String(cause) });
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function signIn(email, password) {
  const client = createClient(url, anonKey, clientOptions);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in as ${email}: ${error.message}`);
  return { client, user: data.user, token: data.session.access_token };
}

/** Sign in, recording the outcome, so one broken account does not abort every other check. */
async function signInOrRecord(account) {
  try {
    const session = await signIn(account.email, account.password);
    results.push({ section, name: 'signs in', ok: true });
    return session;
  } catch (cause) {
    results.push({ section, name: 'signs in', ok: false, detail: cause.message });
    return null;
  }
}

async function api(method, path, { token, deviceToken, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (deviceToken) headers['x-kiosk-token'] = deviceToken;
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, body: payload };
}

async function roleOf(id) {
  const { data } = await service.from('profiles').select('role').eq('id', id).maybeSingle();
  return data?.role ?? null;
}

async function startServer() {
  const env = { ...process.env, PORT: String(PORT), STATIC_DIR: 'dist-nonexistent' };
  delete env.APP_TARGET;
  delete env.VITE_APP_TARGET;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d));

  for (let i = 0; i < 100; i += 1) {
    try {
      const r = await fetch(`${API}/api/kiosk/directory`);
      if (r.status === 401) return child;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  child.kill();
  throw new Error(`API server did not start.\n${stderr}`);
}

async function main() {
  const server = await startServer();
  const createdAccounts = [];

  try {
    const { admin, frontdesk, superadmin } = seed.accounts;

    // ── Anonymous: the publishable key alone ────────────────────────────────
    section = 'anonymous';
    for (const table of ['visitors', 'employees', 'companies', 'profiles', 'kiosk_devices']) {
      await check(`cannot read ${table}`, async () => {
        const { data, error } = await anon.from(table).select('*').limit(1);
        expect(error || (data ?? []).length === 0, `read ${data?.length} rows`);
      });
    }

    // ── Front desk ──────────────────────────────────────────────────────────
    section = 'front desk';
    const fd = await signInOrRecord(frontdesk);
    if (fd) {

    await check('reads visitors', async () => {
      const { data, error } = await fd.client.from('visitors').select('id');
      expect(!error && data.length > 0, error?.message ?? 'no visitors visible');
    });

    await check('sees only its own profile row', async () => {
      const { data, error } = await fd.client.from('profiles').select('id');
      expect(!error, error?.message);
      expect(data.every((r) => r.id === fd.user.id), `saw ${data.length} rows`);
    });

    await check('cannot promote itself through profiles', async () => {
      await fd.client.from('profiles').update({ role: 'admin' }).eq('id', fd.user.id);
      expect((await roleOf(fd.user.id)) === 'frontdesk', 'role changed');
    });

    // The escalation that worked before the hardening.
    await check('cannot promote itself through user_metadata', async () => {
      await fd.client.auth.updateUser({ data: { role: 'admin' } });
      expect((await roleOf(fd.user.id)) === 'frontdesk', 'role changed');
      const r = await api('POST', '/api/staff/accounts', {
        token: (await fd.client.auth.getSession()).data.session.access_token,
        body: { email: 'x@vms.test', password: 'password-123', fullName: 'X', role: 'frontdesk' },
      });
      expect(r.status === 403, `account endpoint answered ${r.status}`);
    });

    await check('cannot delete a company', async () => {
      await fd.client.from('companies').delete().eq('id', 'seed-company-3');
      const { data } = await service.from('companies').select('id').eq('id', 'seed-company-3');
      expect(data.length === 1, 'company was deleted');
    });

    await check('cannot see kiosk devices', async () => {
      const { data } = await fd.client.from('kiosk_devices').select('id');
      expect((data ?? []).length === 0, 'devices visible');
    });

    await check('cannot create accounts', async () => {
      const r = await api('POST', '/api/staff/accounts', {
        token: fd.token,
        body: { email: 'y@vms.test', password: 'password-123', fullName: 'Y', role: 'frontdesk' },
      });
      expect(r.status === 403, `answered ${r.status}`);
    });

    }

    // ── Admin ───────────────────────────────────────────────────────────────
    section = 'admin';
    const ad = await signInOrRecord(admin);
    if (ad) {

    await check('cannot see super admin profiles', async () => {
      const { data, error } = await ad.client.from('profiles').select('role');
      expect(!error, error?.message);
      expect(!data.some((r) => r.role === 'superadmin'), 'super admin row visible');
    });

    await check('cannot create an admin', async () => {
      const r = await api('POST', '/api/staff/accounts', {
        token: ad.token,
        body: { email: `smoke-admin-${Date.now()}@vms.test`, password: 'password-123', fullName: 'Nope', role: 'admin' },
      });
      expect(r.status === 403, `answered ${r.status}`);
    });

    const newEmail = `smoke-fd-${Date.now()}@vms.test`;
    let newId;
    await check('creates a front desk account', async () => {
      const r = await api('POST', '/api/staff/accounts', {
        token: ad.token,
        body: { email: newEmail, password: 'password-123', fullName: 'Smoke Front Desk', role: 'frontdesk' },
      });
      expect(r.status === 201, `answered ${r.status} ${JSON.stringify(r.body)}`);
      newId = r.body.id;
      createdAccounts.push(newId);
    });

    await check('new account signs in immediately, no verification email', async () => {
      const s = await signIn(newEmail, 'password-123');
      expect((await roleOf(s.user.id)) === 'frontdesk', 'wrong role');
    });

    await check('rejects a duplicate email', async () => {
      const r = await api('POST', '/api/staff/accounts', {
        token: ad.token,
        body: { email: newEmail, password: 'password-123', fullName: 'Again', role: 'frontdesk' },
      });
      expect(r.status === 409, `answered ${r.status}`);
    });

    await check('removes the account, which can then no longer sign in', async () => {
      const r = await api('DELETE', `/api/staff/accounts?id=${newId}`, { token: ad.token });
      expect(r.status === 200, `answered ${r.status}`);
      createdAccounts.splice(createdAccounts.indexOf(newId), 1);
      const again = await anon.auth.signInWithPassword({ email: newEmail, password: 'password-123' });
      expect(again.error, 'still signs in');
    });

    await check('cannot remove the super admin', async () => {
      const r = await api('DELETE', `/api/staff/accounts?id=${superadmin.id}`, { token: ad.token });
      expect(r.status === 403, `answered ${r.status}`);
    });

    }

    // ── Super admin ─────────────────────────────────────────────────────────
    section = 'super admin';
    if (!superadmin.password) {
      results.push({ section, name: 'skipped: existing super admin, password unknown to the seed', ok: true });
    } else {
      const sa = await signInOrRecord(superadmin);
      if (sa) {

      await check('sees every profile', async () => {
        const { data } = await sa.client.from('profiles').select('role');
        expect(['superadmin', 'admin', 'frontdesk'].every((r) => data.some((p) => p.role === r)), 'missing roles');
      });

      await check('creates and removes an admin', async () => {
        const r = await api('POST', '/api/staff/accounts', {
          token: sa.token,
          body: { email: `smoke-admin-${Date.now()}@vms.test`, password: 'password-123', fullName: 'Smoke Admin', role: 'admin' },
        });
        expect(r.status === 201, `create answered ${r.status}`);
        createdAccounts.push(r.body.id);
        const d = await api('DELETE', `/api/staff/accounts?id=${r.body.id}`, { token: sa.token });
        expect(d.status === 200, `delete answered ${d.status}`);
        createdAccounts.pop();
      });

      await check('cannot create another super admin from the console', async () => {
        const r = await api('POST', '/api/staff/accounts', {
          token: sa.token,
          body: { email: `smoke-sa-${Date.now()}@vms.test`, password: 'password-123', fullName: 'Nope', role: 'superadmin' },
        });
        expect(r.status === 400, `answered ${r.status}`);
      });

      await check('cannot remove itself', async () => {
        const r = await api('DELETE', `/api/staff/accounts?id=${sa.user.id}`, { token: sa.token });
        expect(r.status === 400, `answered ${r.status}`);
      });

      await check('cannot demote itself', async () => {
        await sa.client.from('profiles').update({ role: 'admin' }).eq('id', sa.user.id);
        expect((await roleOf(sa.user.id)) === 'superadmin', 'role changed');
      });
      }
    }

    // ── Kiosk ───────────────────────────────────────────────────────────────
    section = 'kiosk';
    const device = seed.deviceToken;

    await check('refuses a request with no device token', async () => {
      expect((await api('GET', '/api/kiosk/directory')).status === 401, 'not refused');
    });

    await check('directory lists companies and nothing personal', async () => {
      const r = await api('GET', '/api/kiosk/directory', { deviceToken: device });
      expect(r.status === 200, `answered ${r.status}`);
      expect(r.body.companies.some((c) => c.id === 'seed-company-1'), 'seed company missing');
      const text = JSON.stringify(r.body);
      expect(!/nationality|employee_number|phone|@example\.com/.test(text), 'personal data in directory');
    });

    await check('recognises a passport-holding employee', async () => {
      const r = await api('POST', '/api/kiosk/lookup-employee', {
        deviceToken: device,
        body: { idType: 'passport', idNumber: 'X1234567' },
      });
      expect(r.status === 200 && r.body.employee?.name === 'James Carter', JSON.stringify(r.body));
    });

    await check('refuses an inactive employee', async () => {
      const r = await api('POST', '/api/kiosk/lookup-employee', {
        deviceToken: device,
        body: { idType: 'national_id', idNumber: '1000000004' },
      });
      expect(r.status === 200 && r.body.employee === null, JSON.stringify(r.body));
    });

    const visitor = (name, idNumber) => ({
      visitorType: 'visitor', name, phone: '0512345678', email: SMOKE_MARKER,
      nationalityType: 'national_id', nationalityIdNumber: idNumber, countryCode: 'SA',
      countryName: 'Saudi Arabia', visitedCompanyId: 'seed-company-1', floor: 1, signatureDataUrl: '',
    });

    let codes = [];
    await check('two simultaneous check-ins get different codes', async () => {
      const [a, b] = await Promise.all([
        api('POST', '/api/kiosk/check-in', { deviceToken: device, body: visitor('Smoke One', '1300000001') }),
        api('POST', '/api/kiosk/check-in', { deviceToken: device, body: visitor('Smoke Two', '1300000002') }),
      ]);
      expect(a.status === 201 && b.status === 201, `answered ${a.status}, ${b.status}`);
      codes = [a.body.visitCode, b.body.visitCode];
      expect(codes[0] !== codes[1], `both got ${codes[0]}`);
    });

    await check('checks out once, and refuses a second check-out', async () => {
      const first = await api('POST', '/api/kiosk/check-out', { deviceToken: device, body: { visitCode: codes[0] } });
      expect(first.status === 200, `first answered ${first.status}`);
      const second = await api('POST', '/api/kiosk/check-out', { deviceToken: device, body: { visitCode: codes[0] } });
      expect(second.status === 404, `second answered ${second.status}`);
    });

    await check('rejects a company that does not exist', async () => {
      const r = await api('POST', '/api/kiosk/check-in', {
        deviceToken: device,
        body: { ...visitor('Smoke Three', '1300000003'), visitedCompanyId: 'no-such-company' },
      });
      expect(r.status === 400, `answered ${r.status}`);
    });

    await check('a revoked tablet is refused', async () => {
      const { data } = await service.from('kiosk_devices').select('id').eq('label', 'Local test tablet').eq('active', true).single();
      await service.from('kiosk_devices').update({ active: false }).eq('id', data.id);
      const r = await api('GET', '/api/kiosk/directory', { deviceToken: device });
      await service.from('kiosk_devices').update({ active: true }).eq('id', data.id);
      expect(r.status === 401, `answered ${r.status}`);
    });
  } finally {
    for (const id of createdAccounts) await service.auth.admin.deleteUser(id);
    await service.from('visitors').delete().eq('email', SMOKE_MARKER);
    server.kill();
  }

  let current = '';
  for (const r of results) {
    if (r.section !== current) {
      current = r.section;
      console.log(`\n${current}`);
    }
    console.log(`  ${r.ok ? '\x1b[32mpass\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${r.name}${r.ok ? '' : `\n        ${r.detail}`}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((cause) => {
  console.error(`Smoke test aborted. ${cause.message ?? cause}`);
  process.exit(1);
});
