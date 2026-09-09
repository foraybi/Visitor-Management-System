import { describe, expect, it } from 'vitest';
import {
  ROLES,
  can,
  canAdminister,
  homeRouteFor,
  isRole,
  permissionsFor,
  type Permission,
  type Role,
} from './access';

describe('roles', () => {
  it('recognises exactly the three staff roles', () => {
    expect(ROLES).toEqual(['superadmin', 'admin', 'frontdesk']);
  });

  it.each(['visitor', 'kiosk', 'anon', '', 'ADMIN'])('rejects %p as a role', (value) => {
    expect(isRole(value)).toBe(false);
  });

  // The kiosk authenticates with a device token against the kiosk API, not with
  // a Supabase account, so it must not appear in the staff role union.
  it('does not treat the kiosk as a staff role', () => {
    expect(isRole('kiosk')).toBe(false);
    expect(can('kiosk' as unknown as Role, 'visitors.read')).toBe(false);
  });
});

describe('can', () => {
  it.each([null, undefined, 'nonsense'])('answers no for %p rather than throwing', (role) => {
    expect(can(role as Role | null, 'visitors.read')).toBe(false);
  });

  it('gives a super admin every permission an admin has', () => {
    for (const permission of permissionsFor('admin')) {
      expect(can('superadmin', permission)).toBe(true);
    }
  });

  it('gives an admin every permission the front desk has', () => {
    for (const permission of permissionsFor('frontdesk')) {
      expect(can('admin', permission)).toBe(true);
    }
  });
});

describe('the powers reserved to a super admin', () => {
  const reserved: Permission[] = ['staff.createAdmin', 'staff.deleteAdmin', 'staff.assignRole'];

  it.each(reserved)('grants %s to a super admin', (permission) => {
    expect(can('superadmin', permission)).toBe(true);
  });

  // This is the containment property the role exists for. A compromised admin
  // must not be able to mint another admin or promote anyone.
  it.each(reserved)('denies %s to an admin', (permission) => {
    expect(can('admin', permission)).toBe(false);
  });

  it.each(reserved)('denies %s to the front desk', (permission) => {
    expect(can('frontdesk', permission)).toBe(false);
  });
});

describe('front desk limits', () => {
  it.each<Permission>([
    'visitors.delete',
    'companies.write',
    'companies.delete',
    'employees.delete',
    'floors.manage',
    'formConfig.manage',
    'documentSettings.manage',
    'analytics.view',
    'staff.read',
    'devices.manage',
  ])('denies %s', (permission) => {
    expect(can('frontdesk', permission)).toBe(false);
  });

  it('still allows the day-to-day work', () => {
    expect(can('frontdesk', 'visitors.read')).toBe(true);
    expect(can('frontdesk', 'visitors.update')).toBe(true);
    expect(can('frontdesk', 'employees.write')).toBe(true);
  });
});

describe('canAdminister', () => {
  it('lets a super admin administer every role', () => {
    for (const role of ROLES) {
      expect(canAdminister('superadmin', role)).toBe(true);
    }
  });

  it('lets an admin administer only the front desk', () => {
    expect(canAdminister('admin', 'frontdesk')).toBe(true);
    expect(canAdminister('admin', 'admin')).toBe(false);
    expect(canAdminister('admin', 'superadmin')).toBe(false);
  });

  it('lets the front desk administer nobody', () => {
    for (const role of ROLES) {
      expect(canAdminister('frontdesk', role)).toBe(false);
    }
  });

  it('answers no for a signed-out actor', () => {
    expect(canAdminister(null, 'frontdesk')).toBe(false);
  });
});

describe('homeRouteFor', () => {
  it('sends the front desk to its own surface', () => {
    expect(homeRouteFor('frontdesk')).toBe('/frontdesk');
  });

  it('sends both administrative roles to the admin surface', () => {
    expect(homeRouteFor('admin')).toBe('/admin');
    expect(homeRouteFor('superadmin')).toBe('/admin');
  });
});
