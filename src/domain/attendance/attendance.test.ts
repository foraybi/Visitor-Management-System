import { describe, expect, it } from 'vitest';
import { buildAttendance, splitDuration, visitDurationMs, type AttendanceVisit } from './attendance';

const noura = { id: 'e1', name: 'Noura', nationalityIdNumber: '1029384756' };
const omar = { id: 'e2', name: 'Omar', nationalityIdNumber: '2000000002' };

function visit(over: Partial<AttendanceVisit> = {}): AttendanceVisit {
  return {
    id: `v-${Math.random()}`,
    visitorType: 'employee',
    nationalityIdNumber: noura.nationalityIdNumber,
    date: '2026-09-14',
    entryTime: '2026-09-14T06:00:00.000Z',
    exitTime: '2026-09-14T14:00:00.000Z',
    ...over,
  };
}

describe('attendance', () => {
  it('matches visits to employees by identity number', () => {
    const sheet = buildAttendance([noura, omar], [visit()], null);

    expect(sheet.employees.find((e) => e.employee.id === 'e1')?.checkIns).toBe(1);
    expect(sheet.employees.find((e) => e.employee.id === 'e2')?.checkIns).toBe(0);
    expect(sheet.employeesPresent).toBe(1);
  });

  it('ignores visitor check-ins recorded under the same identity number', () => {
    const sheet = buildAttendance([noura], [visit({ visitorType: 'visitor' })], null);

    expect(sheet.checkIns).toBe(0);
  });

  it('ignores stored spacing around the identity number', () => {
    const sheet = buildAttendance([noura], [visit({ nationalityIdNumber: ' 1029384756 ' })], null);

    expect(sheet.checkIns).toBe(1);
  });

  it('keeps only visits inside the date range, inclusive at both ends', () => {
    const visits = [
      visit({ date: '2026-09-01' }),
      visit({ date: '2026-09-10' }),
      visit({ date: '2026-09-30' }),
      visit({ date: '2026-10-01' }),
    ];
    const sheet = buildAttendance([noura], visits, { from: '2026-09-01', to: '2026-09-30' });

    expect(sheet.checkIns).toBe(3);
  });

  it('counts a day once however many times the employee checked in', () => {
    const visits = [
      visit({ entryTime: '2026-09-14T06:00:00.000Z', exitTime: '2026-09-14T09:00:00.000Z' }),
      visit({ entryTime: '2026-09-14T10:00:00.000Z', exitTime: '2026-09-14T14:00:00.000Z' }),
      visit({ date: '2026-09-15', entryTime: '2026-09-15T06:00:00.000Z', exitTime: '2026-09-15T08:00:00.000Z' }),
    ];
    const row = buildAttendance([noura], visits, null).employees[0];

    expect(row.daysPresent).toBe(2);
    expect(row.checkIns).toBe(3);
    expect(row.totalMs).toBe(9 * 3_600_000);
    expect(row.averageMsPerDay).toBe(4.5 * 3_600_000);
  });

  // An open visit has no end, so adding "until now" would make yesterday's
  // forgotten check-out look like a thirty-hour day.
  it('leaves an open visit out of the totals and flags it', () => {
    const visits = [visit(), visit({ date: '2026-09-15', entryTime: '2026-09-15T06:00:00.000Z', exitTime: null })];
    const sheet = buildAttendance([noura], visits, null);
    const row = sheet.employees[0];

    expect(row.totalMs).toBe(8 * 3_600_000);
    expect(row.hasOpenVisit).toBe(true);
    expect(sheet.openVisits).toBe(1);
    expect(row.records[0].durationMs).toBeNull();
  });

  it('lists records newest first', () => {
    const visits = [
      visit({ id: 'old', date: '2026-09-01', entryTime: '2026-09-01T06:00:00.000Z', exitTime: null }),
      visit({ id: 'new', date: '2026-09-14' }),
    ];
    const row = buildAttendance([noura], visits, null).employees[0];

    expect(row.records.map((r) => r.visitId)).toEqual(['new', 'old']);
    expect(row.lastRecord?.visitId).toBe('new');
  });

  it('treats an exit before the entry as unmeasurable rather than negative', () => {
    expect(visitDurationMs('2026-09-14T10:00:00Z', '2026-09-14T09:00:00Z')).toBeNull();
  });

  it('splits a duration into hours and minutes', () => {
    expect(splitDuration(2 * 3_600_000 + 15 * 60_000 + 59_000)).toEqual({ hours: 2, minutes: 15 });
  });
});
