import { describe, expect, it } from 'vitest';
import { inferIdentityType, parseIdentityNumber } from './identity';

// Employees type one number at the kiosk, with no type picker. Before this the
// lookup was sent without a type and every employee check-in was refused.
describe('inferring the identity type from the number', () => {
  it('reads ten digits starting with 1 as a national id', () => {
    expect(inferIdentityType('1029384756')).toBe('national_id');
  });

  it('reads ten digits not starting with 1 as an iqama', () => {
    expect(inferIdentityType('2000000002')).toBe('iqama');
  });

  it('reads anything else as a passport', () => {
    expect(inferIdentityType('X1234567')).toBe('passport');
  });

  it('normalises Arabic-Indic digits and separators first', () => {
    expect(inferIdentityType('١٠٢٩ ٣٨٤ ٧٥٦')).toBe('national_id');
  });

  it('produces a type the number then validates against', () => {
    for (const number of ['1029384756', '2000000002', 'X1234567', '١٠٢٩٣٨٤٧٥٦']) {
      expect(parseIdentityNumber(inferIdentityType(number), number).ok).toBe(true);
    }
  });

  it('still rejects a number too short to be anything', () => {
    expect(parseIdentityNumber(inferIdentityType('12'), '12').ok).toBe(false);
  });
});
