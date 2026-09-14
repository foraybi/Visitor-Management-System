import { canAdminister, isRole, type Role } from '../../src/domain/access/access.js';

/**
 * The decisions behind staff account management, kept pure so they are tested
 * directly rather than through a database.
 *
 * The endpoint creates accounts with the service key, which bypasses Row Level
 * Security and the role trigger. So these checks are not a convenience layered
 * over the database: on this path they are the enforcement.
 */

/** Roles that can be granted from the admin console. */
export type AssignableRole = 'frontdesk' | 'admin';

/**
 * `superadmin` is deliberately absent. A super admin is created only by running
 * supabase/scripts/bootstrap-superadmin.sql against the database, so a stolen
 * super admin session cannot mint a second one.
 */
export const ASSIGNABLE_ROLES: readonly AssignableRole[] = ['frontdesk', 'admin'];

export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt ignores everything past 72 bytes, so a longer password is not stronger. */
export const MAX_PASSWORD_LENGTH = 72;

export interface NewAccount {
  email: string;
  password: string;
  fullName: string;
  role: AssignableRole;
}

export interface Actor {
  id: string;
  role: Role;
}

export type Decision<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function deny<T>(status: number, error: string): Decision<T> {
  return { ok: false, status, error };
}

export function decideCreate(actor: Actor | null, body: unknown): Decision<NewAccount> {
  if (!actor || !isRole(actor.role)) return deny(401, 'unauthorised');

  // Front desk may create nobody, so refuse before echoing any validation back.
  if (!canAdminister(actor.role, 'frontdesk')) return deny(403, 'forbidden');

  const input = (body ?? {}) as Record<string, unknown>;
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const role = input.role;

  if (email.length > 254 || !EMAIL.test(email)) return deny(400, 'invalid_email');
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return deny(400, 'weak_password');
  }
  if (fullName.length === 0 || fullName.length > 120) return deny(400, 'invalid_name');
  if (!(ASSIGNABLE_ROLES as readonly unknown[]).includes(role)) return deny(400, 'invalid_role');

  const assigned = role as AssignableRole;
  if (!canAdminister(actor.role, assigned)) return deny(403, 'forbidden');

  return { ok: true, value: { email, password, fullName, role: assigned } };
}

/**
 * Whether `actor` may remove the account `targetId`, whose role is `targetRole`
 * (null when the auth user has no profile row).
 */
export function decideDelete(
  actor: Actor | null,
  targetId: unknown,
  targetRole: Role | null,
): Decision<string> {
  if (!actor || !isRole(actor.role)) return deny(401, 'unauthorised');
  if (!isUuid(targetId)) return deny(400, 'invalid_id');
  if (targetId === actor.id) return deny(400, 'cannot_remove_self');

  // An auth user with no profile has no known role. Only a super admin clears
  // those up, since an admin cannot tell whether it was once an admin.
  if (targetRole === null) {
    return actor.role === 'superadmin' ? { ok: true, value: targetId } : deny(403, 'forbidden');
  }

  if (!canAdminister(actor.role, targetRole)) return deny(403, 'forbidden');
  return { ok: true, value: targetId };
}
