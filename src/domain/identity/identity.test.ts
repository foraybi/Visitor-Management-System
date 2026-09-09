import { describe, expect, it } from 'vitest';
import {
  IDENTITY_TYPES,
  identityLabelKey,
  identityPlaceholder,
  parseIdentityNumber,
} from './identity';

describe('parseIdentityNumber', () => {
  describe('national id', () => {
    it('accepts ten digits beginning with 1', () => {
      expect(parseIdentityNumber('national_id', '1234567890')).toEqual({
        ok: true,
        value: '1234567890',
      });
    });

    it('rejects a leading digit other than 1', () => {
      expect(parseIdentityNumber('national_id', '2234567890')).toEqual({
        ok: false,
        reason: 'national_id_format',
      });
    });

    it.each(['123456789', '12345678901'])('rejects the wrong length: %s', (value) => {
      expect(parseIdentityNumber('national_id', value)).toEqual({
        ok: false,
        reason: 'national_id_format',
      });
    });
  });

  describe('iqama', () => {
    it('accepts ten digits beginning with 2', () => {
      expect(parseIdentityNumber('iqama', '2345678901')).toEqual({
        ok: true,
        value: '2345678901',
      });
    });

    it('accepts a leading 0', () => {
      expect(parseIdentityNumber('iqama', '0345678901').ok).toBe(true);
    });

    it('rejects a leading 1, which is a national id', () => {
      expect(parseIdentityNumber('iqama', '1345678901')).toEqual({
        ok: false,
        reason: 'iqama_format',
      });
    });
  });

  describe('passport', () => {
    it('accepts alphanumerics of at least five characters', () => {
      expect(parseIdentityNumber('passport', 'A1234567')).toEqual({
        ok: true,
        value: 'A1234567',
      });
    });

    it('rejects anything shorter than five characters', () => {
      expect(parseIdentityNumber('passport', 'A123')).toEqual({
        ok: false,
        reason: 'passport_too_short',
      });
    });

    it('rejects punctuation that is not a separator', () => {
      expect(parseIdentityNumber('passport', 'A123.456')).toEqual({
        ok: false,
        reason: 'passport_format',
      });
    });

    // Separators are stripped before validation for every identity type, so a
    // passport typed with spacing normalises rather than being refused. Passport
    // numbers never contain a hyphen or a space, so nothing distinct is merged.
    it('normalises a passport typed with separators', () => {
      expect(parseIdentityNumber('passport', 'A123-456')).toEqual({
        ok: true,
        value: 'A123456',
      });
    });

    // This is the regression the module exists to prevent. The employee branch
    // of the check-in form validated every identity number as digits-only, so a
    // passport-holding employee could not check in at all.
    it('accepts a passport regardless of which flow is asking', () => {
      expect(parseIdentityNumber('passport', 'X99881').ok).toBe(true);
    });
  });

  describe('normalisation', () => {
    it('trims surrounding whitespace', () => {
      expect(parseIdentityNumber('national_id', '  1234567890  ')).toEqual({
        ok: true,
        value: '1234567890',
      });
    });

    // An Arabic keyboard on the tablet produces Arabic-Indic digits. Without
    // this the visitor sees a format error on a number they typed correctly.
    it('converts Arabic-Indic digits to ASCII', () => {
      expect(parseIdentityNumber('national_id', '١٢٣٤٥٦٧٨٩٠')).toEqual({
        ok: true,
        value: '1234567890',
      });
    });

    it('converts Eastern Arabic-Indic digits to ASCII', () => {
      expect(parseIdentityNumber('iqama', '۲۳۴۵۶۷۸۹۰۱')).toEqual({
        ok: true,
        value: '2345678901',
      });
    });

    it('strips separators a visitor may type out of habit', () => {
      expect(parseIdentityNumber('national_id', '1234 567-890')).toEqual({
        ok: true,
        value: '1234567890',
      });
    });
  });

  describe('empty input', () => {
    it.each(['', '   '])('reports %p as required rather than malformed', (value) => {
      expect(parseIdentityNumber('passport', value)).toEqual({
        ok: false,
        reason: 'required',
      });
    });
  });

  describe('unknown type', () => {
    it('refuses a type it does not recognise instead of passing it through', () => {
      // @ts-expect-error deliberately outside the union, as untrusted input is
      expect(parseIdentityNumber('drivers_licence', '1234567890')).toEqual({
        ok: false,
        reason: 'unknown_type',
      });
    });
  });
});

describe('presentation helpers', () => {
  it('lists the three supported types in display order', () => {
    expect(IDENTITY_TYPES).toEqual(['national_id', 'iqama', 'passport']);
  });

  it('returns an i18n key rather than a translated string', () => {
    // Three components previously hardcoded the Arabic labels inline, which put
    // them beyond the reach of the locale files.
    for (const type of IDENTITY_TYPES) {
      expect(identityLabelKey(type)).toMatch(/^visitor\.identity\./);
    }
  });

  it('gives each type a distinct placeholder', () => {
    const placeholders = IDENTITY_TYPES.map(identityPlaceholder);
    expect(new Set(placeholders).size).toBe(IDENTITY_TYPES.length);
  });
});
