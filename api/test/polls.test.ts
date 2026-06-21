import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const ORIGIN = "http://localhost:5173";

const validPoll = {
  title: "Team offsite",
  days: ["2099-07-15", "2099-07-16", "2099-07-17"],
  from: "09:00",
  to: "15:00",
  slot: 30,
  tz: "Europe/Oslo",
  public: true,
};

function post(body: unknown) {
  return SELF.fetch("https://api.test/v1/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/polls", () => {
  it("creates a poll and returns id, url and editToken", async () => {
    const res = await post(validPoll);
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      id: string;
      url: string;
      editToken: string;
    };
    expect(json.id).toMatch(/^[0-9A-Za-z]{6}$/);
    expect(json.editToken).toHaveLength(48);
    expect(json.url).toContain(`/#/e/${json.id}`);
  });

  it("rejects a malformed body with 400", async () => {
    const res = await post({ ...validPoll, from: "9am", days: [] });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_body");
  });

  it("rejects an invalid timezone", async () => {
    const res = await post({ ...validPoll, tz: "Mars/Olympus" });
    expect(res.status).toBe(400);
  });

  it("rejects impossible calendar dates", async () => {
    const res = await post({ ...validPoll, days: ["2026-13-45"] });
    expect(res.status).toBe(400);
  });

  it("sets CORS headers for the allowed origin", async () => {
    const res = await post(validPoll);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("rate-limits creation beyond CREATE_LIMIT (10 in tests)", async () => {
    let status = 0;
    for (let i = 0; i <= 10; i++) status = (await post(validPoll)).status; // 11 requests
    expect(status).toBe(429);
  });
});

describe("GET /v1/polls/:id", () => {
  it("returns a previously created poll without the edit token", async () => {
    const created = (await (await post(validPoll)).json()) as { id: string };

    const res = await SELF.fetch(`https://api.test/v1/polls/${created.id}`, {
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(200);
    const poll = (await res.json()) as Record<string, unknown>;
    expect(poll.id).toBe(created.id);
    expect(poll.title).toBe(validPoll.title);
    expect(poll.days).toEqual(validPoll.days);
    expect(poll.from).toBe("09:00");
    expect(poll.public).toBe(true);
    expect(poll.responses).toEqual([]);
    expect(poll.editToken).toBeUndefined();
    expect(poll.edit_token).toBeUndefined();
  });

  it("returns 404 for an unknown poll", async () => {
    const res = await SELF.fetch("https://api.test/v1/polls/nope00", {
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(404);
  });

  it("returns 410 for an expired poll", async () => {
    // last day 2020-01-01 + 14d grace is long past, so the poll is born expired
    const { id } = (await (
      await post({ ...validPoll, days: ["2020-01-01"] })
    ).json()) as { id: string };
    const res = await SELF.fetch(`https://api.test/v1/polls/${id}`, {
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(410);
    expect(((await res.json()) as { error: string }).error).toBe("expired");
  });
});

describe("GET /v1/polls/:id/best", () => {
  function submit(id: string, name: string, slots: string[]) {
    return SELF.fetch(`https://api.test/v1/polls/${id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ name, tz: "Europe/Oslo", slots }),
    });
  }

  it("returns ranked slots with counts and names (public poll)", async () => {
    const { id } = (await (await post(validPoll)).json()) as { id: string };
    await submit(id, "Ada", ["2099-07-15T09:00", "2099-07-15T09:30"]);
    await submit(id, "Kari", ["2099-07-15T09:00"]);

    const res = await SELF.fetch(`https://api.test/v1/polls/${id}/best`, {
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total: number;
      results: Array<{ slot: string; count: number; names: string[] }>;
    };
    expect(body.total).toBe(2);
    expect(body.results[0]).toMatchObject({
      slot: "2099-07-15T09:00",
      count: 2,
      names: ["Ada", "Kari"],
    });
    expect(body.results).toHaveLength(2);
  });

  it("honors ?limit=", async () => {
    const { id } = (await (await post(validPoll)).json()) as { id: string };
    await submit(id, "Ada", ["2099-07-15T09:00", "2099-07-15T09:30"]);
    const res = await SELF.fetch(`https://api.test/v1/polls/${id}/best?limit=1`, {
      headers: { Origin: ORIGIN },
    });
    expect(((await res.json()) as { results: unknown[] }).results).toHaveLength(1);
  });

  it("forbids results on a private poll without the edit token", async () => {
    const created = (await (
      await post({ ...validPoll, public: false })
    ).json()) as { id: string; editToken: string };
    await submit(created.id, "Ada", ["2099-07-15T09:00"]);

    const anon = await SELF.fetch(`https://api.test/v1/polls/${created.id}/best`, {
      headers: { Origin: ORIGIN },
    });
    expect(anon.status).toBe(403);

    const host = await SELF.fetch(`https://api.test/v1/polls/${created.id}/best`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${created.editToken}` },
    });
    expect(host.status).toBe(200);
  });

  it("404s for an unknown poll", async () => {
    const res = await SELF.fetch("https://api.test/v1/polls/nope00/best", {
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /v1/polls/:id/lock", () => {
  function lock(id: string, slot: string | null, token?: string) {
    return SELF.fetch(`https://api.test/v1/polls/${id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ slot }),
    });
  }

  it("lets the host lock and unlock a slot", async () => {
    const created = (await (await post(validPoll)).json()) as {
      id: string;
      editToken: string;
    };
    const slot = "2099-07-15T09:00";

    const res = await lock(created.id, slot, created.editToken);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { lockedSlot: string }).lockedSlot).toBe(slot);

    const fetched = (await (
      await SELF.fetch(`https://api.test/v1/polls/${created.id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { lockedSlot: string | null };
    expect(fetched.lockedSlot).toBe(slot);

    const unlocked = (await (
      await lock(created.id, null, created.editToken)
    ).json()) as { lockedSlot: string | null };
    expect(unlocked.lockedSlot).toBeNull();
  });

  it("forbids non-hosts (missing or wrong token)", async () => {
    const created = (await (await post(validPoll)).json()) as { id: string };
    expect((await lock(created.id, "2099-07-15T09:00")).status).toBe(403);
    expect((await lock(created.id, "2099-07-15T09:00", "nope")).status).toBe(403);
  });

  it("rejects a slot outside the poll grid", async () => {
    const created = (await (await post(validPoll)).json()) as {
      id: string;
      editToken: string;
    };
    expect((await lock(created.id, "2099-07-15T20:00", created.editToken)).status).toBe(
      400,
    );
  });
});

describe("private poll results gating", () => {
  const privatePoll = { ...validPoll, public: false };

  it("hides responses unless the edit token is presented", async () => {
    const created = (await (await post(privatePoll)).json()) as {
      id: string;
      editToken: string;
    };
    await SELF.fetch(`https://api.test/v1/polls/${created.id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({
        name: "Ada",
        tz: "Europe/Oslo",
        slots: ["2099-07-15T09:00"],
      }),
    });

    const anon = (await (
      await SELF.fetch(`https://api.test/v1/polls/${created.id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { public: boolean; responses: unknown[] };
    expect(anon.public).toBe(false);
    expect(anon.responses).toEqual([]);

    const host = (await (
      await SELF.fetch(`https://api.test/v1/polls/${created.id}`, {
        headers: { Origin: ORIGIN, Authorization: `Bearer ${created.editToken}` },
      })
    ).json()) as { responses: Array<{ name: string }> };
    expect(host.responses).toHaveLength(1);
    expect(host.responses[0].name).toBe("Ada");
  });

  it("ignores an incorrect edit token", async () => {
    const created = (await (await post(privatePoll)).json()) as { id: string };
    const res = (await (
      await SELF.fetch(`https://api.test/v1/polls/${created.id}`, {
        headers: { Origin: ORIGIN, Authorization: "Bearer wrong-token" },
      })
    ).json()) as { responses: unknown[] };
    expect(res.responses).toEqual([]);
  });
});

describe("POST /v1/polls/:id/slots", () => {
  async function newPoll() {
    return (await (await post(validPoll)).json()) as { id: string };
  }
  function submit(id: string, body: unknown) {
    return SELF.fetch(`https://api.test/v1/polls/${id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify(body),
    });
  }

  it("saves availability and surfaces it on the poll", async () => {
    const { id } = await newPoll();
    const slots = ["2099-07-15T09:00", "2099-07-15T09:30"];
    const res = await submit(id, { name: "Ada", tz: "Europe/Oslo", slots });
    expect(res.status).toBe(200);
    const saved = (await res.json()) as { name: string; slots: string[] };
    expect(saved.name).toBe("Ada");
    expect(saved.slots).toEqual(slots);

    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { responses: Array<{ name: string; slots: string[] }> };
    expect(poll.responses).toHaveLength(1);
    expect(poll.responses[0]).toMatchObject({ name: "Ada", slots });
  });

  it("upserts the same name instead of duplicating", async () => {
    const { id } = await newPoll();
    await submit(id, { name: "Ada", tz: "Europe/Oslo", slots: ["2099-07-15T09:00"] });
    await submit(id, { name: "Ada", tz: "Europe/Oslo", slots: ["2099-07-16T10:00"] });

    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { responses: Array<{ name: string; slots: string[] }> };
    expect(poll.responses).toHaveLength(1);
    expect(poll.responses[0].slots).toEqual(["2099-07-16T10:00"]);
  });

  it("rejects slots outside the poll's grid", async () => {
    const { id } = await newPoll();
    const res = await submit(id, {
      name: "Ada",
      tz: "Europe/Oslo",
      slots: ["2099-07-15T20:00"],
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_slots");
  });

  it("returns 404 when the poll does not exist", async () => {
    const res = await submit("nope00", {
      name: "Ada",
      tz: "Europe/Oslo",
      slots: [],
    });
    expect(res.status).toBe(404);
  });

  it("stores 'maybe' availability, disjoint from 'available'", async () => {
    const { id } = await newPoll();
    await submit(id, {
      name: "Ada",
      tz: "Europe/Oslo",
      slots: ["2099-07-15T09:00"],
      maybe: ["2099-07-15T09:00", "2099-07-15T09:30"], // 09:00 also available -> dropped
    });
    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { responses: Array<{ slots: string[]; maybe: string[] }> };
    expect(poll.responses[0].slots).toEqual(["2099-07-15T09:00"]);
    expect(poll.responses[0].maybe).toEqual(["2099-07-15T09:30"]);
  });

  it("caps distinct respondents at MAX_RESPONSES (3 in tests)", async () => {
    const { id } = await newPoll();
    let status = 0;
    for (const name of ["A", "B", "C", "D"]) {
      status = (
        await submit(id, { name, tz: "Europe/Oslo", slots: ["2099-07-15T09:00"] })
      ).status;
    }
    expect(status).toBe(429); // 4th distinct respondent rejected
  });
});
