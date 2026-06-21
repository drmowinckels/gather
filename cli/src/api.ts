import type { PollBody } from "./lib.js";

export interface CreatedPoll {
  id: string;
  url: string;
  editToken: string;
}

export interface BestResult {
  total: number;
  results: Array<{ slot: string; count: number; names: string[] }>;
}

export interface Poll {
  id: string;
  title: string;
  lockedSlot: string | null;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(`samkoma API error: ${code} (${status})`);
    this.name = "ApiError";
  }
}

async function toError(res: Response): Promise<ApiError> {
  let code = "request_failed";
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) code = body.error;
  } catch {
    // non-JSON body
  }
  return new ApiError(code, res.status);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

export function createPoll(api: string, body: PollBody): Promise<CreatedPoll> {
  return request(`${api}/v1/polls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getBest(
  api: string,
  id: string,
  limit?: number,
): Promise<BestResult> {
  const q = limit ? `?limit=${limit}` : "";
  return request(`${api}/v1/polls/${encodeURIComponent(id)}/best${q}`);
}

export function lockSlot(
  api: string,
  id: string,
  slot: string | null,
  token: string,
): Promise<Poll> {
  return request(`${api}/v1/polls/${encodeURIComponent(id)}/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ slot }),
  });
}
