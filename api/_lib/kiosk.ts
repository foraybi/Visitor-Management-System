import { createHash } from 'node:crypto';
import { json, targetAllows, type Handler } from './http.js';
import { serviceClient } from './supabaseAdmin.js';

/**
 * Shared plumbing for the kiosk endpoints.
 *
 * The tablet holds no Supabase credentials. It sends a device token to these
 * endpoints, which run on the server, hold the service key, and act on the
 * tablet's behalf. Developer tools on the tablet therefore show a request to
 * this app's own origin and nothing else.
 *
 * Each endpoint makes exactly one database call. The device check, the rate
 * limit and the work itself run together inside one Postgres function
 * (kiosk_check_in, kiosk_check_out, kiosk_lookup_employee, kiosk_directory).
 * They used to be three to five separate round trips, and with the database on
 * another continent each one cost 600-1000ms.
 */

/**
 * SHA-256 of the tablet's token, or null when it is missing or too short to be
 * one. Only the hash reaches the database, which stores only hashes.
 */
function tokenHash(request: Request): string | null {
  const token = request.headers.get('x-kiosk-token');
  if (!token || token.length < 32) return null;
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** HTTP status for each error a kiosk database function can return. */
const ERROR_STATUS: Readonly<Record<string, number>> = {
  unauthorised_device: 401,
  unknown_company: 400,
  no_active_visit: 404,
  rate_limited: 429,
};

export type KioskRpcResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Call one kiosk database function.
 *
 * A function reports an expected refusal as `{ "error": "..." }`, mapped here
 * to the same status the endpoints always returned. A failed call, the network
 * or the database itself, becomes a 502 carrying `unavailable`.
 */
export async function kioskRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  unavailable: string,
): Promise<KioskRpcResult<T>> {
  const { data, error } = await serviceClient().rpc(fn, args);
  if (error) {
    console.error(`${fn} failed:`, error);
    return { ok: false, response: json(502, { error: unavailable }) };
  }

  const refusal = (data as { error?: unknown } | null)?.error;
  if (typeof refusal === 'string') {
    return { ok: false, response: json(ERROR_STATUS[refusal] ?? 500, { error: refusal }) };
  }
  return { ok: true, data: data as T };
}

/**
 * Wrap a kiosk handler with the deployment check, the token check and a generic
 * error response, so a malformed request cannot be used to map the schema from
 * the tablet.
 *
 * A request with no plausible token is refused here without touching the
 * database. Whether a plausible token belongs to an active tablet is decided by
 * the database function the handler calls.
 */
export function kioskHandler(
  handler: (request: Request, tokenHash: string) => Promise<Response>,
): Handler {
  return async (request) => {
    if (!targetAllows('kiosk')) return json(404, { error: 'not_found' });

    try {
      const hash = tokenHash(request);
      if (!hash) return json(401, { error: 'unauthorised_device' });
      return await handler(request, hash);
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
