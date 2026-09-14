/**
 * Generates a globally sequential 4-digit visitor ID.
 * Finds the highest existing numeric ID and increments it.
 * Returns e.g. "0001", "0002", ...
 *
 * NOTE: We do NOT reset per-day because the `id` column is a global
 * primary key — daily resets caused "0001" conflicts on every new day.
 */
export function generateVisitorId(
  existingVisitors: { id: string; date: string }[],
  _today: string
): string {
  const max = existingVisitors
    .map(v => parseInt(v.id, 10))
    .filter(n => !isNaN(n))
    .reduce((acc, n) => Math.max(acc, n), 0);
  return String(max + 1).padStart(4, '0');
}

/**
 * Generates the next 4-digit employee number across all companies.
 * Returns e.g. "0001", "0002", ...
 */
export function generateEmployeeNumber(existingNumbers: string[]): string {
  const nums = existingNumbers
    .filter(n => /^\d+$/.test(n))
    .map(n => parseInt(n, 10));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return String(next).padStart(4, '0');
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
