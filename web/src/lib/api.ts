const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export interface PollInput {
  title: string;
  days: string[];
  from: string;
  to: string;
  slot: number;
  tz: string;
  public: boolean;
}

export interface CreatedPoll {
  id: string;
  url: string;
  editToken: string;
}

export interface Response {
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
  createdAt: string;
  responses: Response[];
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(code: string, status: number) {
    super(`gather API error: ${code} (${status})`);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function toError(res: globalThis.Response): Promise<ApiError> {
  let code = "request_failed";
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) code = body.error;
  } catch {
    // non-JSON body; keep the generic code
  }
  return new ApiError(code, res.status);
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

export async function getPoll(id: string): Promise<Poll> {
  const res = await fetch(`${API_BASE}/v1/polls/${encodeURIComponent(id)}`);
  if (!res.ok) throw await toError(res);
  return (await res.json()) as Poll;
}

export interface SlotsInput {
  name: string;
  tz: string;
  slots: string[];
}

export async function submitSlots(
  id: string,
  input: SlotsInput,
): Promise<Response> {
  const res = await fetch(
    `${API_BASE}/v1/polls/${encodeURIComponent(id)}/slots`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw await toError(res);
  return (await res.json()) as Response;
}
