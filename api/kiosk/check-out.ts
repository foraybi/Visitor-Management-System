import { json, readJson } from '../_lib/http';
import { kioskHandler, todayInRiyadh, withinRateLimit } from '../_lib/kiosk';
import { serviceClient } from '../_lib/supabaseAdmin';

/**
 * Close an active visit by its visitor-facing code.
 *
 * Rate limited because a visit code is four digits: unlimited attempts would let
 * anyone with the device token close every open visit in the building.
 */
const ATTEMPTS_PER_MINUTE = 8;

export const handleCheckOut = kioskHandler(async (request, device) => {
  const body = await readJson<{ visitCode?: unknown }>(request);
  const raw = typeof body?.visitCode === 'string' ? body.visitCode.trim() : '';
  if (!/^\d{1,4}$/.test(raw)) return json(400, { error: 'invalid_code' });
  const visitCode = raw.padStart(4, '0');

  if (!(await withinRateLimit(device.id, 'checkout', ATTEMPTS_PER_MINUTE, 60))) {
    return json(429, { error: 'rate_limited' });
  }

  // Today's code, active visits only: yesterday's 0001 cannot close today's.
  const { data, error } = await serviceClient()
    .from('visitors')
    .update({ exit_time: new Date().toISOString(), status: 'exited' })
    .eq('visit_code', visitCode)
    .eq('date', todayInRiyadh())
    .eq('status', 'active')
    .select('name')
    .maybeSingle();

  if (error) {
    console.error('check-out failed:', error);
    return json(502, { error: 'check_out_unavailable' });
  }
  if (!data) return json(404, { error: 'no_active_visit' });

  return json(200, { name: data.name });
});

export function POST(request: Request): Promise<Response> {
  return handleCheckOut(request);
}
