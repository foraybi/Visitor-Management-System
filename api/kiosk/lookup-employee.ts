import { json, readJson } from '../_lib/http.js';
import { kioskHandler, kioskRpc } from '../_lib/kiosk.js';
import { parseIdentityNumber, type IdentityType } from '../../src/domain/identity/identity.js';

/**
 * Recognise a returning employee from their identity number.
 *
 * Rate limited because the endpoint is a yes/no oracle over identity numbers:
 * without a limit a stolen device token could enumerate the directory. The
 * device check, the rate limit and the lookup run in one database call,
 * kiosk_lookup_employee. A miss and an inactive employee answer identically.
 */

interface EmployeeMatch {
  name: string;
  nameAr: string;
  employeeNumber: string;
  company: { id: string; name: string; nameAr: string; floor: number } | null;
}

export const handleLookupEmployee = kioskHandler(async (request, tokenHash) => {
  const body = await readJson<{ idNumber?: unknown; idType?: unknown }>(request);
  if (!body || typeof body.idNumber !== 'string' || typeof body.idType !== 'string') {
    return json(400, { error: 'invalid_request' });
  }

  // The same module the browser uses, so the rules cannot drift between them.
  const parsed = parseIdentityNumber(body.idType as IdentityType, body.idNumber);
  if (!parsed.ok) return json(400, { error: 'invalid_identity', reason: parsed.reason });

  const result = await kioskRpc<{ employee: EmployeeMatch | null }>(
    'kiosk_lookup_employee',
    { p_token_hash: tokenHash, p_id_number: parsed.value },
    'lookup_unavailable',
  );
  if (!result.ok) return result.response;

  return json(200, { employee: result.data.employee ?? null });
});

export function POST(request: Request): Promise<Response> {
  return handleLookupEmployee(request);
}
