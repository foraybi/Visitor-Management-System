import { describe, expect, it } from 'vitest';
import { capacityFor, daysUntil } from './capacity';

const people = (founders: number, employees: number) => [
  ...Array.from({ length: founders }, () => ({ employeeType: 'founder' as const })),
  ...Array.from({ length: employees }, () => ({ employeeType: 'employee' as const })),
];

describe('company capacity', () => {
  it('counts each type against its own limit', () => {
    const company = { foundersLimit: 2, employeesLimit: 3, employees: people(1, 3) };
    expect(capacityFor(company, 'founder')).toEqual({ limit: 2, used: 1, remaining: 1, full: false });
    expect(capacityFor(company, 'employee')).toEqual({ limit: 3, used: 3, remaining: 0, full: true });
  });

  // Companies added before imports existed have no limits and must keep working.
  it('never reports full when there is no limit', () => {
    const company = { foundersLimit: null, employeesLimit: undefined, employees: people(4, 40) };
    expect(capacityFor(company, 'employee')).toEqual({ limit: null, used: 40, remaining: null, full: false });
  });

  it('treats a limit of zero as full', () => {
    expect(capacityFor({ employeesLimit: 0, employees: [] }, 'employee').full).toBe(true);
  });

  it('never reports negative remaining places when an admin went over', () => {
    expect(capacityFor({ foundersLimit: 1, employees: people(3, 0) }, 'founder').remaining).toBe(0);
  });

  it('counts days until the incubation ends', () => {
    const today = new Date(2026, 8, 15);
    expect(daysUntil('2026-09-25', today)).toBe(10);
    expect(daysUntil('2026-09-15', today)).toBe(0);
    expect(daysUntil('2026-09-10', today)).toBe(-5);
  });
});
