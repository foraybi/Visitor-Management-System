#!/usr/bin/env node
/**
 * Fill a local database with everything needed to test every role by hand.
 *
 * Creates, or refreshes on a re-run:
 *   - a super admin (only if the database has none), an admin and a front desk
 *     account, all confirmed so they sign in immediately
 *   - three floors, three companies, and four employees covering a national id,
 *     an iqama, a passport holder and an inactive employee
 *   - three visits: an active visitor, an employee inside the building, and one
 *     from yesterday that has already left
 *   - a test tablet, with a link that registers your browser as that tablet
 *
 * Writes the credentials to ./test-accounts.local (gitignored) so the smoke
 * test and you can read them back.
 *
 *   npm run seed:local
 *
 * Refuses to run against anything but a local server unless given
 * --allow-remote, because test accounts with known passwords do not belong in a
 * production project.
 */

import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const staffUrl = (process.env.STAFF_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const kioskUrl = (process.env.KIOSK_URL ?? 'http://localhost:5174').replace(/\/+$/, '');
const allowRemote = process.argv.includes('--allow-remote');

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (npm run db:env writes them to .env.local).');
  process.exit(1);
}

const host = new URL(url).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(host) || host.endsWith('.local');

if (!isLocal && !allowRemote) {
  console.error(`Refusing to create test accounts on ${host}. This is meant for a local database.`);
  console.error('If you really mean to seed a remote project, pass --allow-remote.');
  process.exit(1);
}

// A memorable password is fine on a database that only exists on your machine.
const password = isLocal ? 'vms-test-1234' : randomBytes(12).toString('base64url');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const SEED_MARKER = 'seed@vms.test';
const DEVICE_LABEL = 'Local test tablet';

function fail(step, error) {
  throw new Error(`${step}: ${error.message ?? error}`);
}

function dateInRiyadh(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

async function findUser(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail('listing users', error);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found || data.users.length < 1000) return found ?? null;
  }
}

async function ensureAccount(email, fullName, role) {
  let user = await findUser(email);

  if (user) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) fail(`resetting ${email}`, error);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) fail(`creating ${email}`, error);
    user = data.user;
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, email, full_name: fullName, role }, { onConflict: 'id' });
  if (error) fail(`profile for ${email}`, error);

  return { id: user.id, email, password, role };
}

function employee(id, companyId, number, name, nameAr, idType, idNumber, country, gender, extra = {}) {
  return {
    id,
    company_id: companyId,
    employee_number: number,
    name,
    name_ar: nameAr,
    phone: `05${number.padStart(8, '0')}`,
    email: `${name.split(' ')[0].toLowerCase()}@example.com`,
    nationality_type: idType,
    nationality_id_number: idNumber,
    country_code: country,
    gender,
    employment_status: 'active',
    job_type: 'full_time',
    department: 'Operations',
    position: 'Specialist',
    hire_date: '2024-01-15',
    photo_data_url: null,
    notes: null,
    verification_status: 'verified',
    ...extra,
  };
}

