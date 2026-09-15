/**
 * How many founder and employee places a company has left.
 *
 * Shared by the front desk and admin screens so both agree on "full". The
 * database enforces the same rule for the front desk (see the
 * employees_enforce_capacity trigger); this module decides what to show.
 */

export type PlaceType = 'founder' | 'employee';

export interface CapacityCompany {
  foundersLimit?: number | null;
  employeesLimit?: number | null;
  employees: ReadonlyArray<{ employeeType: PlaceType }>;
}

export interface Capacity {
  /** Null when the company has no limit for this type. */
  limit: number | null;
  used: number;
  /** Null when there is no limit. Never negative. */
  remaining: number | null;
  full: boolean;
}

export function capacityFor(company: CapacityCompany, type: PlaceType): Capacity {
  const limit = (type === 'founder' ? company.foundersLimit : company.employeesLimit) ?? null;
  const used = company.employees.filter((e) => e.employeeType === type).length;
  if (limit === null) return { limit: null, used, remaining: null, full: false };
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining, full: used >= limit };
}

/** Whole days from today until the incubation ends; negative once it has. */
export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const end = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  );
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end - start) / 86_400_000);
}
