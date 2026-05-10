import type { Visitor } from '../types';

export function getCurrentTimeHHMM(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-SA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatTimeFromISO(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-SA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function computeTotalHoursToday(visitors: Visitor[]): string {
  const totalMs = visitors
    .filter(v => v.status === 'exited' && v.exitTime)
    .reduce((acc, v) => {
      return (
        acc +
        (new Date(v.exitTime!).getTime() - new Date(v.entryTime).getTime())
      );
    }, 0);
  return `${(totalMs / 3_600_000).toFixed(1)} hrs`;
}

export function getMostVisitedFloor(visitors: Visitor[]): string {
  const counts: Record<number, number> = {};
  visitors.forEach(v => {
    counts[v.floor] = (counts[v.floor] ?? 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? `Floor ${sorted[0][0]}` : '—';
}
