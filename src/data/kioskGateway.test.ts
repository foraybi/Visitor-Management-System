import { describe, expect, it, vi } from 'vitest';
import { inMemoryKioskGateway } from './inMemoryKioskGateway';
import { httpKioskGateway, type CheckInRequest } from './kioskGateway';

function checkIn(over: Partial<CheckInRequest> = {}): CheckInRequest {
  return {
    visitorType: 'visitor',
    name: 'Sara',
    phone: '0512345678',
    nationalityType: 'national_id',
    nationalityIdNumber: '1234567890',
    countryCode: 'SA',
    countryName: 'Saudi Arabia',
    visitedCompanyId: 'company-1',
    floor: 3,
    signatureDataUrl: '',
    ...over,
  };
}

describe('the kiosk gateway contract', () => {
  describe('check-in', () => {
    it('returns a visit code on success', async () => {
      const gateway = inMemoryKioskGateway();
      const result = await gateway.checkIn(checkIn());

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.visitCode).toBe('0001');
    });

    it('numbers visits sequentially within a day', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(checkIn());
      const second = await gateway.checkIn(checkIn({ name: 'Omar' }));

      expect(second.ok && second.value.visitCode).toBe('0002');
    });

    // The regression this whole redesign exists for. The old browser-side
    // generator restarted at 0001 each morning against a TEXT PRIMARY KEY, the
    // insert collided, the error was swallowed, and the visitor was handed an id
    // card for a record that did not exist.
    it('records a visit on the second day rather than losing it', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(checkIn());

      gateway.nextDay();
      const tomorrow = await gateway.checkIn(checkIn({ name: 'Layla' }));

      expect(tomorrow.ok).toBe(true);
      expect(gateway.visits).toHaveLength(2);
    });

    it('rejects an unknown company instead of writing an orphan visit', async () => {
      const gateway = inMemoryKioskGateway();
      const result = await gateway.checkIn(checkIn({ visitedCompanyId: 'nope' }));

      expect(result).toEqual({ ok: false, error: 'unknown_company' });
      expect(gateway.visits).toHaveLength(0);
    });

    it('rejects a malformed identity number', async () => {
      const gateway = inMemoryKioskGateway();
      const result = await gateway.checkIn(checkIn({ nationalityIdNumber: '99' }));

      expect(result).toEqual({ ok: false, error: 'invalid_identity' });
      expect(gateway.visits).toHaveLength(0);
    });

    // The type makes this unmissable: there is no visitCode to read on the
    // failure branch, so no id card can be rendered from a failed check-in.
    it('reports a failed check-in as offline and records nothing', async () => {
      const gateway = inMemoryKioskGateway();
      gateway.goOffline();

      const result = await gateway.checkIn(checkIn());

      expect(result).toEqual({ ok: false, error: 'offline' });
      expect(gateway.visits).toHaveLength(0);
    });

    it('reports a revoked tablet distinctly from a network failure', async () => {
      const gateway = inMemoryKioskGateway();
      gateway.revokeDevice();

      expect(await gateway.checkIn(checkIn())).toEqual({
        ok: false,
        error: 'unauthorised_device',
      });
    });
  });

  describe('check-out', () => {
    it('closes an open visit and returns the name for the farewell screen', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(checkIn({ name: 'Sara' }));

      expect(await gateway.checkOut({ visitCode: '0001' })).toEqual({
        ok: true,
        value: { name: 'Sara' },
      });
    });

    it('accepts a code typed without leading zeros', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(checkIn());

      expect((await gateway.checkOut({ visitCode: '1' })).ok).toBe(true);
    });

    it('refuses to close the same visit twice', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(checkIn());
      await gateway.checkOut({ visitCode: '0001' });

      expect(await gateway.checkOut({ visitCode: '0001' })).toEqual({
        ok: false,
        error: 'no_active_visit',
      });
    });

    // Codes repeat across days, so a code must only ever close a visit opened
    // today. Otherwise yesterday's 0001 closes today's.
    it('will not close yesterday\'s visit with today\'s code', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(checkIn());
      gateway.nextDay();

      expect(await gateway.checkOut({ visitCode: '0001' })).toEqual({
        ok: false,
        error: 'no_active_visit',
      });
    });
  });

  // Employees are never shown a visit code, so without this they had no way to
  // check out at the tablet and their attendance never got an exit time.
  describe('employee check-out by identity number', () => {
    const employeeVisit = () =>
      checkIn({ visitorType: 'employee', name: 'Noura', nationalityIdNumber: '1029384756' });

    it('closes today\'s open employee visit', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(employeeVisit());

      expect(
        await gateway.checkOut({ idType: 'national_id', idNumber: '1029384756' }),
      ).toEqual({ ok: true, value: { name: 'Noura' } });
      expect(gateway.visits[0].open).toBe(false);
    });

    it('matches Arabic-Indic digits typed on the tablet keyboard', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(employeeVisit());

      expect(
        (await gateway.checkOut({ idType: 'national_id', idNumber: '١٠٢٩٣٨٤٧٥٦' })).ok,
      ).toBe(true);
    });

    // A visitor's identity number must not close their visit: only the code on
    // their card does, so someone who overhears an ID cannot check them out.
    it('will not close a visitor\'s visit by identity number', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(checkIn({ nationalityIdNumber: '1029384756' }));

      expect(
        await gateway.checkOut({ idType: 'national_id', idNumber: '1029384756' }),
      ).toEqual({ ok: false, error: 'no_active_visit' });
    });

    it('will not close yesterday\'s visit', async () => {
      const gateway = inMemoryKioskGateway();
      await gateway.checkIn(employeeVisit());
      gateway.nextDay();

      expect(
        await gateway.checkOut({ idType: 'national_id', idNumber: '1029384756' }),
      ).toEqual({ ok: false, error: 'no_active_visit' });
    });

    it('rejects a malformed identity number', async () => {
      const gateway = inMemoryKioskGateway();

      expect(await gateway.checkOut({ idType: 'national_id', idNumber: '99' })).toEqual({
        ok: false,
        error: 'invalid_identity',
      });
    });
  });

  describe('employee lookup', () => {
    const employee = {
      idNumber: '1029384756',
      match: {
        name: 'Noura',
        nameAr: 'نورة',
        employeeNumber: '0007',
        company: { id: 'company-1', name: 'Acme', nameAr: 'أكمي', floor: 3 },
      },
    };

    it('finds an active employee by identity number', async () => {
      const gateway = inMemoryKioskGateway({ employees: [employee] });
      const result = await gateway.lookupEmployee('national_id', '1029384756');

      expect(result.ok && result.value?.name).toBe('Noura');
    });

    it('normalises the identity number before matching', async () => {
      const gateway = inMemoryKioskGateway({ employees: [employee] });

      // Arabic-Indic digits, which the tablet's Arabic keyboard produces.
      const result = await gateway.lookupEmployee('national_id', '١٠٢٩٣٨٤٧٥٦');
      expect(result.ok && result.value?.name).toBe('Noura');
    });

    it('returns null rather than an error for someone who is not an employee', async () => {
      const gateway = inMemoryKioskGateway({ employees: [employee] });

      expect(await gateway.lookupEmployee('national_id', '1111111111')).toEqual({
        ok: true,
        value: null,
      });
    });
  });
});

