// Lifetime usage counters in the `daily_stats` table. Unlike polls and responses
// (which are deleted at expiry), these rows are only ever incremented, so they
// outlive the data they count and give a permanent record over time.
import { addGraceDays, todayUTC } from "./dates";

// Closed allowlist of countable events. Values are the literal column names, so a
// metric can only ever interpolate a known column into the SQL below.
const STAT_COLUMNS = {
  polls_created: "polls_created",
  responses_submitted: "responses_submitted",
} as const;

export type StatMetric = keyof typeof STAT_COLUMNS;

// Record one event for `day` (UTC). Best-effort: a counter failure must never
// break the write that triggered it, so errors are swallowed (logged) — exactly
// like the rate limiter fails open.
export async function recordEvent(
  db: D1Database,
  metric: StatMetric,
  day: string = todayUTC(),
): Promise<void> {
  const column = STAT_COLUMNS[metric];
  if (!column) return;
  try {
    await db
      .prepare(
        `INSERT INTO daily_stats (day, ${column}) VALUES (?, 1)
         ON CONFLICT(day) DO UPDATE SET ${column} = ${column} + 1`,
      )
      .bind(day)
      .run();
  } catch (err) {
    console.error("samkoma stats: recordEvent failed", err);
  }
}

export interface DailyStat {
  day: string;
  pollsCreated: number;
  responsesSubmitted: number;
}

export interface StatsResult {
  totals: { pollsCreated: number; responsesSubmitted: number };
  daily: DailyStat[];
}

// Lifetime totals (the full table) plus a daily series covering the last `days`
// days. Totals are unaffected by the window, so callers always see the true
// running record while keeping the per-day payload bounded.
export async function readStats(
  db: D1Database,
  days: number,
  today: string = todayUTC(),
): Promise<StatsResult> {
  const cutoff = addGraceDays(today, -days);
  const batch = await db.batch([
    db.prepare(
      `SELECT
         COALESCE(SUM(polls_created), 0)       AS polls_created,
         COALESCE(SUM(responses_submitted), 0) AS responses_submitted
       FROM daily_stats`,
    ),
    db
      .prepare(
        `SELECT day, polls_created, responses_submitted
           FROM daily_stats
          WHERE day >= ?
          ORDER BY day`,
      )
      .bind(cutoff),
  ]);

  const totalsRow = batch[0].results[0] as
    | { polls_created: number; responses_submitted: number }
    | undefined;
  const dailyRows = batch[1].results as {
    day: string;
    polls_created: number;
    responses_submitted: number;
  }[];

  return {
    totals: {
      pollsCreated: totalsRow?.polls_created ?? 0,
      responsesSubmitted: totalsRow?.responses_submitted ?? 0,
    },
    daily: dailyRows.map((r) => ({
      day: r.day,
      pollsCreated: r.polls_created,
      responsesSubmitted: r.responses_submitted,
    })),
  };
}
