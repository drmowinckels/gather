import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const ORIGIN = "http://localhost:5173";

const validPoll = {
  title: "Team offsite",
  days: ["2026-07-15", "2026-07-16", "2026-07-17"],
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

  it("sets CORS headers for the allowed origin", async () => {
    const res = await post(validPoll);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
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
        slots: ["2026-07-15T09:00"],
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
    const slots = ["2026-07-15T09:00", "2026-07-15T09:30"];
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
    await submit(id, { name: "Ada", tz: "Europe/Oslo", slots: ["2026-07-15T09:00"] });
    await submit(id, { name: "Ada", tz: "Europe/Oslo", slots: ["2026-07-16T10:00"] });

    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { responses: Array<{ name: string; slots: string[] }> };
    expect(poll.responses).toHaveLength(1);
    expect(poll.responses[0].slots).toEqual(["2026-07-16T10:00"]);
  });

  it("rejects slots outside the poll's grid", async () => {
    const { id } = await newPoll();
    const res = await submit(id, {
      name: "Ada",
      tz: "Europe/Oslo",
      slots: ["2026-07-15T20:00"],
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
});
