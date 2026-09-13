import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The service-role client. Bypasses Row Level Security, so it never leaves the
 * server.
 *
 * Reads its configuration at call time rather than at import, so a server
 * started with `--env-file` or a platform that injects variables late both work.
 * SUPABASE_URL may point at the cloud project or a self-hosted server; nothing
 * else in the API knows which.
 *
 * SUPABASE_SERVICE_ROLE_KEY must never carry a VITE_ prefix. Vite inlines every
 * VITE_ variable into the browser bundle.
 */

let cached: { url: string; key: string; client: SupabaseClient } | null = null;

export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the server');
  }

  if (!cached || cached.url !== url || cached.key !== key) {
    cached = {
      url,
      key,
      client: createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    };
  }
  return cached.client;
}
