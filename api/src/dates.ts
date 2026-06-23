export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// Add `graceDays` to an ISO date (YYYY-MM-DD), returning an ISO date.
export function addGraceDays(isoDate: string, graceDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + graceDays);
  return d.toISOString().slice(0, 10);
}

// A dated poll stays live until `graceDays` after its last day.
export function expiryDate(days: string[], graceDays: number): string {
  return addGraceDays(
    days.reduce((a, b) => (a > b ? a : b)),
    graceDays,
  );
}

export function isExpired(expiresAt: string | null, today: string): boolean {
  return expiresAt !== null && expiresAt < today;
}
