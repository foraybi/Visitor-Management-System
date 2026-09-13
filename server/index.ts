import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { routes, type Method } from '../api/_lib/routes';

/**
 * A self-contained server for hosting the app anywhere Node runs.
 *
 * Serves one built app (kiosk or staff) from STATIC_DIR and the API from the
 * same handlers Vercel runs. This is what lets the app move off Vercel and sit
 * next to a self-hosted database: no platform-specific code is involved.
 *
 *   npm run build:kiosk && npm run build:server
 *   APP_TARGET=kiosk SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm start
 *
 * Put it behind a reverse proxy that terminates TLS. It speaks plain HTTP, and
 * a PWA's service worker, the wake lock and fullscreen all require HTTPS on
 * anything other than localhost.
 */

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const STATIC_ROOT = resolve(process.env.STATIC_DIR ?? 'dist');
/** Covers the largest legitimate body, a check-in carrying a signature image. */
const MAX_BODY_BYTES = 1024 * 1024;

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

/** The same headers vercel.json sets, so both hosts behave identically. */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
};

const NO_CACHE = new Set(['/index.html', '/sw.js', '/registerSW.js', '/manifest.webmanifest']);

class PayloadTooLarge extends Error {}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const method = req.method ?? 'GET';
  const chunks: Buffer[] = [];
  let size = 0;

  if (method !== 'GET' && method !== 'HEAD') {
    for await (const chunk of req) {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) throw new PayloadTooLarge();
      chunks.push(buffer);
    }
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
    else if (value !== undefined) headers.set(name, value);
  }

  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
    method,
    headers,
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  });
}

async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveApi(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  const route = routes[pathname];
  if (!route) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }

  const handler = route[(req.method ?? 'GET') as Method];
  if (!handler) {
    res.setHeader('allow', Object.keys(route).join(', '));
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  try {
    await sendWebResponse(res, await handler(await toWebRequest(req)));
  } catch (cause) {
    if (cause instanceof PayloadTooLarge) {
      sendJson(res, 413, { error: 'payload_too_large' });
      return;
    }
    console.error(`${req.method} ${pathname} failed:`, cause);
    sendJson(res, 500, { error: 'server_error' });
  }
}

async function readIfFile(path: string): Promise<Buffer | null> {
  try {
    return (await stat(path)).isFile() ? await readFile(path) : null;
  } catch {
    return null;
  }
}

function cacheControlFor(pathname: string): string {
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (NO_CACHE.has(pathname) || /^\/workbox-[\w-]+\.js$/.test(pathname)) return 'no-cache';
  return 'public, max-age=3600';
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const target = resolve(STATIC_ROOT, `.${pathname}`);
  // Refuse anything that resolves outside the build directory.
  if (target !== STATIC_ROOT && !target.startsWith(STATIC_ROOT + sep)) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }

  let body = await readIfFile(target);
  let servedPath = pathname;

  // Client-side routes such as /frontdesk have no extension and no file, so they
  // get the app shell. A missing asset with an extension is a real 404.
  if (!body && !extname(pathname)) {
    body = await readIfFile(resolve(STATIC_ROOT, 'index.html'));
    servedPath = '/index.html';
  }

  if (!body) {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Not found');
    return;
  }

  res.statusCode = 200;
  res.setHeader('content-type', MIME[extname(servedPath)] ?? 'application/octet-stream');
  res.setHeader('cache-control', cacheControlFor(servedPath));
  res.setHeader('content-length', body.length);
  res.end(req.method === 'HEAD' ? undefined : body);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    sendJson(res, 400, { error: 'bad_request' });
    return;
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    await serveApi(req, res, pathname);
    return;
  }
  await serveStatic(req, res, pathname);
}

const server = createServer((req, res) => {
  handle(req, res).catch((cause) => {
    console.error('request failed:', cause);
    if (!res.headersSent) sendJson(res, 500, { error: 'server_error' });
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  const target = process.env.APP_TARGET ?? process.env.VITE_APP_TARGET ?? 'all (development)';
  console.log(`vms server on http://${HOST}:${PORT}  target=${target}  static=${STATIC_ROOT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
