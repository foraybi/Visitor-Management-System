import { json, readJson } from '../_lib/http.js';
import { kioskHandler, kioskRpc, todayInRiyadh } from '../_lib/kiosk.js';
import { parseIdentityNumber, type IdentityType } from '../../src/domain/identity/identity.js';

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
 * The device check, the rate limit and the update run in one database call,
 * kiosk_check_out.
 */

interface CheckOutBody {
  visitCode?: unknown;
  idType?: unknown;
  idNumber?: unknown;
}

export const handleCheckOut = kioskHandler(async (request, tokenHash) => {
  const body = await readJson<CheckOutBody>(request);
  if (!body) return json(400, { error: 'invalid_request' });

  const byIdentity = body.idType !== undefined || body.idNumber !== undefined;
  let visitCode: string | null = null;
  let idNumber: string | null = null;

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

  const result = await kioskRpc<{ name: string }>(
    'kiosk_check_out',
    {
      p_token_hash: tokenHash,
      // Today's visits only: yesterday's 0001 cannot close today's.
      p_today: todayInRiyadh(),
      p_visit_code: visitCode,
      p_id_number: idNumber,
    },
    'check_out_unavailable',
  );
  if (!result.ok) return result.response;

  return json(200, { name: result.data.name });
});

export function POST(request: Request): Promise<Response> {
  return handleCheckOut(request);
}
