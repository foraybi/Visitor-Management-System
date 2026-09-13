import { isRole } from '../../src/domain/access/access';
import { decideCreate, decideDelete, type Actor } from '../_lib/accounts';
import { json, readJson, targetAllows, type Handler } from '../_lib/http';
import { authenticateStaff } from '../_lib/staffAuth';
import { serviceClient } from '../_lib/supabaseAdmin';

/**
 * Create and remove staff accounts.
 *
 * Created with the admin API and `email_confirm: true`, so a new front desk or
 * admin account can sign in immediately without a verification email, and
 * public sign-up can stay switched off for the whole project. Removing an
 * account deletes the auth user, which cascades to its profile row, so access
 * ends everywhere rather than only in this app.
 */

function staffHandler(handler: (request: Request, actor: Actor) => Promise<Response>): Handler {
  return async (request) => {
    if (!targetAllows('staff')) return json(404, { error: 'not_found' });

    try {
      const actor = await authenticateStaff(request);
      if (!actor) return json(401, { error: 'unauthorised' });
      return await handler(request, actor);
    } catch (cause) {
      console.error('staff accounts handler failed:', cause);
      return json(500, { error: 'server_error' });
    }
  };
}

export const createAccount = staffHandler(async (request, actor) => {
  const decision = decideCreate(actor, await readJson(request));
  if (!decision.ok) return json(decision.status, { error: decision.error });

  const { email, password, fullName, role } = decision.value;
  const supabase = serviceClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    const code = (error as { code?: string } | null)?.code ?? '';
    const message = error?.message ?? '';
    if (code === 'email_exists' || /already (been )?registered|already exists/i.test(message)) {
      return json(409, { error: 'email_taken' });
    }
    if (code === 'weak_password') return json(400, { error: 'weak_password' });
    console.error('createUser failed:', error);
    return json(502, { error: 'server_error' });
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, email, full_name: fullName, role });

  if (profileError) {
    // An auth user without a profile can sign in to nothing, but it would block
    // the email from being reused. Undo it.
    console.error('profile insert failed, removing the new auth user:', profileError);
    await supabase.auth.admin.deleteUser(data.user.id);
    return json(502, { error: 'server_error' });
  }

  return json(201, { id: data.user.id, email, fullName, role });
});

export const deleteAccount = staffHandler(async (request, actor) => {
  const id = new URL(request.url).searchParams.get('id');
  const supabase = serviceClient();

  let targetRole = null;
  if (typeof id === 'string') {
    const { data, error } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle();
    if (error && error.code !== '22P02') {
      console.error('profile read failed:', error);
      return json(502, { error: 'server_error' });
    }
    targetRole = data && isRole(data.role) ? data.role : null;
  }

  const decision = decideDelete(actor, id, targetRole);
  if (!decision.ok) return json(decision.status, { error: decision.error });

  const { error } = await supabase.auth.admin.deleteUser(decision.value);
  if (error) {
    if (/not.?found/i.test(error.message)) return json(404, { error: 'not_found' });
    // The last-superadmin trigger lands here too, and must not be retried.
    console.error('deleteUser failed:', error);
    return json(409, { error: 'server_error' });
  }

  return json(200, { id: decision.value });
});

export function POST(request: Request): Promise<Response> {
  return createAccount(request);
}

export function DELETE(request: Request): Promise<Response> {
  return deleteAccount(request);
}
