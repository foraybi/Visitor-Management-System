/**
 * Everything the tablet is allowed to know, behind four operations.
 *
 * This is the seam between the kiosk and the rest of the system. Behind it sits
 * the whole question of what a lobby tablet may see: the answer is a company
 * picker, one employee's display name, and the outcome of its own check-in. It
 * holds no database credentials and cannot read the visitor log.
 *
 * Two adapters, which is what makes this a real seam rather than indirection:
 * `httpKioskGateway` for production and `inMemoryKioskGateway` for tests.
 *
 * Every operation returns a result rather than throwing. A check-in that failed
 * cannot be mistaken for one that succeeded, because there is no visit code to
 * read on the failure branch. The previous code fired the insert, logged any
 * error to a console nobody was watching, and showed the visitor an id card
 * regardless.
 */

import type { IdentityType } from '../domain/identity/identity';

export interface DirectoryCompany {
  id: string;
  name: string;
  nameAr: string;
  floor: number;
}

export interface DirectoryFloor {
  number: number;
  name: string;
  nameAr: string;
  imageUrl: string;
}

/** Which check-in fields are shown. Null means show them all. */
export interface DirectoryFormField {
  key: string;
  visible: boolean;
  order?: number;
}

export interface Directory {
  companies: DirectoryCompany[];
  floors: DirectoryFloor[];
  formFields: DirectoryFormField[] | null;
}

export interface EmployeeMatch {
  name: string;
  nameAr: string;
  employeeNumber: string;
  company: { id: string; name: string; nameAr: string; floor: number } | null;
}

export interface CheckInRequest {
  visitorType: 'visitor' | 'employee';
  name: string;
  phone: string;
  email?: string;
  nationalityType: IdentityType;
  nationalityIdNumber: string;
  countryCode: string;
  countryName: string;
  visitedCompanyId: string;
  floor: number;
  signatureDataUrl: string;
}

export interface CheckInSuccess {
  visitCode: string;
  floor: number;
}

export type KioskError =
  /** The request never reached the server. Retrying may work. */
  | 'offline'
  /** This tablet's token is unknown or has been revoked. */
  | 'unauthorised_device'
  | 'rate_limited'
  | 'invalid_identity'
  | 'unknown_company'
  | 'no_active_visit'
  | 'server_error';

export type KioskResult<T> = { ok: true; value: T } | { ok: false; error: KioskError };

export interface KioskGateway {
  directory(): Promise<KioskResult<Directory>>;
  lookupEmployee(
    idType: IdentityType,
    idNumber: string,
  ): Promise<KioskResult<EmployeeMatch | null>>;
  checkIn(request: CheckInRequest): Promise<KioskResult<CheckInSuccess>>;
  checkOut(visitCode: string): Promise<KioskResult<{ name: string }>>;
}

// ── Device token ────────────────────────────────────────────────────────────

const TOKEN_KEY = 'vms-kiosk-token:v1';

/**
 * The tablet's device token, set once during provisioning.
 *
 * It is readable in the tablet's developer tools, and that is acceptable: it
 * authorises four narrow operations and reads nothing. What it buys is
 * revocation of one device without rotating a key shared by all of them.
 */
export function readDeviceToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing, or site data blocked.
    return null;
  }
}

export function writeDeviceToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Nothing useful to do; the next request will report unauthorised_device.
  }
}

// ── HTTP adapter ────────────────────────────────────────────────────────────

/** Maps the server's error vocabulary onto ours, defaulting to server_error. */
function errorFor(status: number, body: unknown): KioskError {
  const named = (body as { error?: unknown } | null)?.error;
  const known: readonly KioskError[] = [
    'unauthorised_device',
    'rate_limited',
    'invalid_identity',
    'unknown_company',
    'no_active_visit',
  ];
  if (typeof named === 'string' && (known as readonly string[]).includes(named)) {
    return named as KioskError;
  }
  if (status === 401) return 'unauthorised_device';
  if (status === 429) return 'rate_limited';
  return 'server_error';
}

export interface HttpGatewayOptions {
  baseUrl?: string;
  token?: () => string | null;
  fetchImpl?: typeof fetch;
  /** Give up rather than leaving a visitor watching a spinner indefinitely. */
  timeoutMs?: number;
}

export function httpKioskGateway(options: HttpGatewayOptions = {}): KioskGateway {
  const baseUrl = options.baseUrl ?? '/api/kiosk';
  const token = options.token ?? readDeviceToken;
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function call<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown },
  ): Promise<KioskResult<T>> {
    const deviceToken = token();
    if (!deviceToken) return { ok: false, error: 'unauthorised_device' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await doFetch(`${baseUrl}${path}`, {
        method: init.method,
        headers: {
          'content-type': 'application/json',
          'x-kiosk-token': deviceToken,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        return { ok: false, error: errorFor(response.status, payload) };
      }
      return { ok: true, value: payload as T };
    } catch {
      // A network failure, a timeout, or an aborted request. All mean the same
      // thing to a visitor: it did not go through, so do not pretend it did.
      return { ok: false, error: 'offline' };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    directory: () => call<Directory>('/directory', { method: 'GET' }),

    async lookupEmployee(idType, idNumber) {
      const result = await call<{ employee: EmployeeMatch | null }>('/lookup-employee', {
        method: 'POST',
        body: { idType, idNumber },
      });
      return result.ok ? { ok: true, value: result.value.employee } : result;
    },

    checkIn: (request) => call<CheckInSuccess>('/check-in', { method: 'POST', body: request }),

    checkOut: (visitCode) =>
      call<{ name: string }>('/check-out', { method: 'POST', body: { visitCode } }),
  };
}
