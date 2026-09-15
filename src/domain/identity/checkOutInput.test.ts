import { describe, expect, it } from 'vitest';
import { normalisePhone, parseCheckOutInput } from './identity';

describe('normalisePhone', () => {
  it('keeps a local mobile number', () => {
    expect(normalisePhone('0551234567')).toBe('0551234567');
  });

  it('converts the international forms to the stored local form', () => {
    expect(normalisePhone('+966551234567')).toBe('0551234567');
    expect(normalisePhone('00966551234567')).toBe('0551234567');
    expect(normalisePhone('966551234567')).toBe('0551234567');
  });

  it('accepts spaces, dashes and Arabic-Indic digits', () => {
    expect(normalisePhone('055 123-4567')).toBe('0551234567');
    expect(normalisePhone('٠٥٥١٢٣٤٥٦٧')).toBe('0551234567');
  });

  it('refuses anything that is not a Saudi mobile number', () => {
    expect(normalisePhone('1029384756')).toBeNull();
    expect(normalisePhone('0112345678')).toBeNull();
    expect(normalisePhone('055123')).toBeNull();
  });
});

describe('parseCheckOutInput', () => {
  it('reads a mobile number as a phone', () => {
    expect(parseCheckOutInput('0551234567')).toEqual({
      ok: true,
      value: { kind: 'phone', phone: '0551234567' },
    });
  });

  it('reads a national ID, an iqama and a passport as identities', () => {
    expect(parseCheckOutInput('1029384756')).toEqual({
      ok: true,
      value: { kind: 'identity', idType: 'national_id', idNumber: '1029384756' },
    });
    expect(parseCheckOutInput('2345678901')).toEqual({
      ok: true,
      value: { kind: 'identity', idType: 'iqama', idNumber: '2345678901' },
    });
    expect(parseCheckOutInput('A1234567')).toEqual({
      ok: true,
      value: { kind: 'identity', idType: 'passport', idNumber: 'A1234567' },
    });
  });

  it('reports an empty field as required and junk as invalid', () => {
    expect(parseCheckOutInput('  ')).toEqual({ ok: false, reason: 'required' });
    expect(parseCheckOutInput('12-34')).toEqual({ ok: false, reason: 'invalid' });
  });
});
