import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, kioskHandler, serviceClient, todayInRiyadh } from '../_lib/kiosk';
import { parseIdentityNumber, type IdentityType } from '../../src/domain/identity/identity';

/**
 * Record a check-in and return the visitor-facing code.
 *
 * The code is allocated here rather than in the browser. The browser counted
 * today's rows and padded to four digits, which restarted at 0001 each morning
 * against a TEXT PRIMARY KEY, so every visit from the second day onward collided
 * and was silently dropped. Allocating server-side also removes the race between
 * two tablets checking in at the same moment.
 *
 * There is no insert policy for any signed-in user, so this endpoint is the only
 * way a visit is created.
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
}

/** A data URL for a signature image. Anything larger is not a signature. */
const MAX_SIGNATURE_BYTES = 512 * 1024;

function asString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

export default kioskHandler('POST', async (req: VercelRequest, res: VercelResponse) => {
  const body = (req.body ?? {}) as CheckInBody;

  const visitorType = body.visitorType === 'employee' ? 'employee' : 'visitor';
  const companyId = asString(body.visitedCompanyId, 64);
  const floor = typeof body.floor === 'number' && Number.isInteger(body.floor) ? body.floor : null;

  if (!companyId || floor === null) {
    json(res, 400, { error: 'invalid_request' });
    return;
  }

  const identity = parseIdentityNumber(
    body.nationalityType as IdentityType,
    typeof body.nationalityIdNumber === 'string' ? body.nationalityIdNumber : '',
  );
  if (!identity.ok) {
    json(res, 400, { error: 'invalid_identity', reason: identity.reason });
    return;
  }

  const signature = typeof body.signatureDataUrl === 'string' ? body.signatureDataUrl : '';
  if (signature.length > MAX_SIGNATURE_BYTES) {
    json(res, 413, { error: 'signature_too_large' });
    return;
  }

  const supabase = serviceClient();

  // The company must exist and the floor must be its floor. Trusting the
  // tablet's floor would let a mismatched pair into the log, and the visitor
  // badge is what the front desk relies on to know where someone went.
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, floor')
    .eq('id', companyId)
    .maybeSingle();

  if (companyError) {
    console.error('company check failed:', companyError);
    json(res, 502, { error: 'check_in_unavailable' });
    return;
  }
  if (!company) {
    json(res, 400, { error: 'unknown_company' });
    return;
  }

  const date = todayInRiyadh();
  const now = new Date().toISOString();

  const { data: code, error: codeError } = await supabase.rpc('allocate_visit_code', {
    p_date: date,
  });
  if (codeError || typeof code !== 'string') {
    console.error('visit code allocation failed:', codeError);
    json(res, 502, { error: 'check_in_unavailable' });
    return;
  }

  const { error: insertError } = await supabase.from('visitors').insert({
    visit_code: code,
    name: asString(body.name, 120) ?? '',
    phone: asString(body.phone, 32) ?? '',
    email: asString(body.email, 160),
    nationality_type: body.nationalityType,
    nationality_id_number: identity.value,
    country_code: asString(body.countryCode, 8) ?? 'SA',
    country_name: asString(body.countryName, 80) ?? '',
    visitor_type: visitorType,
    visited_company_id: company.id,
    floor: company.floor,
    signature_data_url: signature,
    entry_time: now,
    exit_time: null,
    status: 'active',
    date,
  });

  if (insertError) {
    // The visitor is told, and no id card is shown. The old code logged this to
    // a console nobody was reading and showed a card regardless.
    console.error('check-in insert failed:', insertError);
    json(res, 502, { error: 'check_in_failed' });
    return;
  }

  json(res, 201, { visitCode: code, floor: company.floor });
});