describe('the http adapter', () => {
  const token = () => 'a'.repeat(40);

  it('sends the device token and no other credential', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ companies: [], floors: [] }), { status: 200 }),
    );
    const gateway = httpKioskGateway({ token, fetchImpl: fetchImpl as unknown as typeof fetch });

    await gateway.directory();

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/kiosk/directory');

    const headers = init.headers as Record<string, string>;
    expect(headers['x-kiosk-token']).toBe('a'.repeat(40));
    // Nothing resembling a database credential may leave the tablet.
    expect(JSON.stringify(headers)).not.toMatch(/apikey|authorization|supabase/i);
  });

  it('sends an employee check-out as identity type and number', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ name: 'Noura' }), { status: 200 }));
    const gateway = httpKioskGateway({ token, fetchImpl: fetchImpl as unknown as typeof fetch });

    await gateway.checkOut({ idType: 'iqama', idNumber: '2000000002' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/kiosk/check-out');
    expect(JSON.parse(init.body as string)).toEqual({ idType: 'iqama', idNumber: '2000000002' });
  });

  it('refuses to call at all when the tablet has no token', async () => {
    const fetchImpl = vi.fn();
    const gateway = httpKioskGateway({
      token: () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await gateway.directory()).toEqual({ ok: false, error: 'unauthorised_device' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a network failure to offline rather than throwing', async () => {
    const gateway = httpKioskGateway({
      token,
      fetchImpl: (() => Promise.reject(new Error('network down'))) as unknown as typeof fetch,
    });

    expect(await gateway.checkIn(checkIn())).toEqual({ ok: false, error: 'offline' });
  });

  it.each([
    [401, 'unauthorised_device'],
    [429, 'rate_limited'],
    [500, 'server_error'],
  ])('maps HTTP %i to %s', async (status, expected) => {
    const gateway = httpKioskGateway({
      token,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: expected }), { status })) as unknown as typeof fetch,
    });

    expect(await gateway.checkIn(checkIn())).toEqual({ ok: false, error: expected });
  });

  it('maps an unrecognised error name to server_error rather than trusting it', async () => {
    const gateway = httpKioskGateway({
      token,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: 'something_new' }), {
          status: 400,
        })) as unknown as typeof fetch,
    });

    expect(await gateway.checkIn(checkIn())).toEqual({ ok: false, error: 'server_error' });
  });
});
