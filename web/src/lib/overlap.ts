import { toMinutes, pad, type OverlapResult } from "@samkoma/core";
import { zonedTimeToUtc, partsInTz } from "./tz";

export interface BandCell {
  // The zone's local hour (0-23) at this column's instant.
  hour: number;
  // The local time falls inside the working window [workFrom, workTo).
  inWindow: boolean;
}

export interface BandRow {
  zone: string;
  cells: BandCell[]; // one per home-tz hour column, parallel to `hours`
}

export interface OverlapBandData {
  hours: number[]; // 0..23 — the home-tz hour axis (column headers)
  homeCells: BandCell[]; // the host's own row, carried by the hour axis
  rows: BandRow[]; // one per covered zone, in input order
}

// The display grid for the overlap band, like timezoneoverlap.com: each column is
// an hour in the poll's home timezone on `refDate`, and each row shows what local
// hour that instant is in a covered zone, flagged when it sits inside the working
// window. This is presentation only — which columns are the *overlap* is decided
// by `overlapWindow` (the single source of truth) and projected via `overlapHourSet`.
export function buildOverlapBand(
  zones: string[],
  workFrom: string,
  workTo: string,
  homeTz: string,
  refDate: string,
): OverlapBandData {
  const fromMin = toMinutes(workFrom);
  const toMin = toMinutes(workTo);
  const hours = Array.from({ length: 24 }, (_, h) => h);

  const homeCells: BandCell[] = hours.map((h) => ({
    hour: h,
    inWindow: h * 60 >= fromMin && h * 60 < toMin,
  }));

  const rows: BandRow[] = zones.map((zone) => ({
    zone,
    cells: hours.map((h) => {
      const utc = zonedTimeToUtc(refDate, `${pad(h)}:00`, homeTz);
      const localMin = toMinutes(partsInTz(utc, zone).time);
      return {
        hour: Math.floor(localMin / 60),
        inWindow: localMin >= fromMin && localMin < toMin,
      };
    }),
  }));

  return { hours, homeCells, rows };
}

// Which home-tz hour columns fall inside the overlap window from `overlapWindow`.
// Derived from that result so the highlighted columns and the filled from/to can
// never disagree (handles a window that wraps past midnight).
export function overlapHourSet(overlap: OverlapResult): boolean[] {
  const set = new Array<boolean>(24).fill(false);
  if (overlap.empty || overlap.from === null || overlap.to === null) return set;
  const from = toMinutes(overlap.from);
  const to = toMinutes(overlap.to);
  for (let h = 0; h < 24; h++) {
    const m = h * 60;
    set[h] = from <= to ? m >= from && m < to : m >= from || m < to;
  }
  return set;
}
