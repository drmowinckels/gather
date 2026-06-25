import { Hono } from "hono";
import { readStats } from "./stats";
import type { Env } from "./types";

const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;

export const metrics = new Hono<{ Bindings: Env }>();

// Public, aggregate-only usage counters: how many polls have been created and
// responses submitted, as lifetime totals plus a recent daily series. No
// per-poll detail is exposed. `?days=N` (1–365, default 90) sizes the series.
metrics.get("/", async (c) => {
  const raw = c.req.query("days");
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const days = Number.isFinite(parsed)
    ? Math.max(1, Math.min(MAX_DAYS, parsed))
    : DEFAULT_DAYS;

  return c.json(await readStats(c.env.DB, days));
});
