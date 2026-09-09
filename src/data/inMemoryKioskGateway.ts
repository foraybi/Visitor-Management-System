import { parseIdentityNumber } from '../domain/identity/identity';
import type {
  CheckInRequest,
  CheckInSuccess,
  Directory,
  EmployeeMatch,
  KioskGateway,
  KioskResult,
} from './kioskGateway';

/**
 * The second adapter at the kiosk seam.
 *
 * One adapter is a hypothetical seam; two make it a real one. This exists so the
 * check-in flow can be tested without a network, a database, or a device token,
 * and so failure modes that are hard to provoke against a real server, an
 * offline tablet or a revoked device, can be asserted directly.
 */

export interface InMemoryOptions {
  companies?: Directory['companies'];
  floors?: Directory['floors'];
  employees?: Array<{ idNumber: string; match: EmployeeMatch }>;
}

export interface InMemoryKioskGateway extends KioskGateway {
  /** Visits recorded so far, in the order they were created. */
  readonly visits: ReadonlyArray<CheckInRequest & CheckInSuccess & { open: boolean }>;
  /** Make every subsequent call behave as if the tablet had no network. */
  goOffline(): void;
  goOnline(): void;
  /** Make every subsequent call behave as if this device had been revoked. */
  revokeDevice(): void;
  /** Advance to the next day, which resets visit code allocation. */
  nextDay(): void;
}

const DEFAULT_COMPANY: Directory['companies'][number] = {
  id: 'company-1',
  name: 'Acme',
  nameAr: 'أكمي',
  floor: 3,
};

export function inMemoryKioskGateway(options: InMemoryOptions = {}): InMemoryKioskGateway {
  const companies = options.companies ?? [DEFAULT_COMPANY];
  const floors = options.floors ?? [
    { number: 3, name: 'Third', nameAr: 'الثالث', imageUrl: '' },
  ];
  const employees = new Map(options.employees?.map((e) => [e.idNumber, e.match]));

  const visits: Array<CheckInRequest & CheckInSuccess & { open: boolean; day: number }> = [];
  let offline = false;
  let revoked = false;
  let day = 0;

  function guard<T>(): KioskResult<T> | null {
    if (offline) return { ok: false, error: 'offline' };
    if (revoked) return { ok: false, error: 'unauthorised_device' };
    return null;
  }

  /** Mirrors the server: a per-day counter, so codes repeat across days only. */
  function allocateCode(): string {
    const today = visits.filter((v) => v.day === day).length + 1;
    return String(today).padStart(4, '0');
  }

  return {
    get visits() {
      return visits;
    },

    goOffline() {
      offline = true;
    },
    goOnline() {
      offline = false;
    },
    revokeDevice() {
      revoked = true;
    },
    nextDay() {
      day += 1;
    },

    async directory() {
      return guard<Directory>() ?? { ok: true, value: { companies, floors } };
    },

    async lookupEmployee(idType, idNumber) {
      const blocked = guard<EmployeeMatch | null>();
      if (blocked) return blocked;

      const parsed = parseIdentityNumber(idType, idNumber);
      if (!parsed.ok) return { ok: false, error: 'invalid_identity' };

      return { ok: true, value: employees.get(parsed.value) ?? null };
    },

    async checkIn(request) {
      const blocked = guard<CheckInSuccess>();
      if (blocked) return blocked;

      const parsed = parseIdentityNumber(request.nationalityType, request.nationalityIdNumber);
      if (!parsed.ok) return { ok: false, error: 'invalid_identity' };

      const company = companies.find((c) => c.id === request.visitedCompanyId);
      if (!company) return { ok: false, error: 'unknown_company' };

      const value: CheckInSuccess = { visitCode: allocateCode(), floor: company.floor };
      visits.push({ ...request, ...value, open: true, day });
      return { ok: true, value };
    },

    async checkOut(visitCode) {
      const blocked = guard<{ name: string }>();
      if (blocked) return blocked;

      const code = visitCode.trim().padStart(4, '0');
      const visit = visits.find((v) => v.visitCode === code && v.day === day && v.open);
      if (!visit) return { ok: false, error: 'no_active_visit' };

      visit.open = false;
      return { ok: true, value: { name: visit.name } };
    },
  };
}
