/**
 * Turn rows of the incubation registration export into companies to import.
 *
 * Pure on purpose: the admin import screen previews exactly what this returns,
 * and the tests pin down how the export's untidy values are read. It knows
 * nothing about files; `readSpreadsheet` turns a CSV or Excel file into rows.
 *
 * The export is typed by hand into a web form, so every value is suspect:
 * counts arrive as "001" or " -2", phones as " +966 55 000 0000", and an ID
 * number sometimes under the wrong ID type. Nothing here guesses silently. A
 * corrected or missing value is recorded as an issue the admin sees before
 * importing.
 */

import {
  inferIdentityType,
  parseIdentityNumber,
  type IdentityType,
} from '../identity/identity.js';

/** One row of the export, keyed by column name, every value a string. */
export type SpreadsheetRow = Readonly<Record<string, string>>;

export type ImportIssue =
  /** No Arabic or English company name. The row cannot be imported. */
  | 'missing_company_name'
  /** An earlier row describes the same company (same CR, or same name). */
  | 'duplicate_in_file'
  /** A company with this CR, name or import reference already exists. */
  | 'already_exists'
  /** No founder name; the company imports without a founder. */
  | 'missing_founder_name'
  /** No ID number in any of the three ID columns. */
  | 'missing_identity'
  /** The ID number fits no ID type; the founder is not imported. */
  | 'invalid_identity'
  /** The number was filed under the wrong ID type and was reclassified. */
  | 'identity_type_corrected'
  /** Founding team or employee count was blank or not a number. */
  | 'missing_counts';

/** Issues that stop a row from being selected by default. */
export const BLOCKING_ISSUES: ReadonlySet<ImportIssue> = new Set([
  'missing_company_name',
  'duplicate_in_file',
  'already_exists',
]);

export interface FounderDraft {
  name: string;
  nameAr: string;
  phone: string;
  email: string;
  nationalityType: IdentityType;
  nationalityIdNumber: string;
  countryCode: string;
  gender: 'male' | 'female' | null;
}

export interface ImportCandidate {
  /** Stable key for the preview table. */
  key: string;
  /** The submission's UUID, so importing the same file twice skips it. */
  importRef: string | null;
  /** registration_status: registered, approved or rejected. */
  status: string;
  name: string;
  nameAr: string;
  crNumber: string | null;
  foundersLimit: number;
  employeesLimit: number;
  /** The founder's phone, stored as the company phone. */
  phone: string;
  founder: FounderDraft | null;
  issues: ImportIssue[];
  selectedByDefault: boolean;
}

/** What is already stored, so a re-import is detected. */
export interface ExistingCompany {
  name: string;
  nameAr: string;
  crNumber?: string | null;
  importRef?: string | null;
}

function cell(row: SpreadsheetRow, column: string): string {
  return (row[column] ?? '').toString().trim();
}

/**
 * A head count, or null when the cell holds no usable number.
 *
 * "001" is 1 and "00011" is 11: the form has no numeric input. A negative
 * number is not a count, so it reads as missing rather than as zero.
 */
