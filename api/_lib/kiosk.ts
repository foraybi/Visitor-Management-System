import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Shared plumbing for the kiosk endpoints.
 *
 * The tablet holds no Supabase credentials. It sends a device token to these
 * endpoints, which run on the server, hold the service key, and act on the
 * tablet's behalf. Developer tools on the tablet therefore show a request to
 * this app's own origin and nothing else: no project URL, no key, no table
 * names, no schema.
 *
 * SUPABASE_SERVICE_ROLE_KEY must never be renamed to carry a VITE_ prefix. Vite
 * inlines every VITE_ variable into the client bundle, which would put the
 * service key on the tablet and undo the entire arrangement.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

/** The service-role client. Bypasses Row Level Security, so it never leaves the server. */
export function serviceClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the kiosk project',
    );
  }
  cached ??= createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export interface KioskDevice {
  id: string;
  label: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison, so a rejected token leaks nothing through timing. */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Resolve the calling tablet, or null if the token is missing, unknown or
 * revoked. Revocation is a single row flipped, with no key rotation and no
 * effect on any other device.
 */
export async function authenticateDevice(req: VercelRequest): Promise<KioskDevice | null> {
  const header = req.headers['x-kiosk-token'];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token || token.length < 32) return null;

  const supabase = serviceClient();
  const digest = hashToken(token);

  const { data, error } = await supabase
    .from('kiosk_devices')
    .select('id, label, token_hash, active')
    .eq('token_hash', digest)
    .eq('active', true)
    .maybeSingle();

  if (error || !data || !hashesMatch(data.token_hash, digest)) return null;

  // Fire and forget: a failed heartbeat must not fail a check-in.
  void supabase
    .from('kiosk_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id);

  return { id: data.id, label: data.label };
}

/** Returns true when the call is within its limit. */
export async function withinRateLimit(
  deviceId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await serviceClient().rpc('kiosk_rate_limit_hit', {
    p_device_id: deviceId,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  // Fail closed. If the limiter is unavailable we refuse rather than open the
  // enumeration path it exists to close.
  if (error) return false;
  return data === true;
}

export function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

/**
 * Wrap a handler with method checking and device authentication.
 *
 * Errors are logged server-side and answered with a generic message, so a
 * malformed request cannot be used to map the schema from the tablet.
 */
export function kioskHandler(
  method: 'GET' | 'POST',
  handler: (
    req: VercelRequest,
    res: VercelResponse,
    device: KioskDevice,
  ) => Promise<void>,
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    if (req.method !== method) {
      json(res, 405, { error: 'method_not_allowed' });
      return;
    }

    const device = await authenticateDevice(req);
    if (!device) {
      json(res, 401, { error: 'unauthorised_device' });
      return;
    }

    try {
      await handler(req, res, device);
    } catch (cause) {
      console.error(`kiosk handler failed for device ${device.id}:`, cause);
      json(res, 500, { error: 'server_error' });
    }
  };
}

/** Today's date in the building's timezone, as the visitors table stores it. */
export function todayInRiyadh(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
