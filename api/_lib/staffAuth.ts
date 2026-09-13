import { isRole } from '../../src/domain/access/access';
import type { Actor } from './accounts';
import { serviceClient } from './supabaseAdmin';

/**
 * Identify the signed-in staff member making a request.
 *
 * The browser forwards its Supabase access token. The auth server validates it,
 * and the role is then read from `profiles`, never from the token's own claims,
 * because `user_metadata` inside a token is writable by the user it describes.
 */
export async function authenticateStaff(request: Request): Promise<Actor | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) return null;

  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile || !isRole(profile.role)) return null;
  return { id: data.user.id, role: profile.role };
}
