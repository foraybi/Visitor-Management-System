#!/usr/bin/env node
/**
 * Point the app at the local Supabase by writing .env.local.
 *
 * Vite and every npm script load .env.local after .env, so while this file
 * exists the app, the API and the scripts all talk to the local database, and
 * your cloud settings in .env stay untouched. Delete .env.local to point
 * everything back at .env.
 *
 *   npm run db:start
 *   npm run db:env
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const MARKER = '# Written by npm run db:env';

const result = spawnSync('./node_modules/.bin/supabase', ['status', '-o', 'json'], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error('Could not read the local Supabase status. Is it running? Try npm run db:start.');
  console.error(result.stderr.trim());
  process.exit(1);
}

let status;
try {
  // Anything before the JSON object is CLI chatter.
  status = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
} catch {
  console.error('Unexpected output from supabase status:\n', result.stdout);
  process.exit(1);
}

const url = status.API_URL;
const anonKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
const serviceKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('supabase status did not report an API URL and both keys:', Object.keys(status).join(', '));
  process.exit(1);
}

if (existsSync('.env.local') && !readFileSync('.env.local', 'utf8').startsWith(MARKER)) {
  copyFileSync('.env.local', '.env.local.bak');
  console.log('Your existing .env.local was not written by this script; kept a copy as .env.local.bak');
}

writeFileSync(
  '.env.local',
  `${MARKER} from the local Supabase.
# Overrides .env while it exists. Delete this file to use .env again.
VITE_SUPABASE_URL=${url}
VITE_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_URL=${url}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}
`,
  { mode: 0o600 },
);

console.log(`.env.local now points at ${url}`);
if (status.STUDIO_URL) console.log(`Supabase Studio: ${status.STUDIO_URL}`);
if (status.INBUCKET_URL ?? status.MAILPIT_URL) console.log(`Test inbox:      ${status.INBUCKET_URL ?? status.MAILPIT_URL}`);
