import { json, readJson } from '../_lib/http.js';
import { kioskHandler, kioskRpc, todayInRiyadh } from '../_lib/kiosk.js';
import {
  normalisePhone,
  parseIdentityNumber,
  type IdentityType,
} from '../../src/domain/identity/identity.js';

/**
 * Close an active visit.
 *
 * Visitors and employees check out the same way, with the mobile number or the
 * ID number they checked in with. The visit code is no longer typed at the
 * tablet; it is shown to the front desk and admin only. An employee's visit has
 * no phone of its own, so a mobile number also matches the employee record.
 *
 * Only a visit opened today is closed. Rate limited, because each attempt
 * answers whether someone with that number is in the building. The device check,
 * the rate limit and the update run in one database call, kiosk_check_out.
 */

interface CheckOutBody {
  phone?: unknown;
  idType?: unknown;
  idNumber?: unknown;
}

export const handleCheckOut = kioskHandler(async (request, tokenHash) => {
  const body = await readJson<CheckOutBody>(request);
  if (!body) return json(400, { error: 'invalid_request' });

  let phone: string | null = null;
  let idNumber: string | null = null;

  if (body.phone !== undefined) {
    phone = typeof body.phone === 'string' ? normalisePhone(body.phone) : null;
    if (!phone) return json(400, { error: 'invalid_identity', reason: 'phone_format' });
  } else {
    if (typeof body.idType !== 'string' || typeof body.idNumber !== 'string') {
      return json(400, { error: 'invalid_request' });
    }
    // The same module the tablet uses, so both normalise digits identically.
    const parsed = parseIdentityNumber(body.idType as IdentityType, body.idNumber);
    if (!parsed.ok) return json(400, { error: 'invalid_identity', reason: parsed.reason });
    idNumber = parsed.value;
  }

  const result = await kioskRpc<{ name: string }>(
    'kiosk_check_out',
    {
      p_token_hash: tokenHash,
      p_today: todayInRiyadh(),
      p_phone: phone,
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
