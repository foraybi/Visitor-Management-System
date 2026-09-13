/**
 * Web-standard request and response helpers for the API.
 *
 * Every handler is `(request: Request) => Promise<Response>`, the Fetch API
 * shape. That is what keeps the API portable: Vercel runs these files directly,
 * and server/index.ts runs the same handlers on any Node host, which is how the
 * app runs next to a self-hosted database. Nothing here is Vercel-specific.
 */

export type Handler = (request: Request) => Promise<Response>;

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** The request body as a JSON object, or null when absent or malformed. */
export async function readJson<T extends object = Record<string, unknown>>(
  request: Request,
): Promise<T | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as T)
      : null;
  } catch {
    return null;
  }
}

export type AppTarget = 'kiosk' | 'staff';

/**
 * Whether this deployment serves a given group of endpoints.
 *
 * Both deployments carry the whole api/ directory. Without this, the kiosk
 * endpoints would also answer on the staff origin and the account endpoints on
 * the kiosk origin. Neither would be exploitable, since each still requires its
 * own credential, but an endpoint that is not meant to exist somewhere should
 * not exist there. Unset means development, where everything is served.
 */
export function targetAllows(target: AppTarget): boolean {
  const configured = process.env.APP_TARGET ?? process.env.VITE_APP_TARGET;
  return !configured || configured === target;
}
