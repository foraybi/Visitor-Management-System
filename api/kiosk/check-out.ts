import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, kioskHandler, serviceClient, todayInRiyadh, withinRateLimit } from '../_lib/kiosk';

/**
 * Close an active visit by its visitor-facing code.
 *
 * The kiosk cannot read the visitors table, so it cannot look a code up and then
 * update it. This endpoint does both against a code scoped to today, and returns
 * only the display name it needs for the farewell screen.
 *
 * Rate limited because a visit code is four digits. Unlimited attempts would let
 * anyone with the device token walk the whole range and close every open visit
 * in the building, which would make the log say the building was empty.
 */
const ATTEMPTS_PER_MINUTE = 8;

export default kioskHandler('POST', async (req: VercelRequest, res: VercelResponse, device) => {
  const body = (req.body ?? {}) as { visitCode?: unknown };

  const raw = typeof body.visitCode === 'string' ? body.visitCode.trim() : '';
  if (!/^\d{1,4}$/.test(raw)) {
    json(res, 400, { error: 'invalid_code' });
    return;
  }
  const visitCode = raw.padStart(4, '0');

  if (!(await withinRateLimit(device.id, 'checkout', ATTEMPTS_PER_MINUTE, 60))) {
    json(res, 429, { error: 'rate_limited' });
    return;
  }

  const supabase = serviceClient();

  // Scoped to today and to an active visit, so yesterday's code cannot close
  // today's visit and a completed visit cannot be closed twice.
  const { data, error } = await supabase
    .from('visitors')
    .update({ exit_time: new Date().toISOString(), status: 'exited' })
    .eq('visit_code', visitCode)
    .eq('date', todayInRiyadh())
    .eq('status', 'active')
    .select('name')
    .maybeSingle();

  if (error) {
    console.error('check-out failed:', error);
    json(res, 502, { error: 'check_out_unavailable' });
    return;
  }

  if (!data) {
    json(res, 404, { error: 'no_active_visit' });
    return;
  }

  json(res, 200, { name: data.name });
});
