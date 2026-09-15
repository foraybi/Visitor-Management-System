import { describe, expect, it } from 'vitest';
import {
  buildImportCandidates,
  normalizeCrNumber,
  normalizePhone,
  parseCount,
  repairMojibake,
  type SpreadsheetRow,
} from './importCompanies';

function row(over: Record<string, string> = {}): SpreadsheetRow {
  return {
    uuid: 'ref-1',
    company_name_ar: 'شركة تجربة',
    company_name_en: 'Test Company',
    cr_number: '7017401162',
    number_of_founding_team: '2',
    number_of_employees: '3',
    name: 'سعود الغامدي',
    name_en: 'Saud Alghamdi',
    mobile: ' +966544555171',
    mail: 'saud@example.com',
    id_type_selector: 'هوية وطنية',
    national_id_number: '1079132013',
    residency_number: '',
    passport_number: '',
    gender: '1',
    registration_status: 'approved',
    ...over,
  };
}

describe('reading the export values', () => {
  it('reads zero-padded counts and rejects negatives and blanks', () => {
    expect(parseCount('001')).toBe(1);
    expect(parseCount('00011')).toBe(11);
    expect(parseCount(' -2')).toBeNull();
    expect(parseCount('')).toBeNull();
  });

  it('writes Saudi mobiles in the local form and keeps foreign numbers', () => {
    expect(normalizePhone(' +966544555171')).toBe('0544555171');
    expect(normalizePhone(' +966 54 115 5254')).toBe('0541155254');
    expect(normalizePhone('0596654466')).toBe('0596654466');
    expect(normalizePhone(' +20 100 480 0697')).toBe('+201004800697');
  });

  it('keeps a CR number only when it is one', () => {
    expect(normalizeCrNumber('7017401162')).toBe('7017401162');
    expect(normalizeCrNumber(' -4')).toBeNull();
    expect(normalizeCrNumber('0')).toBeNull();
  });

  it('repairs Arabic that was decoded as Windows-1252, and leaves real text alone', () => {
    const garbled = new TextDecoder('windows-1252').decode(new TextEncoder().encode('شركة ذر'));
    expect(repairMojibake(garbled)).toBe('شركة ذر');
    expect(repairMojibake('شركة ذر')).toBe('شركة ذر');
    expect(repairMojibake('Wise')).toBe('Wise');
  });
});

describe('building import candidates', () => {
  it('maps the company, the founder and both limits', () => {
    const [c] = buildImportCandidates([row()]);

    expect(c).toMatchObject({
      importRef: 'ref-1',
      name: 'Test Company',
      nameAr: 'شركة تجربة',
      crNumber: '7017401162',
      foundersLimit: 2,
      employeesLimit: 3,
      phone: '0544555171',
      selectedByDefault: true,
      issues: [],
    });
    expect(c.founder).toEqual({
      name: 'Saud Alghamdi',
      nameAr: 'سعود الغامدي',
      phone: '0544555171',
      email: 'saud@example.com',
      nationalityType: 'national_id',
      nationalityIdNumber: '1079132013',
      countryCode: 'SA',
      gender: 'male',
    });
  });

  it('reads an iqama from the residency column', () => {
    const [c] = buildImportCandidates([
      row({ id_type_selector: 'رقم الإقامة', national_id_number: '', residency_number: '2195327370' }),
    ]);
    expect(c.founder?.nationalityType).toBe('iqama');
    expect(c.founder?.nationalityIdNumber).toBe('2195327370');
    expect(c.founder?.countryCode).toBe('');
  });

  // A resident's iqama typed under "national ID" is a real row in the export.
  it('reclassifies a number filed under the wrong ID type and says so', () => {
    const [c] = buildImportCandidates([row({ national_id_number: '2410975326' })]);
    expect(c.founder?.nationalityType).toBe('iqama');
    expect(c.issues).toContain('identity_type_corrected');
  });

  it('imports the company without a founder when the ID fits no type', () => {
    const [c] = buildImportCandidates([row({ national_id_number: '12' })]);
    expect(c.founder).toBeNull();
    expect(c.issues).toContain('invalid_identity');
  });

  it('leaves room for the applicant even when the founding team is blank', () => {
    const [c] = buildImportCandidates([row({ number_of_founding_team: '', number_of_employees: '' })]);
    expect(c.foundersLimit).toBe(1);
    expect(c.employeesLimit).toBe(0);
    expect(c.issues).toContain('missing_counts');
  });

  it('does not invent a gender', () => {
    const [c] = buildImportCandidates([row({ gender: '' })]);
    expect(c.founder?.gender).toBeNull();
  });

  it('selects only approved rows by default', () => {
    const [registered, rejected] = buildImportCandidates([
      row({ uuid: 'a', registration_status: 'registered' }),
      row({ uuid: 'b', cr_number: '7000000001', company_name_en: 'Other', registration_status: 'rejected' }),
    ]);
    expect(registered.selectedByDefault).toBe(false);
    expect(rejected.selectedByDefault).toBe(false);
  });

  it('marks a later row for the same CR as a duplicate', () => {
    const [first, second] = buildImportCandidates([row({ uuid: 'a' }), row({ uuid: 'b' })]);
    expect(first.issues).not.toContain('duplicate_in_file');
    expect(second.issues).toContain('duplicate_in_file');
    expect(second.selectedByDefault).toBe(false);
  });

  it('marks a company that already exists', () => {
    const [byRef] = buildImportCandidates([row()], [{ name: 'x', nameAr: 'y', importRef: 'ref-1' }]);
    const [byName] = buildImportCandidates([row({ cr_number: '' })], [{ name: 'test company', nameAr: 'z' }]);
    expect(byRef.issues).toContain('already_exists');
    expect(byName.issues).toContain('already_exists');
    expect(byName.selectedByDefault).toBe(false);
  });

  it('cannot import a row with no company name', () => {
    const [c] = buildImportCandidates([row({ company_name_ar: '', company_name_en: '' })]);
    expect(c.issues).toContain('missing_company_name');
    expect(c.selectedByDefault).toBe(false);
  });
});
