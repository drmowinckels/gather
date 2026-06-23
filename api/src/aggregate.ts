import { tallySlots, rankCells, type RankedSlot } from "@samkoma/core";

export type { RankedSlot };

// Rank slots by availability (shared core logic), then apply an optional limit.
export function rankSlots(
  responses: { name: string; slots: string[]; maybe?: string[] }[],
  limit?: number,
): { total: number; results: RankedSlot[] } {
  let results = rankCells(tallySlots(responses));
  if (limit !== undefined && limit > 0) results = results.slice(0, limit);
  return { total: responses.length, results };
}
