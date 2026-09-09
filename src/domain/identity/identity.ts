/**
 * Saudi identity numbers: national id, iqama, passport.
 *
 * These rules previously existed in five places that had already drifted apart.
 * One copy validated every identity number as digits-only, which meant a
 * passport-holding employee could not check in at all. They live here now
 * because both the browser and the kiosk API need them, and a sixth copy on the
 * server would be exactly the wrong outcome.
 */

export type IdentityType = 'national_id' | 'iqama' | 'passport';

export type IdentityError =
  | 'required'
  | 'national_id_format'
  | 'iqama_format'
  | 'passport_format'
  | 'passport_too_short'
  | 'unknown_type';

export type IdentityResult =
  | { ok: true; value: string }
  | { ok: false; reason: IdentityError };

export const IDENTITY_TYPES: readonly IdentityType[] = [
  'national_id',
  'iqama',
  'passport',
] as const;

const NATIONAL_ID = /^1\d{9}$/;
const IQAMA = /^[02-9]\d{9}$/;
const PASSPORT = /^[A-Za-z0-9]+$/;
const PASSPORT_MIN_LENGTH = 5;

/** Separators a visitor may type out of habit, and which carry no meaning. */
const SEPARATORS = /[\s-]/g;

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;

/**
 * Fold Arabic-Indic and Eastern Arabic-Indic digits onto ASCII.
 *
 * The tablet defaults to an Arabic keyboard, so a visitor entering their own
 * national id may well produce ١٢٣ rather than 123. Rejecting that as a format
 * error blames the visitor for the keyboard.
 */
function toAsciiDigits(input: string): string {
  let out = '';
  for (const char of input) {
    const code = char.codePointAt(0)!;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= EASTERN_ARABIC_INDIC_ZERO && code <= EASTERN_ARABIC_INDIC_ZERO + 9) {
      out += String(code - EASTERN_ARABIC_INDIC_ZERO);
    } else {
      out += char;
    }
  }
  return out;
}

function normalise(raw: string): string {
  return toAsciiDigits(raw).replace(SEPARATORS, '').trim();
}

/**
 * Validate and normalise one identity number.
 *
 * Returns the cleaned value on success so callers store the normalised form
 * rather than whatever was typed. Two visitors entering the same identity with
 * different spacing must produce the same stored value, because that value is
 * how the system recognises a returning employee.
 */
export function parseIdentityNumber(type: IdentityType, raw: string): IdentityResult {
  if (!IDENTITY_TYPES.includes(type)) {
    return { ok: false, reason: 'unknown_type' };
  }

  const value = normalise(raw ?? '');
  if (value.length === 0) {
    return { ok: false, reason: 'required' };
  }

  switch (type) {
    case 'national_id':
      return NATIONAL_ID.test(value)
        ? { ok: true, value }
        : { ok: false, reason: 'national_id_format' };

    case 'iqama':
      return IQAMA.test(value) ? { ok: true, value } : { ok: false, reason: 'iqama_format' };

    case 'passport':
      if (!PASSPORT.test(value)) {
        return { ok: false, reason: 'passport_format' };
      }
      return value.length >= PASSPORT_MIN_LENGTH
        ? { ok: true, value }
        : { ok: false, reason: 'passport_too_short' };
  }
}

/**
 * The i18n key for a type's label.
 *
 * Returns a key rather than a string on purpose. Three components used to
 * hardcode the Arabic labels inline, which put them beyond the reach of the
 * locale files and meant an English-mode visitor saw Arabic.
 */
export function identityLabelKey(type: IdentityType): string {
  return `visitor.identity.${type}`;
}

/** The i18n key for the message explaining a rejection. */
export function identityErrorKey(reason: IdentityError): string {
  return `visitor.identity.errors.${reason}`;
}

export function identityPlaceholder(type: IdentityType): string {
  switch (type) {
    case 'national_id':
      return '1XXXXXXXXX';
    case 'iqama':
      return '2XXXXXXXXX';
    case 'passport':
      return 'A1234567';
  }
}
