import { json, readJson } from '../_lib/http.js';
import { kioskHandler, kioskRpc, todayInRiyadh } from '../_lib/kiosk.js';
import { parseIdentityNumber, type IdentityType } from '../../src/domain/identity/identity.js';
import { isVisitPurpose } from '../../src/domain/visit/visitPurpose.js';

/**
 * Record a check-in and return the visitor-facing code.
 *
 * The code is allocated by Postgres from a per-day counter. The browser used to
 * count today's rows, which restarted at 0001 each morning against a primary key
 * and silently lost every visit from the second day onward. This endpoint is the
 * only way a visit is created: no signed-in user has an insert policy.
 *
 * One database call, kiosk_check_in, checks the tablet, checks the company,
 * allocates the code and saves the visit in one transaction. If saving fails,
 * the code is not used up.
 */

interface CheckInBody {
  visitorType?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  nationalityType?: unknown;
  nationalityIdNumber?: unknown;
  countryCode?: unknown;
  countryName?: unknown;
  visitedCompanyId?: unknown;
  floor?: unknown;
  signatureDataUrl?: unknown;
  visitPurpose?: unknown;
}

/** A data URL for a signature image. Anything larger is not a signature. */
const MAX_SIGNATURE_BYTES = 512 * 1024;

function asString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > max ? null : trimmed;
}

export const handleCheckIn = kioskHandler(async (request, tokenHash) => {
  const body = await readJson<CheckInBody>(request);
  if (!body) return json(400, { error: 'invalid_request' });

  const visitorType = body.visitorType === 'employee' ? 'employee' : 'visitor';
  const companyId = asString(body.visitedCompanyId, 64);
  const floor = typeof body.floor === 'number' && Number.isInteger(body.floor) ? body.floor : null;
  if (!companyId || floor === null) return json(400, { error: 'invalid_request' });

  const identity = parseIdentityNumber(
    body.nationalityType as IdentityType,
    typeof body.nationalityIdNumber === 'string' ? body.nationalityIdNumber : '',
  );
  if (!identity.ok) return json(400, { error: 'invalid_identity', reason: identity.reason });

  const signature = typeof body.signatureDataUrl === 'string' ? body.signatureDataUrl : '';
  if (signature.length > MAX_SIGNATURE_BYTES) return json(413, { error: 'signature_too_large' });

  // The floor is taken from the company record inside the function, never from
  // the tablet.
  const result = await kioskRpc<{ visitCode: string; floor: number }>(
    'kiosk_check_in',
    {
      p_token_hash: tokenHash,
      p_today: todayInRiyadh(),
      p_visit: {
        visited_company_id: companyId,
        visitor_type: visitorType,
        name: asString(body.name, 120) ?? '',
        phone: asString(body.phone, 32) ?? '',
        email: asString(body.email, 160),
        nationality_type: body.nationalityType,
        nationality_id_number: identity.value,
        country_code: asString(body.countryCode, 8) ?? 'SA',
        country_name: asString(body.countryName, 80) ?? '',
        signature_data_url: signature,
        // Visitors only. Not required here: a tablet still running the previous
        // version of the page sends none, and its check-in must not fail.
        visit_purpose:
          visitorType === 'visitor' && isVisitPurpose(body.visitPurpose) ? body.visitPurpose : null,
      },
    },
    'check_in_failed',
  );
  if (!result.ok) return result.response;

  return json(201, { visitCode: result.data.visitCode, floor: result.data.floor });
});

export function POST(request: Request): Promise<Response> {
  return handleCheckIn(request);
}
