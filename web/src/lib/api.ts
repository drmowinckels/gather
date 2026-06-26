// A production build with no VITE_API_BASE would silently call localhost and
// fail opaquely in users' browsers; fail the build/load loudly instead. Dev and
// tests fall back to the local Worker.
export function resolveApiBase(
  base: string | undefined,
  isProd: boolean,
): string {
  if (base) return base;
  if (isProd)
    throw new Error("VITE_API_BASE must be set for production builds");
  return "http://localhost:8787";
}

const API_BASE: string = resolveApiBase(
  import.meta.env.VITE_API_BASE,
  import.meta.env.PROD,
);

export type PollKind = "dates" | "weekdays";

export interface PollInput {
  title: string;
  kind: PollKind;
  days: string[];
  from: string;
  to: string;
  slot: number;
  tz: string;
  public: boolean;
  resultsHidden?: boolean;
  deadline?: string; // ISO 8601; responses freeze once passed
  capacity?: number; // optional per-slot capacity (indicative "full")
  defaultAvailable?: boolean; // respondents start fully available
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
  // Optional self-assigned group/team label, for per-group tallies.
  group?: string;
  updatedAt: string;
  // One-time secret returned only on the first, unprotected write of a name.
  responseToken?: string;
}

export interface Poll {
  id: string;
  title: string;
  kind: PollKind;
  days: string[];
  from: string;
  to: string;
  slot: number;
  tz: string;
  public: boolean;
  resultsHidden: boolean;
  deadline: string | null;
  closedAt: string | null;
  closed: boolean;
  lockedSlot: string | null;
  expiresAt: string | null;
  capacity: number | null;
  defaultAvailable: boolean;
  createdAt: string;
  responses: PollResponse[];
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(code: string, status: number) {
    super(`samkoma API error: ${code} (${status})`);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function toError(res: Response): Promise<ApiError> {
  let code = "request_failed";
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) code = body.error;
  } catch {
    // non-JSON body; keep the generic code
  }
  return new ApiError(code, res.status);
}

// Direct URL to the locked slot's calendar export. The endpoint sets
// Content-Disposition: attachment, so an <a> to it downloads the .ics.
export function icsUrl(id: string): string {
  return `${API_BASE}/v1/polls/${encodeURIComponent(id)}/ics`;
}

// The Worker serves an interactive Scalar reference (with a "try it" runner) at
// /docs, off the same base the app calls. The web app renders its own static
// reference from a bundled spec; this link is the live, executable console.
export function apiDocsUrl(): string {
  return `${API_BASE}/docs`;
}

export async function createPoll(input: PollInput): Promise<CreatedPoll> {
  const res = await fetch(`${API_BASE}/v1/polls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as CreatedPoll;
}

export async function getPoll(id: string, editToken?: string): Promise<Poll> {
  const res = await fetch(`${API_BASE}/v1/polls/${encodeURIComponent(id)}`, {
    headers: editToken ? { Authorization: `Bearer ${editToken}` } : undefined,
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as Poll;
}

export interface SlotsInput {
  name: string;
  tz: string;
  slots: string[];
  maybe: string[];
  // Optional self-assigned group/team label.
  group?: string;
  // The secret that owns this name (stored token or chosen password); omitted on
  // a first write.
  secret?: string;
}

export async function submitSlots(
  id: string,
  input: SlotsInput,
): Promise<PollResponse> {
  const res = await fetch(
    `${API_BASE}/v1/polls/${encodeURIComponent(id)}/slots`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw await toError(res);
  return (await res.json()) as PollResponse;
}

export interface EditPollInput {
  title?: string;
  days?: string[];
  from?: string;
  to?: string;
  slot?: number;
  public?: boolean;
  resultsHidden?: boolean;
  deadline?: string | null; // set or clear the response deadline
  closed?: boolean; // close now (true) / reopen (false)
}

export async function editPoll(
  id: string,
  input: EditPollInput,
  editToken: string,
): Promise<Poll> {
  const res = await fetch(`${API_BASE}/v1/polls/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${editToken}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as Poll;
}

export async function lockSlot(
  id: string,
  slot: string | null,
  editToken: string,
): Promise<Poll> {
  const res = await fetch(
    `${API_BASE}/v1/polls/${encodeURIComponent(id)}/lock`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${editToken}`,
      },
      body: JSON.stringify({ slot }),
    },
  );
  if (!res.ok) throw await toError(res);
  return (await res.json()) as Poll;
}