export function parseCount(raw: string): number | null {
  const value = (raw ?? '').replace(/\s+/g, '');
  if (!/^\d{1,6}$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

/**
 * A Saudi mobile number in the local 05XXXXXXXX form, or the digits as given
 * for anything else, with a leading + kept for international numbers.
 */
export function normalizePhone(raw: string): string {
  const compact = (raw ?? '').replace(/[^\d+]/g, '');
  const digits = compact.replace(/\D/g, '');
  if (/^9665\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^05\d{8}$/.test(digits)) return digits;
  if (/^5\d{8}$/.test(digits)) return `0${digits}`;
  return compact.startsWith('+') ? `+${digits}` : digits;
}

/** A commercial registration number: digits only, or null when there is none. */
export function normalizeCrNumber(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= 5 && digits.length <= 20 ? digits : null;
}

function declaredIdentity(row: SpreadsheetRow): { type: IdentityType | null; number: string } {
  const selector = cell(row, 'id_type_selector');
  const nationalId = cell(row, 'national_id_number');
  const residency = cell(row, 'residency_number');
  const passport = cell(row, 'passport_number');

  if (selector.includes('وطنية')) return { type: 'national_id', number: nationalId };
  if (selector.includes('إقامة') || selector.includes('اقامة')) return { type: 'iqama', number: residency };
  if (selector.includes('جواز')) return { type: 'passport', number: passport };

  // No selector: use whichever column was filled.
  if (nationalId) return { type: 'national_id', number: nationalId };
  if (residency) return { type: 'iqama', number: residency };
  if (passport) return { type: 'passport', number: passport };
  return { type: null, number: '' };
}

function companyKey(crNumber: string | null, name: string, nameAr: string): string {
  if (crNumber) return `cr:${crNumber}`;
  return `name:${(name || nameAr).trim().toLowerCase()}`;
}

/** Build the preview rows for an export. */
export function buildImportCandidates(
  rows: readonly SpreadsheetRow[],
  existing: readonly ExistingCompany[] = [],
): ImportCandidate[] {
  const existingRefs = new Set(existing.map((c) => c.importRef).filter(Boolean));
  const existingCrs = new Set(existing.map((c) => c.crNumber).filter(Boolean));
  const existingNames = new Set(
    existing.flatMap((c) => [c.name, c.nameAr]).map((n) => n.trim().toLowerCase()).filter(Boolean),
  );
  const seen = new Set<string>();

  return rows.map((row, index) => {
    const issues: ImportIssue[] = [];

    const nameAr = cell(row, 'company_name_ar');
    const nameEn = cell(row, 'company_name_en');
    const name = nameEn || nameAr;
    const companyNameAr = nameAr || nameEn;
    if (!name) issues.push('missing_company_name');

    const crNumber = normalizeCrNumber(cell(row, 'cr_number'));
    const importRef = cell(row, 'uuid') || null;

    const key = companyKey(crNumber, name, companyNameAr);
    if (name && seen.has(key)) issues.push('duplicate_in_file');
    if (name) seen.add(key);

    if (
      (importRef && existingRefs.has(importRef)) ||
      (crNumber && existingCrs.has(crNumber)) ||
      (name && (existingNames.has(name.toLowerCase()) || existingNames.has(companyNameAr.toLowerCase())))
    ) {
      issues.push('already_exists');
    }

    // ── Founder ──
    const founderNameAr = cell(row, 'name');
    const founderNameEn = cell(row, 'name_en');
    let founder: FounderDraft | null = null;

    const declared = declaredIdentity(row);
    if (!founderNameAr && !founderNameEn) {
      issues.push('missing_founder_name');
    } else if (!declared.number) {
      issues.push('missing_identity');
    } else {
      let type: IdentityType | null = declared.type;
      let parsed = type ? parseIdentityNumber(type, declared.number) : null;
      if (!parsed?.ok) {
        const inferred = inferIdentityType(declared.number);
        const retry = parseIdentityNumber(inferred, declared.number);
        if (retry.ok) {
          type = inferred;
          parsed = retry;
          issues.push('identity_type_corrected');
        }
      }

      if (parsed?.ok && type) {
        const genderCode = cell(row, 'gender');
        founder = {
          name: founderNameEn || founderNameAr,
          nameAr: founderNameAr || founderNameEn,
          phone: normalizePhone(cell(row, 'mobile')),
          email: cell(row, 'mail'),
          nationalityType: type,
          nationalityIdNumber: parsed.value,
          countryCode: type === 'national_id' ? 'SA' : '',
          gender: genderCode === '1' ? 'male' : genderCode === '2' ? 'female' : null,
        };
      } else {
        issues.push('invalid_identity');
      }
    }

    // ── Limits ──
    const team = parseCount(cell(row, 'number_of_founding_team'));
    const staff = parseCount(cell(row, 'number_of_employees'));
    if (team === null || staff === null) issues.push('missing_counts');

    // The applicant is always a founder, so the founder list has room for them.
    const foundersLimit = Math.max(team ?? 0, founder ? 1 : 0);
    const employeesLimit = staff ?? 0;

    const status = cell(row, 'registration_status') || 'registered';

    return {
      key: importRef ?? `row-${index}`,
      importRef,
      status,
      name,
      nameAr: companyNameAr,
      crNumber,
      foundersLimit,
      employeesLimit,
      phone: founder?.phone ?? normalizePhone(cell(row, 'mobile')),
      founder,
      issues,
      selectedByDefault: status === 'approved' && !issues.some((i) => BLOCKING_ISSUES.has(i)),
    };
  });
}

/**
 * Undo UTF-8 text that was decoded as Windows-1252, which is how Arabic in a
 * CSV opened in the wrong program turns into "Ø§ÙØ´Ø±ÙØ©".
 *
 * Returns the text unchanged unless it both looks garbled and decodes cleanly,
 * so real Arabic and plain English are never touched.
 */
export function repairMojibake(text: string): string {
  if (!text || !/[ØÙÚÛ][-ÿŒ-™]/.test(text)) return text;

  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }
    const byte = CP1252_REVERSE.get(code);
    if (byte === undefined) return text;
    bytes.push(byte);
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return text;
  }
}

/** Windows-1252 characters in 0x80-0x9F, by Unicode code point. */
const CP1252_REVERSE = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f],
]);
