import type { PollResponse } from "./api";
import {
  tallySlots,
  rankCells,
  type CellAgg,
  type RankedSlot,
} from "@samkoma/core";

export type { CellAgg, RankedSlot };

export interface Aggregate {
  total: number;
  cells: Map<string, CellAgg>;
  ranked: RankedSlot[];
  bestKey: string | null;
}

// Tally + rank via shared core logic, then add the web-only view bits: the cell
// map for grid lookup and the best-slot key.
export function aggregate(responses: PollResponse[]): Aggregate {
  const cells = tallySlots(responses);
  const ranked = rankCells(cells);
  return {
    total: responses.length,
    cells,
    ranked,
    bestKey: ranked[0]?.slot ?? null,
  };
}
