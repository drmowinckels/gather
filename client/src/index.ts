// samkoma-client — a tiny, dependency-free client for the samkoma REST API.
// Works anywhere `fetch` exists (Node 18+, browsers, Cloudflare Workers).
// @samkoma/core is bundled into the published build (tsup), so consumers still
// install zero runtime dependencies.
import { pad, resolveDays as coreResolveDays } from "@samkoma/core";

export const DEFAULT_BASE_URL = "https://api.samkoma.drmowinckels.io";

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
  maybe: string[];
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
  maybe?: string[]; // "might be available" slots (optional)
}

/**
 * A partial edit of a poll. Additive-only on the server: you may rename, add
 * days, or extend the window, but you cannot remove slots people may have
 * voted on, nor change the slot length. At least one field is required.
 */
export interface EditPollInput {
  title?: string;
  days?: string[];
  from?: string;
  to?: string;
  slot?: number;
  public?: boolean;
}

export class SamkomaError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(`samkoma API error: ${code} (${status})`);
    this.name = "SamkomaError";
  }
}

async function toError(res: Response): Promise<SamkomaError> {
  let code = "request_failed";
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) code = body.error;
  } catch {
    // non-JSON body
  }
  return new SamkomaError(code, res.status);
}

export interface SamkomaClientOptions {
  /** API base URL. Defaults to production. */
  baseUrl?: string;
  /**
   * A poll's edit token, used for host-only actions (lock/unlock) and to read a
   * private poll's responses. A bot typically passes the token it received from
   * `createPoll` per poll, so most callers leave this unset and pass per-call.
   */
  editToken?: string;
}

export class SamkomaClient {
  private baseUrl: string;
  private editToken?: string;

  constructor(options: SamkomaClientOptions = {}) {
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

  /**
   * Edit a poll (host only, needs the edit token). Additive-only — see
   * {@link EditPollInput}. Returns the updated poll.
   */
  editPoll(
    id: string,
    input: EditPollInput,
    editToken = this.editToken,
  ): Promise<Poll> {
    if (!editToken) throw new SamkomaError("missing_edit_token", 0);
    return this.request(`/v1/polls/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${editToken}`,
      },
      body: JSON.stringify(input),
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
    if (!editToken) throw new SamkomaError("missing_edit_token", 0);
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

/**
 * Resolve a day spec into sorted, de-duplicated ISO dates. Tokens may be ISO
 * dates ("2026-07-15"), weekdays ("mon"), or weekday ranges ("mon-fri").
 * Weekdays resolve to their next upcoming occurrence. Shared with the CLI via
 * @samkoma/core; wrapped here so the published package's types stay
 * self-contained (no @samkoma/core import survives in dist).
 */
export function resolveDays(spec: string, today: Date = new Date()): string[] {
  return coreResolveDays(spec, today);
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
export function parseSamkomaCommand(
  text: string,
  opts: { defaultTz?: string; today?: Date } = {},
): ParsedCommand {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let daysSpec: string | undefined;
  let from = "09:00";
  let to = "17:00";
  let tz = opts.defaultTz ?? "UTC";

  const time = (h: string) => {
    const [hh, mm = "0"] = h.split(":");
    const H = Number(hh);
    const M = Number(mm);
    if (H > 23 || M > 59) throw new Error(`Invalid time: "${h}"`);
    return `${pad(H)}:${pad(M)}`; // "9" -> "09:00", "9:30" -> "09:30"
  };

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
