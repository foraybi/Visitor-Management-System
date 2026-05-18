import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Visitor } from '../types';
import { formatTimeFromISO, formatTimeSpent, getTodayDateString } from './timeUtils';
import { azer29LTRegularBase64, azer29LTFontName } from '../assets/fonts/29LTAzer-Regular';

/**
 * Register the Azer Arabic font on a jsPDF instance.
 * Adds the TTF to jsPDF's VFS once per document.
 */
function registerArabicFont(doc: jsPDF) {
  const fileName = '29LTAzer-Regular.ttf';
  doc.addFileToVFS(fileName, azer29LTRegularBase64);
  doc.addFont(fileName, azer29LTFontName, 'normal');
  doc.addFont(fileName, azer29LTFontName, 'bold');
}

export interface DocumentHeader {
  admissionLabel: string;
  admissionName: string;
  formIdVersionLabel: string;
  formIdVersion: string;
  visionNumberLabel: string;
  visionNumber: string;
  formName: string;
  logoDataUrl: string;
}

export interface ExportOptions {
  companyLookup?: (id: string) => string;
  floorLookup?: (n: number) => string;
  language?: 'en' | 'ar';
  /** Display label for the active date filter — included in the header */
  filterLabel?: string;
  /** Custom document header (admin-controlled) */
  documentHeader?: DocumentHeader;
  /** Localized strings (column headers etc.) */
  labels?: {
    title: string;
    generated: string;
    filter: string;
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
  };
}

const FALLBACK: Required<ExportOptions>['labels'] = {
  title: 'Visitor Management Report',
  generated: 'Generated',
  filter: 'Filter',
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
};

export function exportVisitorsPdf(
  visitors: Visitor[],
  options: ExportOptions = {}
): void {
  const { companyLookup, floorLookup, language = 'en', filterLabel, documentHeader, labels } = options;
  const L = { ...FALLBACK, ...labels };
  const isRTL = language === 'ar';

  const doc = new jsPDF({ orientation: 'landscape' });
  const PAGE_W = 297; // A4 landscape mm
  const MARGIN = 14;
  const LEFT = MARGIN;
  const RIGHT = PAGE_W - MARGIN;
  let cursorY = 14;

  // Register Arabic font when needed
  if (isRTL) {
    registerArabicFont(doc);
  }
  const FONT_NORMAL = isRTL ? azer29LTFontName : 'helvetica';
  const FONT_BOLD = isRTL ? azer29LTFontName : 'helvetica';

  // ─── Document Header (admin-customised) ───
  if (documentHeader) {
    const labelValueAlign = isRTL ? 'right' : 'left';
    const xStart = isRTL ? RIGHT : LEFT;

    // Three label : value rows on the start side
    doc.setFont(FONT_NORMAL, 'normal');
    doc.setFontSize(10);

    const rows = [
      { label: documentHeader.admissionLabel, value: documentHeader.admissionName },
      { label: documentHeader.formIdVersionLabel, value: documentHeader.formIdVersion },
      { label: documentHeader.visionNumberLabel, value: documentHeader.visionNumber },
    ];

    rows.forEach((r, idx) => {
      const y = cursorY + idx * 6;
      const text = `${r.value || '—'} : ${r.label}`;
      doc.text(text, xStart, y, { align: labelValueAlign });
    });

    // Form Name centered
    doc.setFont(FONT_BOLD, 'bold');
    doc.setFontSize(14);
    doc.text(documentHeader.formName || L.title, PAGE_W / 2, cursorY + 8, {
      align: 'center',
    });

    // Logo on the opposite side
    if (documentHeader.logoDataUrl) {
      try {
        const logoX = isRTL ? LEFT : RIGHT - 30;
        doc.addImage(documentHeader.logoDataUrl, 'PNG', logoX, cursorY - 2, 30, 20);
      } catch {
        // ignore broken logo
      }
    }

    cursorY += 26;
    doc.setDrawColor(0, 114, 151);
    doc.setLineWidth(0.5);
    doc.line(LEFT, cursorY, RIGHT, cursorY);
    cursorY += 6;
  } else {
    // Fallback to old single-line title
    doc.setFont(FONT_BOLD, 'bold');
    doc.setFontSize(16);
    doc.text(L.title, isRTL ? RIGHT : LEFT, cursorY, { align: isRTL ? 'right' : 'left' });
    cursorY += 8;
  }

  // Generated date + filter description
  doc.setFont(FONT_NORMAL, 'normal');
  doc.setFontSize(9);
  doc.text(
    `${L.generated}: ${new Date().toLocaleString(language === 'ar' ? 'ar-SA' : 'en-SA')}`,
    isRTL ? RIGHT : LEFT,
    cursorY,
    { align: isRTL ? 'right' : 'left' }
  );
  cursorY += 5;
  if (filterLabel) {
    doc.text(`${L.filter}: ${filterLabel}`, isRTL ? RIGHT : LEFT, cursorY, {
      align: isRTL ? 'right' : 'left',
    });
    cursorY += 5;
  }

  const columns = [
    L.visitorId,
    L.status,
    L.name,
    L.phone,
    L.email,
    L.nationality,
    L.idNumber,
    L.floor,
    L.company,
    L.timeIn,
    L.timeOut,
    L.timeSpent,
  ];

  const rows = visitors.map(v => [
    v.id,
    v.status === 'active' ? L.active : L.exited,
    v.name,
    v.phone,
    v.email ?? '',
    v.countryName,
    v.nationalityIdNumber,
    floorLookup ? floorLookup(v.floor) : `${L.floor} ${v.floor}`,
    companyLookup ? companyLookup(v.visitedCompanyId) : v.visitedCompanyId,
    formatTimeFromISO(v.entryTime),
    formatTimeFromISO(v.exitTime),
    formatTimeSpent(v.entryTime, v.exitTime),
  ]);

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: cursorY + 2,
    styles: {
      fontSize: 7,
      halign: isRTL ? 'right' : 'left',
      font: FONT_NORMAL,
    },
    headStyles: {
      fillColor: [0, 114, 151],
      halign: isRTL ? 'right' : 'left',
      font: FONT_BOLD,
      fontStyle: 'bold',
    },
    bodyStyles: {
      font: FONT_NORMAL,
    },
  });

  doc.save(`VMS-Export-${getTodayDateString()}.pdf`);
}
