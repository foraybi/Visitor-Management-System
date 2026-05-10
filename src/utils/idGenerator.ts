export function generateVisitorId(existingIds: string[]): string {
  const nums = existingIds
    .filter(id => /^VST-\d{3,}$/.test(id))
    .map(id => parseInt(id.replace('VST-', ''), 10));

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `VST-${String(next).padStart(3, '0')}`;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
