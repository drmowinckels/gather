import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createPoll,
  getPoll,
  submitSlots,
  lockSlot,
  editPoll,
  resolveApiBase,
  ApiError,
  type PollInput,
} from "./api";

const input: PollInput = {
  title: "Team offsite",
  kind: "dates",
  days: ["2026-07-15", "2026-07-16"],
  from: "09:00",
  to: "15:00",
  slot: 30,
  tz: "Europe/Oslo",
  public: true,
};

describe("resolveApiBase", () => {
  it("uses the configured base when present", () => {
    expect(resolveApiBase("https://api.example", true)).toBe(
      "https://api.example",
    );
  });
  it("throws on a production build with no base", () => {
    expect(() => resolveApiBase(undefined, true)).toThrow(/VITE_API_BASE/);
  });
  it("falls back to the local Worker in dev", () => {
    expect(resolveApiBase(undefined, false)).toBe("http://localhost:8787");
  });
});

function mockFetch(body: unknown, init: { status?: number } = {}) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createPoll", () => {
  it("POSTs the input as JSON and returns the created poll", async () => {
    const fn = mockFetch(
      { id: "9fK2qd", url: "x/#/e/9fK2qd", editToken: "tok" },
      { status: 201 },
    );

    const created = await createPoll(input);

    expect(created.id).toBe("9fK2qd");
    const [url, opts] = fn.mock.calls[0];
    expect(url).toBe("http://localhost:8787/v1/polls");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(input);
  });

  it("throws an ApiError carrying the server error code on 400", async () => {
    mockFetch({ error: "invalid_body" }, { status: 400 });
    await expect(createPoll(input)).rejects.toMatchObject({
      code: "invalid_body",
      status: 400,
    });
  });
});

describe("getPoll", () => {
  it("fetches a poll by id", async () => {
    const fn = mockFetch({ id: "abc123", title: "Lunch", responses: [] });
    const poll = await getPoll("abc123");
    expect(poll.title).toBe("Lunch");
    expect(fn.mock.calls[0][0]).toBe("http://localhost:8787/v1/polls/abc123");
  });

  it("throws a 404 ApiError for an unknown poll", async () => {
    mockFetch({ error: "not_found" }, { status: 404 });
    const err = await getPoll("nope").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });

  it("sends the edit token as a Bearer header when provided", async () => {
    const fn = mockFetch({ id: "abc123", responses: [] });
    await getPoll("abc123", "secret-token");
    const [, opts] = fn.mock.calls[0];
    expect(opts.headers).toEqual({ Authorization: "Bearer secret-token" });
  });

  it("omits the Authorization header when no token is given", async () => {
    const fn = mockFetch({ id: "abc123", responses: [] });
    await getPoll("abc123");
    const [, opts] = fn.mock.calls[0];
    expect(opts.headers).toBeUndefined();
  });
});

describe("submitSlots", () => {
  it("POSTs name, tz and slots to the poll's slots endpoint", async () => {
    const fn = mockFetch({
      name: "Ada",
      tz: "Europe/Oslo",
      slots: ["2026-07-15T09:00"],
      updatedAt: "2026-07-01T00:00:00Z",
    });
    const saved = await submitSlots("abc123", {
      name: "Ada",
      tz: "Europe/Oslo",
      slots: ["2026-07-15T09:00"],
      maybe: [],
    });
    expect(saved.name).toBe("Ada");
    const [url, opts] = fn.mock.calls[0];
    expect(url).toBe("http://localhost:8787/v1/polls/abc123/slots");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).slots).toEqual(["2026-07-15T09:00"]);
  });

  it("throws on an invalid_slots rejection", async () => {
    mockFetch({ error: "invalid_slots" }, { status: 400 });
    await expect(
      submitSlots("abc123", {
        name: "Ada",
        tz: "UTC",
        slots: ["x"],
        maybe: [],
      }),
    ).rejects.toMatchObject({ code: "invalid_slots", status: 400 });
  });
});

describe("lockSlot", () => {
  it("POSTs the slot with the edit token as a Bearer header", async () => {
    const fn = mockFetch({ id: "abc123", lockedSlot: "2026-07-15T09:00" });
    const poll = await lockSlot("abc123", "2026-07-15T09:00", "tok");
    expect(poll.lockedSlot).toBe("2026-07-15T09:00");
    const [url, opts] = fn.mock.calls[0];
    expect(url).toBe("http://localhost:8787/v1/polls/abc123/lock");
    expect(opts.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(opts.body)).toEqual({ slot: "2026-07-15T09:00" });
  });

  it("sends slot null to unlock", async () => {
    const fn = mockFetch({ id: "abc123", lockedSlot: null });
    await lockSlot("abc123", null, "tok");
    expect(JSON.parse(fn.mock.calls[0][1].body)).toEqual({ slot: null });
  });
});

describe("editPoll", () => {
  it("PATCHes the partial body with the edit token", async () => {
    const fn = mockFetch({
      id: "abc123",
      title: "Renamed",
      days: ["2026-07-15"],
    });
    const poll = await editPoll("abc123", { title: "Renamed" }, "tok");
    expect(poll.title).toBe("Renamed");
    const [url, opts] = fn.mock.calls[0];
    expect(url).toBe("http://localhost:8787/v1/polls/abc123");
    expect(opts.method).toBe("PATCH");
    expect(opts.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(opts.body)).toEqual({ title: "Renamed" });
  });

  it("throws the server's code on a non-additive edit", async () => {
    mockFetch(
      { error: "not_additive", removed: ["2026-07-16T09:00"] },
      { status: 400 },
    );
    await expect(
      editPoll("abc123", { days: ["2026-07-15"] }, "tok"),
    ).rejects.toMatchObject({ code: "not_additive", status: 400 });
  });
});
