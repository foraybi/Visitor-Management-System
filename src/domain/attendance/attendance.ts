/**
 * Employee attendance, built from kiosk check-ins.
 *
 * An employee's attendance is every visit recorded under their identity number
 * with visitor type "employee". It is matched by identity number rather than by
 * name, for the same reason as the presence module: a name is typed by hand and
 * is not unique, while the identity number is normalised when it is recorded.
 *
 * Pure on purpose. The admin sheet renders it and exports it, and both must
 * agree on what a day, a check-in and a total mean.
 */

/** The fields of a visit that attendance reads. */
export interface AttendanceVisit {
  id: string;
  visitorType: string;
  nationalityIdNumber: string;
  date: string;
  entryTime: string;
  exitTime: string | null;
}

/** The fields of an employee that attendance reads. */
export interface AttendanceEmployee {
  id: string;
  nationalityIdNumber: string;
}

/** Inclusive, as YYYY-MM-DD strings, the same shape `visitors.date` has. */
export interface DateRange {
  from: string;
  to: string;
}

export interface AttendanceRecord {
  visitId: string;
  date: string;
  entryTime: string;
  exitTime: string | null;
  /** Null while the visit is still open: there is no end to measure to. */
  durationMs: number | null;
}

export interface EmployeeAttendance<E extends AttendanceEmployee> {
  employee: E;
  /** Newest first. */
  records: AttendanceRecord[];
  daysPresent: number;
  checkIns: number;
  /** Closed visits only. */
  totalMs: number;
  averageMsPerDay: number;
  lastRecord: AttendanceRecord | null;
  hasOpenVisit: boolean;
}

export interface CompanyAttendance<E extends AttendanceEmployee> {
  /** Every employee of the company, including those with no records. */
  employees: EmployeeAttendance<E>[];
  employeesPresent: number;
  checkIns: number;
  totalMs: number;
  openVisits: number;
}

function key(value: string): string {
  return (value ?? '').trim();
}

/** Time between entry and exit, or null when the visit is open or malformed. */
export function visitDurationMs(entryTime: string, exitTime: string | null): number | null {
  if (!exitTime) return null;
  const ms = Date.parse(exitTime) - Date.parse(entryTime);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** Whole hours and remaining minutes, for display in either language. */
export function splitDuration(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export function buildAttendance<E extends AttendanceEmployee>(
  employees: readonly E[],
  visits: readonly AttendanceVisit[],
  range: DateRange | null,
): CompanyAttendance<E> {
  const recordsById = new Map<string, AttendanceRecord[]>();
  for (const employee of employees) {
    const id = key(employee.nationalityIdNumber);
    if (id.length > 0 && !recordsById.has(id)) recordsById.set(id, []);
  }

  for (const visit of visits) {
    if (visit.visitorType !== 'employee') continue;
    if (range && (visit.date < range.from || visit.date > range.to)) continue;

    const records = recordsById.get(key(visit.nationalityIdNumber));
    if (!records) continue;

    records.push({
      visitId: visit.id,
      date: visit.date,
      entryTime: visit.entryTime,
      exitTime: visit.exitTime,
      durationMs: visitDurationMs(visit.entryTime, visit.exitTime),
    });
  }

  const rows = employees.map((employee): EmployeeAttendance<E> => {
    const records = [...(recordsById.get(key(employee.nationalityIdNumber)) ?? [])].sort(
      (a, b) => Date.parse(b.entryTime) - Date.parse(a.entryTime),
    );
    const daysPresent = new Set(records.map((r) => r.date)).size;
    const totalMs = records.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

    return {
      employee,
      records,
      daysPresent,
      checkIns: records.length,
      totalMs,
      averageMsPerDay: daysPresent > 0 ? Math.round(totalMs / daysPresent) : 0,
      lastRecord: records[0] ?? null,
      hasOpenVisit: records.some((r) => r.exitTime === null),
    };
  });

  return {
    employees: rows,
    employeesPresent: rows.filter((r) => r.checkIns > 0).length,
    checkIns: rows.reduce((sum, r) => sum + r.checkIns, 0),
    totalMs: rows.reduce((sum, r) => sum + r.totalMs, 0),
    openVisits: rows.reduce((sum, r) => sum + r.records.filter((x) => x.exitTime === null).length, 0),
  };
}
