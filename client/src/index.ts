// gather-client — a tiny, dependency-free client for the gather REST API.
// Works anywhere `fetch` exists (Node 18+, browsers, Cloudflare Workers).

export const DEFAULT_BASE_URL = "https://api.gather.drmowinckels.io";

export interface PollInput {
  title: string;
  days: string[]; // ISO dates "YYYY-MM-DD"
  from: string; // "HH:MM"
  to: string; // "HH:MM"
  slot: number; // 15 | 30 | 60
  tz: string; // IANA timezone
  public: boolean;
}

export interface CreatedPoll {
  id: string;
  url: string;
  editToken: string;
}

export interface PollResponse {
  name: string;
  tz: string;
  slots: string[];
  updatedAt: string;
}

export interface Poll {
  id: string;
  title: string;
  days: string[];
  from: string;
  to: string;
  slot: number;
  tz: string;
  public: boolean;
  lockedSlot: string | null;
  expiresAt: string | null;
  createdAt: string;
  responses: PollResponse[];
}

export interface RankedSlot {
  slot: string;
  count: number;
  names: string[];
}

export interface BestResult {
  total: number;
  results: RankedSlot[];
}

export interface SlotsInput {
  name: string;
  tz: string;
  slots: string[];
}

export class GatherError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(`gather API error: ${code} (${status})`);
    this.name = "GatherError";
  }
}

async function toError(res: Response): Promise<GatherError> {
  let code = "request_failed";
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) code = body.error;
  } catch {
    // non-JSON body
  }
  return new GatherError(code, res.status);
}

export interface GatherClientOptions {
  /** API base URL. Defaults to production. */
  baseUrl?: string;
  /**
   * A poll's edit token, used for host-only actions (lock/unlock) and to read a
   * private poll's responses. A bot typically passes the token it received from
   * `createPoll` per poll, so most callers leave this unset and pass per-call.
   */
  editToken?: string;
}

export class GatherClient {
  private baseUrl: string;
  private editToken?: string;

  constructor(options: GatherClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.editToken = options.editToken;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, init);
    if (!res.ok) throw await toError(res);
    return (await res.json()) as T;
  }

  createPoll(input: PollInput): Promise<CreatedPoll> {
    return this.request("/v1/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  /** Fetch a poll. Pass the edit token to see responses on a private poll. */
  getPoll(id: string, editToken = this.editToken): Promise<Poll> {
    return this.request(`/v1/polls/${encodeURIComponent(id)}`, {
      headers: editToken ? { Authorization: `Bearer ${editToken}` } : undefined,
    });
  }

  submitSlots(id: string, input: SlotsInput): Promise<PollResponse> {
    return this.request(`/v1/polls/${encodeURIComponent(id)}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  /** Ranked best slots. Pass the edit token for a private poll. */
  getBest(
    id: string,
    opts: { limit?: number; editToken?: string } = {},
  ): Promise<BestResult> {
    const token = opts.editToken ?? this.editToken;
    const q = opts.limit ? `?limit=${opts.limit}` : "";
    return this.request(`/v1/polls/${encodeURIComponent(id)}/best${q}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  }

  lock(id: string, slot: string, editToken = this.editToken): Promise<Poll> {
    return this.setLock(id, slot, editToken);
  }

  unlock(id: string, editToken = this.editToken): Promise<Poll> {
    return this.setLock(id, null, editToken);
  }

  private async setLock(
    id: string,
    slot: string | null,
    editToken?: string,
  ): Promise<Poll> {
    if (!editToken) throw new GatherError("missing_edit_token", 0);
    return this.request(`/v1/polls/${encodeURIComponent(id)}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${editToken}`,
      },
      body: JSON.stringify({ slot }),
    });
  }
}

// --- helpers for turning a chat/issue command into a poll -------------------

const WEEKDAYS: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextOccurrence(weekday: number, today: Date): string {
  const todayIdx = (today.getDay() + 6) % 7; // 0 = Monday
  const ahead = (weekday - todayIdx + 7) % 7;
  return toISO(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead),
  );
}

/**
 * Resolve a day spec into sorted, de-duplicated ISO dates. Tokens may be ISO
 * dates ("2026-07-15"), weekdays ("mon"), or weekday ranges ("mon-fri").
 * Weekdays resolve to their next upcoming occurrence.
 */
export function resolveDays(spec: string, today: Date = new Date()): string[] {
  const out = new Set<string>();
  for (const raw of spec.split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    if (ISO_DATE.test(token)) {
      out.add(token);
      continue;
    }
    const range = token.match(/^([a-z]{3})-([a-z]{3})$/);
    if (range) {
      const start = WEEKDAYS[range[1]];
      const end = WEEKDAYS[range[2]];
      if (start === undefined || end === undefined || start > end) {
        throw new Error(`Invalid day range: "${raw}"`);
      }
      for (let i = start; i <= end; i++) out.add(nextOccurrence(i, today));
      continue;
    }
    const wd = WEEKDAYS[token];
    if (wd === undefined) throw new Error(`Unrecognized day: "${raw}"`);
    out.add(nextOccurrence(wd, today));
  }
  if (out.size === 0) throw new Error("No days found in command");
  return [...out].sort();
}

export interface ParsedCommand {
  days: string[];
  from: string;
  to: string;
  tz: string;
}

/**
 * Reference parser for a chat/issue command like:
 *   "tue-thu 9-15 tz:Europe/Oslo"
 * Adapt freely to your bot's own grammar — this is a starting point. Recognises
 * a day spec, an `H-H` (or `HH:MM-HH:MM`) time range, and `tz:<zone>`.
 */
export function parseGatherCommand(
  text: string,
  opts: { defaultTz?: string; today?: Date } = {},
): ParsedCommand {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let daysSpec: string | undefined;
  let from = "09:00";
  let to = "17:00";
  let tz = opts.defaultTz ?? "UTC";

  const time = (h: string) => (h.includes(":") ? h : `${pad(Number(h))}:00`);

  for (const tok of tokens) {
    if (tok.startsWith("tz:")) {
      tz = tok.slice(3);
      continue;
    }
    const range = tok.match(/^(\d{1,2}(?::\d{2})?)-(\d{1,2}(?::\d{2})?)$/);
    if (range && /^\d/.test(tok)) {
      from = time(range[1]);
      to = time(range[2]);
      continue;
    }
    // otherwise treat as (part of) the day spec
    daysSpec = daysSpec ? `${daysSpec},${tok}` : tok;
  }

  if (!daysSpec) throw new Error("No days found in command");
  return { days: resolveDays(daysSpec, opts.today), from, to, tz };
}
