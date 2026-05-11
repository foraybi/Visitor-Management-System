/**
 * Generates a 4-digit visitor ID that resets daily.
 * Counts only visitors whose `date` matches today's date.
 * Returns e.g. "0001", "0002", ...
 */
export function generateVisitorId(
  existingVisitors: { id: string; date: string }[],
  today: string
): string {
  const todayCount = existingVisitors.filter(v => v.date === today).length;
  const next = todayCount + 1;
  return String(next).padStart(4, '0');
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