async function main() {
  console.log(`\nSeeding ${host}\n`);

  // ── Accounts ──────────────────────────────────────────────────────────────
  const { data: superadmins, error: superError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('role', 'superadmin');
  if (superError) fail('reading super admins', superError);

  let superadmin;
  if (superadmins.length === 0) {
    superadmin = await ensureAccount('superadmin@vms.test', 'Test Super Admin', 'superadmin');
  } else {
    // Never reset a real super admin's password.
    superadmin = { id: superadmins[0].id, email: superadmins[0].email, password: null, role: 'superadmin' };
  }
  const admin = await ensureAccount('admin@vms.test', 'Test Admin', 'admin');
  const frontdesk = await ensureAccount('frontdesk@vms.test', 'Test Front Desk', 'frontdesk');

  // ── Directory ─────────────────────────────────────────────────────────────
  const floors = [
    { id: 'seed-floor-1', number: 1, name: 'Ground Floor', name_ar: 'الدور الأرضي', image_url: '' },
    { id: 'seed-floor-2', number: 2, name: 'First Floor', name_ar: 'الدور الأول', image_url: '' },
    { id: 'seed-floor-3', number: 3, name: 'Second Floor', name_ar: 'الدور الثاني', image_url: '' },
  ];
  const companies = [
    { id: 'seed-company-1', name: 'Nakheel Tech', name_ar: 'نخيل للتقنية', logo_url: '', phone: '0112345671', floor: 1, employee_count: 0 },
    { id: 'seed-company-2', name: 'Rawabi Consulting', name_ar: 'روابي للاستشارات', logo_url: '', phone: '0112345672', floor: 2, employee_count: 0 },
    { id: 'seed-company-3', name: 'Sahab Logistics', name_ar: 'سحاب للخدمات اللوجستية', logo_url: '', phone: '0112345673', floor: 3, employee_count: 0 },
  ];
  const employees = [
    employee('seed-emp-1', 'seed-company-1', '0001', 'Khalid Alharbi', 'خالد الحربي', 'national_id', '1000000001', 'SA', 'male'),
    employee('seed-emp-2', 'seed-company-1', '0002', 'Noura Alqahtani', 'نورة القحطاني', 'iqama', '2000000002', 'EG', 'female'),
    employee('seed-emp-3', 'seed-company-2', '0003', 'James Carter', 'جيمس كارتر', 'passport', 'X1234567', 'GB', 'male', { job_type: 'contract' }),
    employee('seed-emp-4', 'seed-company-3', '0004', 'Former Employee', 'موظف سابق', 'national_id', '1000000004', 'SA', 'male', { employment_status: 'inactive' }),
  ];

  for (const [table, rows] of [['floors', floors], ['companies', companies], ['employees', employees]]) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) fail(`upserting ${table}`, error);
  }

  // ── Visits ────────────────────────────────────────────────────────────────
  // Earlier seed visits are replaced, so re-running does not pile them up.
  const { error: clearError } = await supabase.from('visitors').delete().eq('email', SEED_MARKER);
  if (clearError) fail('clearing old seed visits', clearError);

  async function visit(date, row) {
    const { data: code, error } = await supabase.rpc('allocate_visit_code', { p_date: date });
    if (error) fail('allocating a visit code', error);
    return { ...row, date, visit_code: code, email: SEED_MARKER, signature_data_url: '' };
  }

  const now = Date.now();
  const visits = [
    await visit(dateInRiyadh(0), {
      name: 'Sara Almutairi', phone: '0551234567', nationality_type: 'national_id',
      nationality_id_number: '1100000011', country_code: 'SA', country_name: 'Saudi Arabia',
      visitor_type: 'visitor', visited_company_id: 'seed-company-2', floor: 2,
      entry_time: new Date(now - 60 * 60_000).toISOString(), exit_time: null, status: 'active',
    }),
    await visit(dateInRiyadh(0), {
      name: 'Khalid Alharbi', phone: '0500000001', nationality_type: 'national_id',
      nationality_id_number: '1000000001', country_code: 'SA', country_name: 'Saudi Arabia',
      visitor_type: 'employee', visited_company_id: 'seed-company-1', floor: 1,
      entry_time: new Date(now - 3 * 60 * 60_000).toISOString(), exit_time: null, status: 'active',
    }),
    await visit(dateInRiyadh(-1), {
      name: 'Omar Alshehri', phone: '0559876543', nationality_type: 'iqama',
      nationality_id_number: '2200000022', country_code: 'JO', country_name: 'Jordan',
      visitor_type: 'visitor', visited_company_id: 'seed-company-3', floor: 3,
      entry_time: new Date(now - 26 * 60 * 60_000).toISOString(),
      exit_time: new Date(now - 24 * 60 * 60_000).toISOString(), status: 'exited',
    }),
  ];
  const { error: visitError } = await supabase.from('visitors').insert(visits);
  if (visitError) fail('inserting visits', visitError);

  // ── Test tablet ───────────────────────────────────────────────────────────
  await supabase.from('kiosk_devices').update({ active: false }).eq('label', DEVICE_LABEL).eq('active', true);
  const token = randomBytes(32).toString('hex');
  const { error: deviceError } = await supabase
    .from('kiosk_devices')
    .insert({ label: DEVICE_LABEL, token_hash: createHash('sha256').update(token).digest('hex') });
  if (deviceError) fail('registering the test tablet', deviceError);

  const kioskLink = `${kioskUrl}/#device-token=${token}`;

  writeFileSync(
    'test-accounts.local',
    `${JSON.stringify({ server: url, staffUrl, kioskLink, deviceToken: token, accounts: { superadmin, admin, frontdesk } }, null, 2)}\n`,
    { mode: 0o600 },
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  const line = (role, account) =>
    console.log(`  ${role.padEnd(12)} ${account.email.padEnd(26)} ${account.password ?? '(existing account, your own password)'}`);

  console.log('Staff app:', staffUrl);
  line('super admin', superadmin);
  line('admin', admin);
  line('front desk', frontdesk);
  console.log('\nKiosk: open this link once to register this browser as a test tablet:');
  console.log(`  ${kioskLink}`);
  console.log('\nEmployees to try at the kiosk, as an employee check-in:');
  console.log('  1000000001  national id   Khalid Alharbi    (already inside)');
  console.log('  2000000002  iqama         Noura Alqahtani');
  console.log('  X1234567    passport      James Carter      (the passport case that used to fail)');
  console.log('  1000000004  national id   inactive, must be refused');
  console.log('\nSaved to ./test-accounts.local (gitignored).\n');
}

main().catch((cause) => {
  console.error(`Seeding failed. ${cause.message ?? cause}`);
  process.exit(1);
});
