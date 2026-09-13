import { supabase } from '../lib/supabase';

/**
 * Creating and removing staff accounts, from the admin console.
 *
 * Accounts used to be created in the browser with `auth.signUp`, which only
 * works while public sign-up is switched on for the whole project, and which
 * leaves the new account unable to sign in until it clicks a confirmation email.
 * Both problems go away by creating accounts on the server with the admin API:
 * the account is confirmed at creation, and public sign-up can be off.
 *
 * The server checks the caller's role itself, so this module carries no
 * authority of its own; it only forwards the signed-in admin's token.
 */

export type AssignableRole = 'frontdesk' | 'admin';

export type StaffAccountError =
  | 'unauthorised'
  | 'forbidden'
  | 'invalid_email'
  | 'weak_password'
  | 'invalid_name'
  | 'invalid_role'
  | 'email_taken'
  | 'invalid_id'
  | 'cannot_remove_self'
  | 'not_found'
  | 'offline'
  | 'server_error';

export type StaffAccountResult<T> = { ok: true; value: T } | { ok: false; error: StaffAccountError };

const KNOWN: ReadonlySet<string> = new Set<StaffAccountError>([
  'unauthorised',
  'forbidden',
  'invalid_email',
  'weak_password',
  'invalid_name',
  'invalid_role',
  'email_taken',
  'invalid_id',
  'cannot_remove_self',
  'not_found',
]);

async function call<T>(
  method: 'POST' | 'DELETE',
  query: string,
  body?: unknown,
): Promise<StaffAccountResult<T>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'unauthorised' };

  try {
    const response = await fetch(`/api/staff/accounts${query}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const named = (payload as { error?: unknown } | null)?.error;
      if (typeof named === 'string' && KNOWN.has(named)) {
        return { ok: false, error: named as StaffAccountError };
      }
      if (response.status === 401) return { ok: false, error: 'unauthorised' };
      if (response.status === 403) return { ok: false, error: 'forbidden' };
      return { ok: false, error: 'server_error' };
    }
    return { ok: true, value: payload as T };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export function createStaffAccount(input: {
  fullName: string;
  email: string;
  password: string;
  role: AssignableRole;
}) {
  return call<{ id: string }>('POST', '', input);
}

export function deleteStaffAccount(id: string) {
  return call<{ id: string }>('DELETE', `?id=${encodeURIComponent(id)}`);
}

export function staffAccountErrorKey(error: StaffAccountError): string {
  return `staff.errors.${error}`;
}
