#!/usr/bin/env node
/**
 * Provision one kiosk tablet.
 *
 * Generates a device token, stores only its SHA-256 hash, and prints the token
 * once. There is no way to recover it afterwards: if it is lost, revoke the
 * device and provision a new one.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/provision-kiosk-device.mjs "Lobby tablet 1"
 *
 *   # list devices
 *   node scripts/provision-kiosk-device.mjs --list
 *
 *   # revoke one
 *   node scripts/provision-kiosk-device.mjs --revoke <device-id>
 *
 * The service role key is read from the environment and never written anywhere.
 * Run this from a trusted machine, not from the tablet.
 */

import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const args = process.argv.slice(2);

async function list() {
  const { data, error } = await supabase
    .from('kiosk_devices')
    .select('id, label, active, last_seen_at, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data.length) {
    console.log('No kiosk devices provisioned.');
    return;
  }

  console.log('');
  for (const d of data) {
    const state = d.active ? 'active ' : 'REVOKED';
    const seen = d.last_seen_at ? new Date(d.last_seen_at).toISOString() : 'never seen';
    console.log(`  ${state}  ${d.id}  ${d.label.padEnd(24)}  last seen ${seen}`);
  }
  console.log('');
}

async function revoke(id) {
  const { data, error } = await supabase
    .from('kiosk_devices')
    .update({ active: false })
    .eq('id', id)
    .select('label')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    console.error(`No device with id ${id}.`);
    process.exit(1);
  }
  console.log(`Revoked "${data.label}". That tablet's next request will be refused.`);
}

async function provision(label) {
  // 32 bytes of entropy, hex encoded. Long enough that guessing is not a threat
  // model, short enough to paste into a tablet by hand if it comes to that.
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');

  const { data, error } = await supabase
    .from('kiosk_devices')
    .insert({ label, token_hash: tokenHash })
    .select('id')
    .single();

  if (error) throw error;

  console.log('');
  console.log(`  Device provisioned: ${label}`);
  console.log(`  Device id:          ${data.id}`);
  console.log('');
  console.log('  Token, shown once and never recoverable:');
  console.log('');
  console.log(`    ${token}`);
  console.log('');
  console.log('  On the tablet, open the kiosk URL, then in the browser console run:');
  console.log('');
  console.log(`    localStorage.setItem('vms-kiosk-token:v1', '${token}')`);
  console.log('');
  console.log('  Then reload. Revoke this device with:');
  console.log('');
  console.log(`    node scripts/provision-kiosk-device.mjs --revoke ${data.id}`);
  console.log('');
}

try {
  if (args[0] === '--list') {
    await list();
  } else if (args[0] === '--revoke') {
    if (!args[1]) {
      console.error('Usage: --revoke <device-id>');
      process.exit(1);
    }
    await revoke(args[1]);
  } else if (args[0] && !args[0].startsWith('--')) {
    await provision(args[0]);
  } else {
    console.error('Usage: provision-kiosk-device.mjs "Label" | --list | --revoke <id>');
    process.exit(1);
  }
} catch (cause) {
  console.error('Failed:', cause.message ?? cause);
  process.exit(1);
}
