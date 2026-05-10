import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Visitor } from '../types';
import { formatTimeFromISO, getTodayDateString } from './timeUtils';

export function exportVisitorsPdf(visitors: Visitor[]): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Visitor Management Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

  const columns = [
    'Visitor ID',
    'Name',
    'Phone',
    'Nationality',
    'Company',
    'Floor',
    'Status',
    'Entry Time',
    'Exit Time',
  ];

  const rows = visitors.map(v => [
    v.id,
    v.name,
    v.phone,
    v.countryName,
    v.visitedCompanyId,
    `Floor ${v.floor}`,
    v.status === 'active' ? 'Active' : 'Exited',
    formatTimeFromISO(v.entryTime),
    formatTimeFromISO(v.exitTime),
  ]);

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 28,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 114, 151] },
  });

  doc.save(`VMS-Export-${getTodayDateString()}.pdf`);
}
