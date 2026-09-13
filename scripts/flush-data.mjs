#!/usr/bin/env node
/**
 * Delete all application data from a Supabase project, cloud or self-hosted.
 *
 * Removes: every visit, company, employee, floor, kiosk device, visit counter,
 * the form and document settings, every file in both storage buckets, and every
 * staff account except super admins. Keeps: the schema, policies, functions and
 * buckets themselves, and your super admin accounts so you can still sign in.
 *
 * It shows exactly what it will delete and makes you type the server's host
 * before deleting anything. There is no undo.
 *
 *   node --env-file=.env scripts/flush-data.mjs --dry-run     # counts only
 *   node --env-file=.env scripts/flush-data.mjs               # delete
 *   node --env-file=.env scripts/flush-data.mjs --keep-staff  # delete data, keep all accounts
 *
 * Needs SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY. Files
 * are removed through the storage API rather than SQL: deleting storage rows in
 * SQL leaves the actual files behind on disk.
 */

import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const keepStaff = args.has('--keep-staff');

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (for example in .env) first.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Deletion order matters: visits reference companies. [table, a non-null column]. */
const TABLES = [
  ['visitors', 'id'],
  ['visit_code_counters', 'visit_date'],
  ['kiosk_rate_limit', 'device_id'],
  ['kiosk_devices', 'id'],
  ['employees', 'id'],
  ['companies', 'id'],
  ['floors', 'id'],
  ['form_config', 'id'],
  ['document_settings', 'id'],
];

const BUCKETS = ['employee-photos', 'document-logos'];

async function countRows(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function listObjects(bucket, prefix = '') {
  const paths = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`bucket ${bucket}: ${error.message}`);
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders come back with a null id.
      if (entry.id === null) paths.push(...(await listObjects(bucket, path)));
      else paths.push(path);
    }
    if (data.length < 1000) break;
  }
  return paths;
}

async function listUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function main() {
  const host = new URL(url).host;
  console.log(`\nServer: ${host}${dryRun ? '   (dry run: nothing will be deleted)' : ''}\n`);

  const counts = [];
  for (const [table] of TABLES) counts.push([table, await countRows(table)]);

  const objects = {};
  for (const bucket of BUCKETS) {
    try {
      objects[bucket] = await listObjects(bucket);
    } catch (cause) {
      console.warn(`  skipping ${cause.message}`);
      objects[bucket] = [];
    }
  }

  let usersToDelete = [];
  let superadmins = [];
  if (!keepStaff) {
    const { data, error } = await supabase.from('profiles').select('id, email').eq('role', 'superadmin');
    if (error) throw new Error(`profiles: ${error.message}`);
    superadmins = data;
    if (superadmins.length === 0) {
      console.warn('  No super admin exists, so no accounts will be deleted (you would be locked out).');
    } else {
      const keep = new Set(superadmins.map((s) => s.id));
      usersToDelete = (await listUsers()).filter((u) => !keep.has(u.id));
    }
  }

  console.log('Will delete:');
  for (const [table, count] of counts) console.log(`  ${table.padEnd(22)} ${count} rows`);
  for (const bucket of BUCKETS) console.log(`  ${`storage: ${bucket}`.padEnd(22)} ${objects[bucket].length} files`);
  console.log(`  ${'staff accounts'.padEnd(22)} ${keepStaff ? 'none (--keep-staff)' : `${usersToDelete.length} accounts`}`);
  for (const u of usersToDelete) console.log(`      - ${u.email ?? u.id}`);
  if (superadmins.length > 0) {
    console.log('\nWill keep these super admins:');
    for (const s of superadmins) console.log(`  + ${s.email}`);
  }

  if (dryRun) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nThis cannot be undone. Type the server host (${host}) to confirm: `);
  rl.close();
  if (answer.trim() !== host) {
    console.log('Host did not match. Nothing was deleted.');
    return;
  }

  const failures = [];

  for (const bucket of BUCKETS) {
    const paths = objects[bucket];
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) failures.push(`storage ${bucket}: ${error.message}`);
    }
  }

  for (const [table, column] of TABLES) {
    const { error } = await supabase.from(table).delete().not(column, 'is', null);
    if (error) failures.push(`${table}: ${error.message}`);
  }

  for (const user of usersToDelete) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) failures.push(`account ${user.email ?? user.id}: ${error.message}`);
  }

  if (failures.length > 0) {
    console.error('\nFinished with errors:');
    for (const f of failures) console.error(`  ! ${f}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nDone. All application data is deleted.');
  for (const [table] of TABLES) {
    const remaining = await countRows(table);
    if (remaining > 0) console.warn(`  ${table} still has ${remaining} rows`);
  }
}

main().catch((cause) => {
  console.error(`Failed: ${cause.message ?? cause}`);
  process.exit(1);
});
