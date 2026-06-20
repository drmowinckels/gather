function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Start times of each slot block within [from, to), stepping by slotMin.
export function timeSlots(from: string, to: string, slotMin: number): string[] {
  const start = toMinutes(from);
  const end = toMinutes(to);
  const out: string[] = [];
  for (let t = start; t + slotMin <= end; t += slotMin) {
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
}

// Every valid slot key for a poll: `${day}T${HH:MM}` in the poll's canonical tz.
export function validSlotKeys(
  days: string[],
  from: string,
  to: string,
  slotMin: number,
): Set<string> {
  const times = timeSlots(from, to, slotMin);
  const set = new Set<string>();
  for (const d of days) for (const t of times) set.add(`${d}T${t}`);
  return set;
}
