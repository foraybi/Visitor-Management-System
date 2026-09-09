/**
 * Who may do what.
 *
 * This is a convenience for the interface, not the security boundary. Row Level
 * Security in Postgres decides what actually happens; this module only decides
 * what to render, so a stale answer here hides a button rather than leaking a
 * row. The two must agree, and the policy migration mirrors this table.
 *
 * Previously the role came from `user_metadata`, which is the user-writable JWT
 * claim, so any signed-in account could promote itself to admin from the browser
 * console. The role now comes from `profiles`, and Postgres reads it there too.
 */

export type Role = 'superadmin' | 'admin' | 'frontdesk';

export const ROLES: readonly Role[] = ['superadmin', 'admin', 'frontdesk'] as const;

export type Permission =
  // Visitors
  | 'visitors.read'
  | 'visitors.update'
  | 'visitors.delete'
  | 'visitors.export'
  // Directory
  | 'companies.read'
  | 'companies.write'
  | 'companies.delete'
  | 'employees.read'
  | 'employees.write'
  | 'employees.delete'
  | 'employees.verify'
  | 'floors.read'
  | 'floors.manage'
  // Configuration
  | 'formConfig.read'
  | 'formConfig.manage'
  | 'documentSettings.read'
  | 'documentSettings.manage'
  | 'analytics.view'
  // Staff and devices
  | 'staff.read'
  | 'staff.createFrontdesk'
  | 'staff.deleteFrontdesk'
  | 'staff.createAdmin'
  | 'staff.deleteAdmin'
  | 'staff.assignRole'
  | 'devices.manage';

const FRONTDESK: readonly Permission[] = [
  'visitors.read',
  'visitors.update',
  'visitors.export',
  'companies.read',
  'employees.read',
  'employees.write',
  'floors.read',
  'formConfig.read',
  'documentSettings.read',
];

const ADMIN: readonly Permission[] = [
  ...FRONTDESK,
  'visitors.delete',
  'companies.write',
  'companies.delete',
  'employees.delete',
  'employees.verify',
  'floors.manage',
  'formConfig.manage',
  'documentSettings.manage',
  'analytics.view',
  'staff.read',
  'staff.createFrontdesk',
  'staff.deleteFrontdesk',
  'devices.manage',
];

/**
 * A super admin holds every permission, including the three an admin is denied:
 * creating an admin, deleting an admin, and assigning a role.
 *
 * That is the point of the role. An admin who is compromised cannot manufacture
 * another admin, so the blast radius of a stolen admin session stays bounded.
 */
const SUPERADMIN: readonly Permission[] = [
  ...ADMIN,
  'staff.createAdmin',
  'staff.deleteAdmin',
  'staff.assignRole',
];

const BY_ROLE: Record<Role, ReadonlySet<Permission>> = {
  superadmin: new Set(SUPERADMIN),
  admin: new Set(ADMIN),
  frontdesk: new Set(FRONTDESK),
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Whether a role holds a permission.
 *
 * Takes `Role | null` because signed-out and unrecognised are the common cases
 * at a call site, and both must answer no rather than throw.
 */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return BY_ROLE[role].has(permission);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return [...BY_ROLE[role]];
}

/**
 * Whether `actor` may change `subject`'s account at all.
 *
 * Separate from `can` because it depends on both roles, not one. An admin may
 * manage front desk accounts but must not touch another admin or a super admin,
 * which is what stops lateral movement between equals.
 */
export function canAdminister(actor: Role | null | undefined, subject: Role): boolean {
  if (!isRole(actor)) return false;
  if (actor === 'superadmin') return true;
  if (actor === 'admin') return subject === 'frontdesk';
  return false;
}

/** The landing route for a role immediately after sign-in. */
export function homeRouteFor(role: Role): string {
  return role === 'frontdesk' ? '/frontdesk' : '/admin';
}
