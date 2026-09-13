import { writeDeviceToken } from '../../data/kioskGateway';

/**
 * Register a tablet by opening a link.
 *
 * Provisioning used to mean opening the browser console on the tablet and
 * pasting a localStorage command. An Android tablet has no console unless it is
 * plugged into a computer with USB debugging on, so that step could not be done
 * in a lobby. The provisioning script now prints a link instead:
 *
 *   https://kiosk.example.com/#device-token=<token>
 *
 * The token travels in the URL fragment, not the query string. A fragment is
 * never sent to the server, so the token does not land in access logs, proxy
 * logs or analytics. It is removed from the address bar as soon as it is read,
 * so it is not left in the history or in a bookmark of the installed app.
 */

const PARAM = 'device-token';
/** The provisioning script issues 64 hex characters. */
const MIN_TOKEN_LENGTH = 32;

/** The token in a location fragment, or null if absent or malformed. */
export function extractDeviceToken(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get(PARAM)?.trim() ?? '';
  return token.length >= MIN_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

/**
 * Store a token from the current address and strip it from the address bar.
 * Returns true when a token was stored.
 */
export function consumeProvisioningLink(
  location: Pick<Location, 'hash' | 'pathname' | 'search'> = window.location,
  history: Pick<History, 'replaceState'> = window.history,
): boolean {
  if (!location.hash.includes(PARAM)) return false;

  const token = extractDeviceToken(location.hash);
  // Strip the fragment whether or not the token was valid, so a mistyped link
  // does not linger in the address bar either.
  history.replaceState(null, '', `${location.pathname}${location.search}`);

  if (!token) return false;
  writeDeviceToken(token);
  return true;
}
