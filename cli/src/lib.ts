// Day resolution is shared with the client/bot via @samkoma/core.
import { resolveDays, parseWeekdays } from "@samkoma/core";
export { resolveDays, parseWeekdays };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseSlot(value: string): number {
  const n = Number.parseInt(value.replace(/m$/i, ""), 10);
  if (![15, 30, 60].includes(n)) {
    throw new Error(`Slot size must be 15, 30 or 60 minutes (got "${value}")`);
  }
  return n;
}

export function parseTime(value: string, label: string): string {
  if (!HHMM.test(value)) {
    throw new Error(`${label} must be HH:MM (got "${value}")`);
  }
  return value;
}

export function parseDeadline(value: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`--deadline must be a date/time (got "${value}")`);
  }
  return new Date(ms).toISOString();
}

export interface CreateOptions {
  title: string;
  days: string;
  from?: string;
  to?: string;
  slot?: string;
  tz: string;
  public: boolean;
  weekdays?: boolean;
  hideResults?: boolean;
  deadline?: string;
}

export interface PollBody {
  title: string;
  kind: "dates" | "weekdays";
  days: string[];
  from: string;
  to: string;
  slot: number;
  tz: string;
  public: boolean;
  resultsHidden: boolean;
  deadline?: string;
}

export function buildCreateBody(
  opts: CreateOptions,
  today: Date = new Date(),
): PollBody {
  const title = opts.title.trim();
  if (!title) throw new Error("A title is required");
  const from = parseTime(opts.from ?? "09:00", "--from");
  const to = parseTime(opts.to ?? "17:00", "--to");
  if (from >= to) throw new Error("--from must be earlier than --to");
  const kind = opts.weekdays ? "weekdays" : "dates";
  return {
    title,
    kind,
    // Weekday polls keep tokens (mon–fri); dated polls resolve to ISO dates.
    days:
      kind === "weekdays"
        ? parseWeekdays(opts.days)
        : resolveDays(opts.days, today),
    from,
    to,
    slot: parseSlot(opts.slot ?? "30"),
    tz: opts.tz,
    public: opts.public,
    resultsHidden: opts.hideResults ?? false,
    ...(opts.deadline ? { deadline: parseDeadline(opts.deadline) } : {}),
  };
}

export interface EditOptions {
  title?: string;
  days?: string;
  from?: string;
  to?: string;
  slot?: string;
  public?: boolean; // tri-state: true → public, false → private, undefined → unchanged
  resultsHidden?: boolean; // tri-state: true → hide, false → reveal, undefined → unchanged
}

export interface EditBody {
  title?: string;
  days?: string[];
  from?: string;
  to?: string;
  slot?: number;
  public?: boolean;
  resultsHidden?: boolean;
}

// Build a partial edit body from only the flags the host actually passed. The
// server enforces the additive-only rule (no removed slots) and the from < to
// ordering against the merged values, so we only validate what is present here.
export function buildEditBody(
  opts: EditOptions,
  today: Date = new Date(),
): EditBody {
  const body: EditBody = {};
  if (opts.title !== undefined) {
    const title = opts.title.trim();
    if (!title) throw new Error("A title is required");
    body.title = title;
  }
  if (opts.days !== undefined) body.days = resolveDays(opts.days, today);
  if (opts.from !== undefined) body.from = parseTime(opts.from, "--from");
  if (opts.to !== undefined) body.to = parseTime(opts.to, "--to");
  if (opts.slot !== undefined) body.slot = parseSlot(opts.slot);
  if (opts.public !== undefined) body.public = opts.public;
  if (opts.resultsHidden !== undefined) body.resultsHidden = opts.resultsHidden;
  if (
    body.from !== undefined &&
    body.to !== undefined &&
    body.from >= body.to
  ) {
    throw new Error("--from must be earlier than --to");
  }
  if (Object.keys(body).length === 0) {
    throw new Error(
      "Nothing to edit — pass --title, --days, --from, --to, --slot, --public/--private or --hide-results/--reveal",
    );
  }
  return body;
}
