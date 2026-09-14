import { json } from '../_lib/http.js';
import { kioskHandler } from '../_lib/kiosk.js';
import { serviceClient } from '../_lib/supabaseAdmin.js';

/**
 * The company and floor picker, plus which check-in fields to show.
 *
 * Returns only what the picker renders. The kiosk used to load the entire
 * employee directory onto the tablet to draw this list.
 */
export const handleDirectory = kioskHandler(async () => {
  const supabase = serviceClient();

  const [companies, floors, formConfig] = await Promise.all([
    supabase.from('companies').select('id, name, name_ar, floor').order('name'),
    supabase.from('floors').select('number, name, name_ar, image_url').order('number'),
    supabase.from('form_config').select('fields').eq('id', 1).maybeSingle(),
  ]);

  if (companies.error || floors.error) {
    console.error('directory read failed:', companies.error ?? floors.error);
    return json(502, { error: 'directory_unavailable' });
  }

  return json(200, {
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
      imageUrl: f.image_url ?? '',
    })),
    // A missing row means every field is shown, as the form did before.
    formFields: formConfig.data?.fields ?? null,
  });
});

/** Vercel entry point. The self-hosted server uses handleDirectory directly. */
export function GET(request: Request): Promise<Response> {
  return handleDirectory(request);
}
