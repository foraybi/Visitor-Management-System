import { createHash, timingSafeEqual } from 'node:crypto';
import { json, targetAllows, type Handler } from './http.js';
import { serviceClient } from './supabaseAdmin.js';

/**
 * Shared plumbing for the kiosk endpoints.
 *
 * The tablet holds no Supabase credentials. It sends a device token to these
 * endpoints, which run on the server, hold the service key, and act on the
 * tablet's behalf. Developer tools on the tablet therefore show a request to
 * this app's own origin and nothing else.
 */

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
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The calling tablet, or null if the token is missing, unknown or revoked. */
export async function authenticateDevice(request: Request): Promise<KioskDevice | null> {
  const token = request.headers.get('x-kiosk-token');
  if (!token || token.length < 32) return null;

  const supabase = serviceClient();
  const digest = hashToken(token);

  const { data, error } = await supabase
    .from('kiosk_devices')
    .select('id, label, token_hash')
    .eq('token_hash', digest)
    .eq('active', true)
    .maybeSingle();

  if (error || !data || !hashesMatch(data.token_hash, digest)) return null;

  // A failed heartbeat must not fail a check-in.
  void supabase
    .from('kiosk_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => undefined);

  return { id: data.id, label: data.label };
}

/** True when the call is within its limit. Fails closed. */
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
  return !error && data === true;
}

/**
 * Wrap a kiosk handler with the deployment check, device authentication and a
 * generic error response, so a malformed request cannot be used to map the
 * schema from the tablet.
 */
export function kioskHandler(
  handler: (request: Request, device: KioskDevice) => Promise<Response>,
): Handler {
  return async (request) => {
    if (!targetAllows('kiosk')) return json(404, { error: 'not_found' });

    try {
      const device = await authenticateDevice(request);
      if (!device) return json(401, { error: 'unauthorised_device' });
      return await handler(request, device);
    } catch (cause) {
      console.error('kiosk handler failed:', cause);
      return json(500, { error: 'server_error' });
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
