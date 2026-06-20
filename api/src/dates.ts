export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// The poll stays live until `graceDays` after its last day (an ISO date).
export function expiryDate(days: string[], graceDays: number): string {
  const last = days.reduce((a, b) => (a > b ? a : b));
  const d = new Date(`${last}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + graceDays);
  return d.toISOString().slice(0, 10);
}

export function isExpired(expiresAt: string | null, today: string): boolean {
  return expiresAt !== null && expiresAt < today;
}
