#!/usr/bin/env node
/**
 * Run everything needed to test the system locally, in one terminal.
 *
 *   api    http://localhost:8787   the same handlers Vercel runs, all endpoints
 *   staff  http://localhost:5173   super admin, admin and front desk sign in here
 *   kiosk  http://localhost:5174   the visitor tablet
 *
 * Both apps proxy /api to the API server, exactly as they reach it in
 * production. Stop everything with Ctrl+C. If any one of them exits, the others
 * are stopped too, so a crashed API server is never mistaken for a working one.
 *
 *   npm run dev:all
 *
 * Ports can be moved if something else already holds them:
 *
 *   STAFF_PORT=5183 KIOSK_PORT=5184 API_PORT=8797 npm run dev:all
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/.bin/vite', import.meta.url));

const STAFF_PORT = process.env.STAFF_PORT ?? '5173';
const KIOSK_PORT = process.env.KIOSK_PORT ?? '5174';
const API_PORT = process.env.API_PORT ?? '8787';

const services = [
  {
    name: 'api',
    color: 35,
    command: process.execPath,
    args: [
      '--watch',
      '--env-file-if-exists=.env',
      '--env-file-if-exists=.env.local',
      '--import',
      'tsx',
      'server/index.ts',
    ],
    // No target: in development the API serves both the kiosk and staff endpoints.
    // Set to empty rather than deleted. The API loads .env with --env-file, which
    // never overrides a variable that already exists but happily fills in a
    // missing one, so a VITE_APP_TARGET line in .env would otherwise quietly turn
    // this into a kiosk-only API and hide the staff account endpoint.
    env: { ...process.env, APP_TARGET: '', VITE_APP_TARGET: '', PORT: API_PORT },
  },
  {
    name: 'staff',
    color: 36,
    command: vite,
    args: ['--port', STAFF_PORT, '--strictPort'],
    env: { ...process.env, VITE_APP_TARGET: 'staff', API_PORT },
  },
  {
    name: 'kiosk',
    color: 33,
    command: vite,
    args: ['--port', KIOSK_PORT, '--strictPort'],
    env: { ...process.env, VITE_APP_TARGET: 'kiosk', API_PORT },
  },
];

const children = [];
let stopping = false;

function prefix(name, color) {
  return `\x1b[${color}m${name.padEnd(5)}\x1b[0m │ `;
}

function pipe(stream, name, color, target) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) target.write(`${prefix(name, color)}${line}\n`);
  });
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500).unref();
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: root,
    env: service.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipe(child.stdout, service.name, service.color, process.stdout);
  pipe(child.stderr, service.name, service.color, process.stderr);
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`${prefix(service.name, service.color)}exited with code ${code}; stopping the others.`);
      stopAll(code ?? 1);
    }
  });
  children.push(child);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

console.log(`
  Staff app (super admin, admin, front desk)   http://localhost:${STAFF_PORT}
  Kiosk (visitor)                              http://localhost:${KIOSK_PORT}
  API                                          http://localhost:${API_PORT}

  First time? Register this browser as a test tablet with the link printed by
  npm run seed:local, or saved in ./test-accounts.local. If you moved the kiosk
  port, change the port in that link to match.
`);
