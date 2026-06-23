import { describe, it, expect, vi, afterEach } from "vitest";
import {
  SamkomaClient,
  SamkomaError,
  resolveDays,
  parseWeekdays,
  parseSamkomaCommand,
} from "../src/index.js";

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const client = new SamkomaClient({ baseUrl: "https://api.example/" });

describe("SamkomaClient", () => {
  it("creates a poll at the configured base URL", async () => {
    const fn = mockFetch({ id: "abc", url: "u", editToken: "t" }, 201);
    const created = await client.createPoll({
      title: "x",
      days: ["2026-07-15"],
      from: "09:00",
      to: "10:00",
      slot: 30,
      tz: "UTC",
      public: true,
    });
    expect(created.id).toBe("abc");
    expect(fn.mock.calls[0][0]).toBe("https://api.example/v1/polls"); // trailing slash trimmed
  });

  it("sends the edit token when reading a poll", async () => {
    const fn = mockFetch({ id: "abc", responses: [] });
    await client.getPoll("abc", "secret");
    expect(fn.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer secret",
    });
  });

  it("builds the best query and forwards the token", async () => {
    const fn = mockFetch({ total: 0, results: [] });
    await client.getBest("abc", { limit: 3, editToken: "t" });
    expect(fn.mock.calls[0][0]).toBe(
      "https://api.example/v1/polls/abc/best?limit=3",
    );
    expect(fn.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer t" });
  });

  it("locks with the edit token and refuses without one", async () => {
    const fn = mockFetch({ id: "abc", lockedSlot: "2026-07-15T09:00" });
    await client.lock("abc", "2026-07-15T09:00", "tok");
    expect(JSON.parse(fn.mock.calls[0][1].body)).toEqual({
      slot: "2026-07-15T09:00",
    });
    expect(fn.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");

    await expect(client.lock("abc", "2026-07-15T09:00")).rejects.toBeInstanceOf(
      SamkomaError,
    );
  });

  it("edits a poll with PATCH and the edit token, refusing without one", async () => {
    const fn = mockFetch({ id: "abc", title: "Renamed" });
    await client.editPoll("abc", { title: "Renamed" }, "tok");
    expect(fn.mock.calls[0][0]).toBe("https://api.example/v1/polls/abc");
    expect(fn.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fn.mock.calls[0][1].body)).toEqual({ title: "Renamed" });
    expect(fn.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");

    expect(() => client.editPoll("abc", { title: "x" })).toThrow(SamkomaError);
  });

  it("maps an error response to SamkomaError", async () => {
    mockFetch({ error: "rate_limited" }, 429);
    await expect(
      client.createPoll({
        title: "x",
        days: ["2026-07-15"],
        from: "09:00",
        to: "10:00",
        slot: 30,
        tz: "UTC",
        public: true,
      }),
    ).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });
});

describe("resolveDays", () => {
  const today = new Date(2026, 5, 20);
  it("passes through ISO dates sorted + deduped", () => {
    expect(resolveDays("2026-07-16,2026-07-15,2026-07-15", today)).toEqual([
      "2026-07-15",
      "2026-07-16",
    ]);
  });
  it("expands a weekday range", () => {
    const days = resolveDays("mon-fri", today);
    expect(days).toHaveLength(5);
    expect(days.map((d) => new Date(`${d}T00:00:00`).getDay()).sort()).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });
  it("rejects junk", () => {
    expect(() => resolveDays("nope", today)).toThrow();
  });
});

describe("parseWeekdays", () => {
  it("returns weekday tokens (not dates), week-ordered", () => {
    expect(parseWeekdays("fri,mon")).toEqual(["mon", "fri"]);
    expect(parseWeekdays("mon-wed")).toEqual(["mon", "tue", "wed"]);
  });
  it("rejects junk", () => {
    expect(() => parseWeekdays("nope")).toThrow();
  });
});

describe("parseSamkomaCommand", () => {
  const today = new Date(2026, 5, 20);
  it("parses the reference grammar", () => {
    const cmd = parseSamkomaCommand("tue-thu 9-15 tz:Europe/Oslo", { today });
    expect(cmd.from).toBe("09:00");
    expect(cmd.to).toBe("15:00");
    expect(cmd.tz).toBe("Europe/Oslo");
    expect(cmd.days).toHaveLength(3);
    expect(
      cmd.days.map((d) => new Date(`${d}T00:00:00`).getDay()).sort(),
    ).toEqual([2, 3, 4]); // Tue, Wed, Thu
  });
  it("accepts HH:MM ranges and a default tz", () => {
    const cmd = parseSamkomaCommand("mon 09:30-12:00", {
      today,
      defaultTz: "UTC",
    });
    expect(cmd).toMatchObject({ from: "09:30", to: "12:00", tz: "UTC" });
    expect(cmd.days).toHaveLength(1);
  });

  it("zero-pads single-digit hours (incl. with minutes) to valid HH:MM", () => {
    const cmd = parseSamkomaCommand("mon 9:30-9:45", {
      today,
      defaultTz: "UTC",
    });
    expect(cmd).toMatchObject({ from: "09:30", to: "09:45" });
  });
  it("throws when no days are present", () => {
    expect(() => parseSamkomaCommand("9-15 tz:UTC", { today })).toThrow();
  });

  it("rejects out-of-range times instead of emitting a malformed body", () => {
    expect(() => parseSamkomaCommand("mon 25-30", { today })).toThrow(
      /invalid time/i,
    );
    expect(() => parseSamkomaCommand("mon 9:75-10:00", { today })).toThrow(
      /invalid time/i,
    );
  });
});
