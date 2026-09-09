import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, kioskHandler, serviceClient } from '../_lib/kiosk';

/**
 * The company and floor picker.
 *
 * Replaces the kiosk's calls to fetchCompanies and fetchFloors, which pulled the
 * entire employee directory into the tablet's memory: names, phones, emails,
 * identity numbers, gender, hire dates, photographs and notes. The picker only
 * ever rendered a company name and a floor, so that is all this returns.
 */
export default kioskHandler('GET', async (_req: VercelRequest, res: VercelResponse) => {
  const supabase = serviceClient();

  const [companies, floors] = await Promise.all([
    supabase.from('companies').select('id, name, name_ar, floor').order('name'),
    supabase.from('floors').select('number, name, name_ar, image_url').order('number'),
  ]);

  if (companies.error || floors.error) {
    console.error('directory read failed:', companies.error ?? floors.error);
    json(res, 502, { error: 'directory_unavailable' });
    return;
  }

  json(res, 200, {
    companies: (companies.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      nameAr: c.name_ar,
      floor: c.floor,
    })),
    floors: (floors.data ?? []).map((f) => ({
      number: f.number,
      name: f.name,
      nameAr: f.name_ar,
      imageUrl: f.image_url,
    })),
  });
});
