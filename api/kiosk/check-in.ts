import { json, readJson } from '../_lib/http';
import { kioskHandler, todayInRiyadh } from '../_lib/kiosk';
import { serviceClient } from '../_lib/supabaseAdmin';
import { parseIdentityNumber, type IdentityType } from '../../src/domain/identity/identity';

/**
 * Record a check-in and return the visitor-facing code.
 *
 * The code is allocated by Postgres from a per-day counter. The browser used to
 * count today's rows, which restarted at 0001 each morning against a primary key
 * and silently lost every visit from the second day onward. This endpoint is the
 * only way a visit is created: no signed-in user has an insert policy.
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
  return trimmed.length === 0 || trimmed.length > max ? null : trimmed;
}

export const handleCheckIn = kioskHandler(async (request) => {
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

  const supabase = serviceClient();

  // The floor comes from the company record, never from the tablet.
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, floor')
    .eq('id', companyId)
    .maybeSingle();

  if (companyError) {
    console.error('company check failed:', companyError);
    return json(502, { error: 'check_in_unavailable' });
  }
  if (!company) return json(400, { error: 'unknown_company' });

  const date = todayInRiyadh();

  const { data: code, error: codeError } = await supabase.rpc('allocate_visit_code', {
    p_date: date,
  });
  if (codeError || typeof code !== 'string') {
    console.error('visit code allocation failed:', codeError);
    return json(502, { error: 'check_in_unavailable' });
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
    entry_time: new Date().toISOString(),
    exit_time: null,
    status: 'active',
    date,
  });

  if (insertError) {
    console.error('check-in insert failed:', insertError);
    return json(502, { error: 'check_in_failed' });
  }

  return json(201, { visitCode: code, floor: company.floor });
});

export function POST(request: Request): Promise<Response> {
  return handleCheckIn(request);
}
