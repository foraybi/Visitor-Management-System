import { json, readJson } from '../_lib/http.js';
import { kioskHandler, withinRateLimit } from '../_lib/kiosk.js';
import { serviceClient } from '../_lib/supabaseAdmin.js';
import { parseIdentityNumber, type IdentityType } from '../../src/domain/identity/identity.js';

/**
 * Recognise a returning employee from their identity number.
 *
 * Rate limited because the endpoint is a yes/no oracle over identity numbers:
 * without a limit a stolen device token could enumerate the directory.
 */
const LOOKUPS_PER_MINUTE = 10;

export const handleLookupEmployee = kioskHandler(async (request, device) => {
  const body = await readJson<{ idNumber?: unknown; idType?: unknown }>(request);
  if (!body || typeof body.idNumber !== 'string' || typeof body.idType !== 'string') {
    return json(400, { error: 'invalid_request' });
  }

  // The same module the browser uses, so the rules cannot drift between them.
  const parsed = parseIdentityNumber(body.idType as IdentityType, body.idNumber);
  if (!parsed.ok) return json(400, { error: 'invalid_identity', reason: parsed.reason });

  if (!(await withinRateLimit(device.id, 'lookup', LOOKUPS_PER_MINUTE, 60))) {
    return json(429, { error: 'rate_limited' });
  }

  const { data, error } = await serviceClient()
    .from('employees')
    .select('name, name_ar, employee_number, companies(id, name, name_ar, floor)')
    .eq('nationality_id_number', parsed.value)
    .eq('employment_status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('employee lookup failed:', error);
    return json(502, { error: 'lookup_unavailable' });
  }

  // A miss and an inactive employee answer identically.
  if (!data) return json(200, { employee: null });

  const company = Array.isArray(data.companies) ? data.companies[0] : data.companies;

  return json(200, {
    employee: {
      name: data.name,
      nameAr: data.name_ar,
      employeeNumber: data.employee_number,
      company: company
        ? { id: company.id, name: company.name, nameAr: company.name_ar, floor: company.floor }
        : null,
    },
  });
});

export function POST(request: Request): Promise<Response> {
  return handleLookupEmployee(request);
}
