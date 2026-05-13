import * as XLSX from 'xlsx';
import type { Visitor } from '../types';
import { formatTimeFromISO, formatTimeSpent, getTodayDateString } from './timeUtils';

export interface ExcelDocumentHeader {
  admissionLabel: string;
  admissionName: string;
  formIdVersionLabel: string;
  formIdVersion: string;
  visionNumberLabel: string;
  visionNumber: string;
  formName: string;
  logoDataUrl: string;
}

export interface ExcelExportOptions {
  companyLookup?: (id: string) => string;
  language?: 'en' | 'ar';
  filterLabel?: string;
  documentHeader?: ExcelDocumentHeader;
  labels?: {
    visitorId: string;
    status: string;
    name: string;
    phone: string;
    email: string;
    nationality: string;
    idNumber: string;
    floor: string;
    company: string;
    timeIn: string;
    timeOut: string;
    timeSpent: string;
    active: string;
    exited: string;
    sheetName: string;
    filter: string;
  };
}

const FALLBACK = {
  visitorId: 'Visitor ID',
  status: 'Status',
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  nationality: 'Nationality',
  idNumber: 'ID Number',
  floor: 'Floor',
  company: 'Company',
  timeIn: 'Time In',
  timeOut: 'Time Out',
  timeSpent: 'Time Spent',
  active: 'Active',
  exited: 'Exited',
  sheetName: 'Visitors',
  filter: 'Filter',
};

export function exportVisitorsExcel(
  visitors: Visitor[],
  options: ExcelExportOptions = {}
): void {
  const { companyLookup, language = 'en', filterLabel, documentHeader, labels } = options;
  const L = { ...FALLBACK, ...labels };

  const rows = visitors.map(v => ({
    [L.visitorId]: v.id,
    [L.status]: v.status === 'active' ? L.active : L.exited,
    [L.name]: v.name,
    [L.phone]: v.phone,
    [L.email]: v.email ?? '',
    [L.nationality]: v.countryName,
    [L.idNumber]: v.nationalityIdNumber,
    [L.floor]: `${L.floor} ${v.floor}`,
    [L.company]: companyLookup ? companyLookup(v.visitedCompanyId) : v.visitedCompanyId,
    [L.timeIn]: formatTimeFromISO(v.entryTime),
    [L.timeOut]: formatTimeFromISO(v.exitTime),
    [L.timeSpent]: formatTimeSpent(v.entryTime, v.exitTime),
  }));

  const workbook = XLSX.utils.book_new();

  // Build prelude rows: document header (3 label:value pairs) + form name, then filter line
  const preludeRows: (string | number)[][] = [];
  if (documentHeader) {
    preludeRows.push([
      `${documentHeader.admissionLabel}: ${documentHeader.admissionName || ''}`,
      '',
      '',
      documentHeader.formName,
    ]);
    preludeRows.push([
      `${documentHeader.formIdVersionLabel}: ${documentHeader.formIdVersion || ''}`,
    ]);
    preludeRows.push([
      `${documentHeader.visionNumberLabel}: ${documentHeader.visionNumber || ''}`,
    ]);
    preludeRows.push([]); // spacer
  }
  if (filterLabel) {
    preludeRows.push([`${L.filter}: ${filterLabel}`]);
    preludeRows.push([]);
  }

  let worksheet: XLSX.WorkSheet;
  if (preludeRows.length > 0) {
    worksheet = XLSX.utils.aoa_to_sheet(preludeRows);
    XLSX.utils.sheet_add_json(worksheet, rows, {
      origin: `A${preludeRows.length + 1}`,
    });
  } else {
    worksheet = XLSX.utils.json_to_sheet(rows);
  }

  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 22 },
    { wch: 14 },
    { wch: 25 },
    { wch: 18 },
    { wch: 15 },
    { wch: 10 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ];

  if (language === 'ar') {
    worksheet['!views'] = [{ RTL: true }];
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, L.sheetName);
  XLSX.writeFile(workbook, `VMS-Export-${getTodayDateString()}.xlsx`);
}
