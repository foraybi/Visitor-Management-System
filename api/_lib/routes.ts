import type { Handler } from './http';
import { handleCheckIn } from '../kiosk/check-in';
import { handleCheckOut } from '../kiosk/check-out';
import { handleDirectory } from '../kiosk/directory';
import { handleLookupEmployee } from '../kiosk/lookup-employee';
import { createAccount, deleteAccount } from '../staff/accounts';

/**
 * Every API route, for hosts that do not route by file name.
 *
 * Vercel maps api/kiosk/check-in.ts to /api/kiosk/check-in by itself. The
 * self-hosted server in server/index.ts has no such convention, so it reads this
 * table. Both call the very same handler functions, so a route cannot behave
 * differently depending on where the app is hosted.
 */

export type Method = 'GET' | 'POST' | 'DELETE';

export const routes: Readonly<Record<string, Partial<Record<Method, Handler>>>> = {
  '/api/kiosk/directory': { GET: handleDirectory },
  '/api/kiosk/lookup-employee': { POST: handleLookupEmployee },
  '/api/kiosk/check-in': { POST: handleCheckIn },
  '/api/kiosk/check-out': { POST: handleCheckOut },
  '/api/staff/accounts': { POST: createAccount, DELETE: deleteAccount },
};
