import { json, readJson } from '../_lib/http';
import { kioskHandler, todayInRiyadh, withinRateLimit } from '../_lib/kiosk';
import { serviceClient } from '../_lib/supabaseAdmin';
import { parseIdentityNumber, type IdentityType } from '../../src/domain/identity/identity';

/**
 * Close an active visit.
 *
 * A visitor checks out with the four-digit code on their card. An employee is
 * never shown a code, so they check out with the identity number they checked
 * in with, and that path only ever closes an employee visit opened today. A
 * visitor's visit cannot be closed by identity number, so someone who overhears
 * an ID cannot check that visitor out.
 *
 * Rate limited because both are guessable: a visit code is four digits, and an
 * identity number is a yes/no answer to whether someone is in the building.
 */
const ATTEMPTS_PER_MINUTE = 8;

interface CheckOutBody {
  visitCode?: unknown;
  idType?: unknown;
  idNumber?: unknown;
}

export const handleCheckOut = kioskHandler(async (request, device) => {
  const body = await readJson<CheckOutBody>(request);
  if (!body) return json(400, { error: 'invalid_request' });

  const byIdentity = body.idType !== undefined || body.idNumber !== undefined;
  let visitCode = '';
  let idNumber = '';

  if (byIdentity) {
    if (typeof body.idType !== 'string' || typeof body.idNumber !== 'string') {
      return json(400, { error: 'invalid_request' });
    }
    // The same module the tablet uses, so both normalise digits identically.
    const parsed = parseIdentityNumber(body.idType as IdentityType, body.idNumber);
    if (!parsed.ok) return json(400, { error: 'invalid_identity', reason: parsed.reason });
    idNumber = parsed.value;
  } else {
    const raw = typeof body.visitCode === 'string' ? body.visitCode.trim() : '';
    if (!/^\d{1,4}$/.test(raw)) return json(400, { error: 'invalid_code' });
    visitCode = raw.padStart(4, '0');
  }

  if (!(await withinRateLimit(device.id, 'checkout', ATTEMPTS_PER_MINUTE, 60))) {
    return json(429, { error: 'rate_limited' });
  }

  // Today's visits, active only: yesterday's 0001 cannot close today's.
  const today = serviceClient()
    .from('visitors')
    .update({ exit_time: new Date().toISOString(), status: 'exited' })
    .eq('date', todayInRiyadh())
    .eq('status', 'active');

  const { data, error } = await (byIdentity
    ? today.eq('visitor_type', 'employee').eq('nationality_id_number', idNumber)
    : today.eq('visit_code', visitCode)
  ).select('name');

  if (error) {
    console.error('check-out failed:', error);
    return json(502, { error: 'check_out_unavailable' });
  }
  if (!data || data.length === 0) return json(404, { error: 'no_active_visit' });

  return json(200, { name: data[0].name });
});

export function POST(request: Request): Promise<Response> {
  return handleCheckOut(request);
}
