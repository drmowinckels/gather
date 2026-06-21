export interface RankedSlot {
  slot: string;
  count: number; // "available"
  names: string[];
  maybe: number; // "might be available"
  maybeNames: string[];
}

interface Tally {
  count: number;
  names: string[];
  maybe: number;
  maybeNames: string[];
}

// Rank slots by how many respondents are available. Ties break by total
// available-or-maybe, then by earliest slot (keys are `YYYY-MM-DDThh:mm`, so
// lexical order is chronological).
export function rankSlots(
  responses: { name: string; slots: string[]; maybe?: string[] }[],
  limit?: number,
): { total: number; results: RankedSlot[] } {
  const tally = new Map<string, Tally>();
  const entry = (s: string): Tally => {
    let e = tally.get(s);
    if (!e) {
      e = { count: 0, names: [], maybe: 0, maybeNames: [] };
      tally.set(s, e);
    }
    return e;
  };

  for (const r of responses) {
    for (const s of r.slots) {
      const e = entry(s);
      e.count++;
      e.names.push(r.name);
    }
    for (const s of r.maybe ?? []) {
      const e = entry(s);
      e.maybe++;
      e.maybeNames.push(r.name);
    }
  }

  let results: RankedSlot[] = Array.from(tally, ([slot, e]) => ({
    slot,
    count: e.count,
    names: e.names,
    maybe: e.maybe,
    maybeNames: e.maybeNames,
  })).sort(
    (a, b) =>
      b.count - a.count ||
      b.count + b.maybe - (a.count + a.maybe) ||
      a.slot.localeCompare(b.slot),
  );

  if (limit !== undefined && limit > 0) results = results.slice(0, limit);
  return { total: responses.length, results };
}
