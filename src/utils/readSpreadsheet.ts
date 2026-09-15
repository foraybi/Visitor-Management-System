import { repairMojibake, type SpreadsheetRow } from '../domain/incubation/importCompanies';

/**
 * Read the first sheet of a CSV or Excel file into rows of strings.
 *
 * A CSV is decoded as UTF-8 here rather than handed to SheetJS as bytes, which
 * would read a file without a byte-order mark as Latin-1 and turn every Arabic
 * name into "Ø§Ù...". Every header and cell is then passed through
 * `repairMojibake`, for files that were already garbled before they were saved.
 *
 * SheetJS is loaded on demand so it stays out of the admin screen's first load.
 */
export async function readSpreadsheet(file: File): Promise<SpreadsheetRow[]> {
  const XLSX = await import('xlsx');
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';

  let workbook;
  if (isCsv) {
    const text = new TextDecoder('utf-8').decode(await file.arrayBuffer()).replace(/^\uFEFF/, '');
    // raw keeps "001" and CR numbers as text instead of turning them into numbers.
    workbook = XLSX.read(text, { type: 'string', raw: true });
  } else {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  });

  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        repairMojibake(key.replace(/^\uFEFF/, '').trim()),
        repairMojibake(String(value ?? '')),
      ]),
    ),
  );
}
