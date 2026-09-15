import { json } from '../_lib/http.js';
import { kioskHandler, kioskRpc } from '../_lib/kiosk.js';

/**
 * The company and floor picker, plus which check-in fields to show.
 *
 * Returns only what the picker renders. The kiosk used to load the entire
 * employee directory onto the tablet to draw this list. One database call,
 * kiosk_directory, checks the tablet and returns all three lists together.
 */

interface Directory {
  companies: Array<{ id: string; name: string; nameAr: string; floor: number }>;
  floors: Array<{ number: number; name: string; nameAr: string; imageUrl: string }>;
  formFields: unknown;
}

export const handleDirectory = kioskHandler(async (_request, tokenHash) => {
  const result = await kioskRpc<Directory>(
    'kiosk_directory',
    { p_token_hash: tokenHash },
    'directory_unavailable',
  );
  if (!result.ok) return result.response;

  return json(200, {
    companies: result.data.companies ?? [],
    floors: result.data.floors ?? [],
    // A missing row means every field is shown, as the form did before.
    formFields: result.data.formFields ?? null,
  });
});

/** Vercel entry point. The self-hosted server uses handleDirectory directly. */
export function GET(request: Request): Promise<Response> {
  return handleDirectory(request);
}
