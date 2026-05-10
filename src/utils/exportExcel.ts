import * as XLSX from 'xlsx';
import type { Visitor, ExportRow } from '../types';
import { formatTimeFromISO, getTodayDateString } from './timeUtils';

export function exportVisitorsExcel(visitors: Visitor[]): void {
  const rows: ExportRow[] = visitors.map(v => ({
    visitorId: v.id,
    name: v.name,
    phone: v.phone,
    nationality: v.countryName,
    floor: `Floor ${v.floor}`,
    company: v.visitedCompanyId,
    status: v.status,
    entryTime: formatTimeFromISO(v.entryTime),
    exitTime: formatTimeFromISO(v.exitTime),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 14 },
    { wch: 20 },
    { wch: 10 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitors');
  XLSX.writeFile(workbook, `VMS-Export-${getTodayDateString()}.xlsx`);
}
