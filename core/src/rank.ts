export interface CellAgg {
  count: number; // "available"
  names: string[];
  maybe: number; // "might be available"
  maybeNames: string[];
}

export interface RankedSlot extends CellAgg {
  slot: string;
}

export interface ResponseLike {
  name: string;
  slots: string[];
  maybe?: string[];
}

// Tally available + maybe counts (and the names behind them) per slot key.
export function tallySlots(responses: ResponseLike[]): Map<string, CellAgg> {
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
    for (const s of r.maybe ?? []) {
      const e = entry(s);
      e.maybe++;
      e.maybeNames.push(r.name);
    }
  }
  return cells;
}

// Rank by available desc, then available-or-maybe desc, then earliest slot.
// Keys are `YYYY-MM-DDThh:mm`, so lexical order is chronological.
export function rankCells(cells: Map<string, CellAgg>): RankedSlot[] {
  return Array.from(cells, ([slot, e]) => ({ slot, ...e })).sort(
    (a, b) =>
      b.count - a.count ||
      b.count + b.maybe - (a.count + a.maybe) ||
      a.slot.localeCompare(b.slot),
  );
}
