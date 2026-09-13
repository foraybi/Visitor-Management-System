import { describe, expect, it } from 'vitest';
import { decideCreate, decideDelete, type Actor } from './accounts';

const superadmin: Actor = { id: '11111111-1111-4111-8111-111111111111', role: 'superadmin' };
const admin: Actor = { id: '22222222-2222-4222-8222-222222222222', role: 'admin' };
const frontdesk: Actor = { id: '33333333-3333-4333-8333-333333333333', role: 'frontdesk' };
const target = '44444444-4444-4444-8444-444444444444';

const valid = {
  email: 'New.Staff@Example.com ',
  password: 'correct-horse',
  fullName: '  Sara Ali ',
  role: 'frontdesk',
};

describe('decideCreate', () => {
  it('lets an admin create a front desk account, normalising the input', () => {
    expect(decideCreate(admin, valid)).toEqual({
      ok: true,
      value: {
        email: 'new.staff@example.com',
        password: 'correct-horse',
        fullName: 'Sara Ali',
        role: 'frontdesk',
      },
    });
  });

  it('lets a super admin create an admin', () => {
    expect(decideCreate(superadmin, { ...valid, role: 'admin' }).ok).toBe(true);
  });

  // The containment property. The endpoint uses the service key, so this check
  // is the enforcement, not a convenience.
  it('refuses an admin creating another admin', () => {
    expect(decideCreate(admin, { ...valid, role: 'admin' })).toEqual({
      ok: false,
      status: 403,
      error: 'forbidden',
    });
  });

  it('refuses anyone creating a super admin from the console', () => {
    expect(decideCreate(superadmin, { ...valid, role: 'superadmin' })).toMatchObject({
      ok: false,
      error: 'invalid_role',
    });
  });

  it('refuses the front desk before validating anything', () => {
    expect(decideCreate(frontdesk, {})).toEqual({ ok: false, status: 403, error: 'forbidden' });
  });

  it('refuses an unauthenticated caller', () => {
    expect(decideCreate(null, valid)).toMatchObject({ status: 401 });
  });

  it.each([
    [{ ...valid, email: 'not-an-email' }, 'invalid_email'],
    [{ ...valid, password: 'short' }, 'weak_password'],
    [{ ...valid, password: 'x'.repeat(73) }, 'weak_password'],
    [{ ...valid, fullName: '   ' }, 'invalid_name'],
    [{ ...valid, role: 'owner' }, 'invalid_role'],
  ])('rejects %o as %s', (body, error) => {
    expect(decideCreate(superadmin, body)).toMatchObject({ ok: false, status: 400, error });
  });
});

describe('decideDelete', () => {
  it('lets an admin remove a front desk account', () => {
    expect(decideDelete(admin, target, 'frontdesk')).toEqual({ ok: true, value: target });
  });

  it('refuses an admin removing another admin or a super admin', () => {
    expect(decideDelete(admin, target, 'admin')).toMatchObject({ status: 403 });
    expect(decideDelete(admin, target, 'superadmin')).toMatchObject({ status: 403 });
  });

  it('lets a super admin remove an admin', () => {
    expect(decideDelete(superadmin, target, 'admin').ok).toBe(true);
  });

  it('refuses removing your own account', () => {
    expect(decideDelete(superadmin, superadmin.id, 'superadmin')).toMatchObject({
      error: 'cannot_remove_self',
    });
  });

  it('leaves accounts with no profile to a super admin', () => {
    expect(decideDelete(superadmin, target, null).ok).toBe(true);
    expect(decideDelete(admin, target, null)).toMatchObject({ status: 403 });
  });

  it('rejects an id that is not a uuid', () => {
    expect(decideDelete(superadmin, "1' or '1'='1", 'frontdesk')).toMatchObject({
      error: 'invalid_id',
    });
  });
});
