import { describe, expect, it, vi } from 'vitest';
import { consumeProvisioningLink, extractDeviceToken } from './deviceProvisioning';

const TOKEN = 'a3f9'.repeat(16);

describe('extractDeviceToken', () => {
  it('reads the token from the fragment', () => {
    expect(extractDeviceToken(`#device-token=${TOKEN}`)).toBe(TOKEN);
  });

  it('ignores other fragment parameters', () => {
    expect(extractDeviceToken(`#lang=ar&device-token=${TOKEN}`)).toBe(TOKEN);
  });

  it.each(['', '#', '#device-token=', '#device-token=short', `#device-token=${'x'.repeat(40)}!`])(
    'rejects %p',
    (hash) => {
      expect(extractDeviceToken(hash)).toBeNull();
    },
  );
});

describe('consumeProvisioningLink', () => {
  it('stores the token and strips it from the address bar', () => {
    const replaceState = vi.fn();
    const stored = consumeProvisioningLink(
      { hash: `#device-token=${TOKEN}`, pathname: '/', search: '' },
      { replaceState },
    );

    expect(stored).toBe(true);
    expect(localStorage.getItem('vms-kiosk-token:v1')).toBe(TOKEN);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  // A mistyped or truncated link must not leave a partial token visible.
  it('strips a malformed token without storing it', () => {
    localStorage.clear();
    const replaceState = vi.fn();

    expect(
      consumeProvisioningLink({ hash: '#device-token=oops', pathname: '/', search: '?x=1' }, { replaceState }),
    ).toBe(false);
    expect(localStorage.getItem('vms-kiosk-token:v1')).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?x=1');
  });

  it('does nothing when the address carries no token', () => {
    const replaceState = vi.fn();
    expect(consumeProvisioningLink({ hash: '', pathname: '/', search: '' }, { replaceState })).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });
});
