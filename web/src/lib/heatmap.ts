import type { PollResponse } from "./api";

export interface CellAgg {
  count: number; // available
  names: string[];
  maybe: number; // might be available
  maybeNames: string[];
}

export interface RankedSlot extends CellAgg {
  slot: string;
}

export interface Aggregate {
  total: number;
  cells: Map<string, CellAgg>;
  ranked: RankedSlot[];
  bestKey: string | null;
}

// Count available + maybe per slot, rank (available desc, then available+maybe,
// then earliest), and flag the best slot. Slot keys are `YYYY-MM-DDThh:mm`, so
// lexical order is chronological.
export function aggregate(responses: PollResponse[]): Aggregate {
  const cells = new Map<string, CellAgg>();
  const entry = (s: string): CellAgg => {
    let e = cells.get(s);
    if (!e) {
      e = { count: 0, names: [], maybe: 0, maybeNames: [] };
      cells.set(s, e);
    }
    return e;
  };

  for (const r of responses) {
    for (const s of r.slots) {
      const e = entry(s);
      e.count++;
      e.names.push(r.name);
    }
    for (const s of r.maybe) {
      const e = entry(s);
      e.maybe++;
      e.maybeNames.push(r.name);
    }
  }

  const ranked = Array.from(cells, ([slot, e]) => ({ slot, ...e })).sort(
    (a, b) =>
      b.count - a.count ||
      b.count + b.maybe - (a.count + a.maybe) ||
      a.slot.localeCompare(b.slot),
  );

  return { total: responses.length, cells, ranked, bestKey: ranked[0]?.slot ?? null };
}
