import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, kioskHandler, serviceClient, withinRateLimit } from '../_lib/kiosk';
import { parseIdentityNumber, type IdentityType } from '../../src/domain/identity/identity';

/**
 * Recognise a returning employee from their identity number.
 *
 * Replaces `findEmployee`, which scanned every company's employees in the
 * tablet's memory. That required the whole staff directory to be on the device;
 * this returns one display name and nothing else.
 *
 * Rate limited because the endpoint is a yes/no oracle over identity numbers. A
 * ten-digit national id is guessable at scale, so an unlimited endpoint would
 * let a stolen device token enumerate the directory one number at a time.
 */
const LOOKUPS_PER_MINUTE = 10;

export default kioskHandler('POST', async (req: VercelRequest, res: VercelResponse, device) => {
  const body = (req.body ?? {}) as { idNumber?: unknown; idType?: unknown };

  if (typeof body.idNumber !== 'string' || typeof body.idType !== 'string') {
    json(res, 400, { error: 'invalid_request' });
    return;
  }

  // Validated with the same module the browser uses, so the server does not
  // become a sixth copy of the identity rules that can drift from the other five.
  const parsed = parseIdentityNumber(body.idType as IdentityType, body.idNumber);
  if (!parsed.ok) {
    json(res, 400, { error: 'invalid_identity', reason: parsed.reason });
    return;
  }

  if (!(await withinRateLimit(device.id, 'lookup', LOOKUPS_PER_MINUTE, 60))) {
    json(res, 429, { error: 'rate_limited' });
    return;
  }

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('employees')
    .select('name, name_ar, employee_number, employment_status, company_id, companies(id, name, name_ar, floor)')
    .eq('nationality_id_number', parsed.value)
    .eq('employment_status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('employee lookup failed:', error);
    json(res, 502, { error: 'lookup_unavailable' });
    return;
  }

  // A miss and an inactive employee answer identically, so the endpoint does not
  // distinguish "not an employee" from "no longer an employee".
  if (!data) {
    json(res, 200, { employee: null });
    return;
  }

  const company = Array.isArray(data.companies) ? data.companies[0] : data.companies;

  json(res, 200, {
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
