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
    const res = await SELF.fetch(
      `https://api.test/v1/polls/${id}/best?limit=1`,
      {
        headers: { Origin: ORIGIN },
      },
    );
    expect(((await res.json()) as { results: unknown[] }).results).toHaveLength(
      1,
    );
  });

  it("forbids results on a private poll without the edit token", async () => {
    const created = (await (
      await post({ ...validPoll, public: false })
    ).json()) as { id: string; editToken: string };
    await submit(created.id, "Ada", ["2099-07-15T09:00"]);

    const anon = await SELF.fetch(
      `https://api.test/v1/polls/${created.id}/best`,
      {
        headers: { Origin: ORIGIN },
      },
    );
    expect(anon.status).toBe(403);

    const host = await SELF.fetch(
      `https://api.test/v1/polls/${created.id}/best`,
      {
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${created.editToken}`,
        },
      },
    );
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
    expect(((await res.json()) as { lockedSlot: string }).lockedSlot).toBe(
      slot,
    );

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
    expect((await lock(created.id, "2099-07-15T09:00", "nope")).status).toBe(
      403,
    );
  });

  it("rejects a slot outside the poll grid", async () => {
    const created = (await (await post(validPoll)).json()) as {
      id: string;
      editToken: string;
    };
    expect(
      (await lock(created.id, "2099-07-15T20:00", created.editToken)).status,
    ).toBe(400);
  });
});

describe("GET /v1/polls/:id/ics", () => {
  function lock(id: string, slot: string | null, token: string) {
    return SELF.fetch(`https://api.test/v1/polls/${id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ slot }),
    });
  }
  function ics(id: string) {
    return SELF.fetch(`https://api.test/v1/polls/${id}/ics`, {
      headers: { Origin: ORIGIN },
    });
  }

  it("exports the locked slot as a calendar (correct tz, attachment headers)", async () => {
    const { id, editToken } = (await (await post(validPoll)).json()) as {
      id: string;
      editToken: string;
    };
    await lock(id, "2099-07-15T09:00", editToken);

    const res = await ics(id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(res.headers.get("content-disposition")).toContain(".ics");
    const body = await res.text();
    expect(body).toContain("BEGIN:VEVENT");
    // 09:00 Oslo (CEST) -> 07:00 UTC
    expect(body).toContain("DTSTART:20990715T070000Z");
    expect(body).toContain("SUMMARY:Team offsite");
  });

  it("409s when no slot is locked", async () => {
    const { id } = (await (await post(validPoll)).json()) as { id: string };
    const res = await ics(id);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("not_locked");
  });

  it("emits a weekly RRULE for a locked weekday poll", async () => {
    const created = (await (
      await post({
        title: "Weekly standup",
        kind: "weekdays",
        days: ["mon", "wed"],
        from: "09:00",
        to: "11:00",
        slot: 30,
        tz: "Europe/Oslo",
        public: true,
      })
    ).json()) as { id: string; editToken: string };
    await lock(created.id, "monT09:00", created.editToken);

    const body = await (await ics(created.id)).text();
    expect(body).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
  });

  it("404s for an unknown poll", async () => {
    expect((await ics("nope00")).status).toBe(404);
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
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${created.editToken}`,
        },
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

describe("hidden results (host curtain)", () => {
  function submit(id: string, name: string) {
    return SELF.fetch(`https://api.test/v1/polls/${id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({
        name,
        tz: "Europe/Oslo",
        slots: ["2099-07-15T09:00"],
      }),
    });
  }
  function get(id: string, token?: string) {
    return SELF.fetch(`https://api.test/v1/polls/${id}`, {
      headers: {
        Origin: ORIGIN,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }
  function best(id: string, token?: string) {
    return SELF.fetch(`https://api.test/v1/polls/${id}/best`, {
      headers: {
        Origin: ORIGIN,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  it("curtains results from non-hosts on a public poll, but the host still sees them", async () => {
    const created = (await (
      await post({ ...validPoll, resultsHidden: true })
    ).json()) as { id: string; editToken: string };
    await submit(created.id, "Ada");

    const anon = (await (await get(created.id)).json()) as {
      resultsHidden: boolean;
      responses: unknown[];
    };
    expect(anon.resultsHidden).toBe(true);
    expect(anon.responses).toEqual([]);
    expect((await best(created.id)).status).toBe(403);

    expect((await best(created.id, created.editToken)).status).toBe(200);
    const host = (await (await get(created.id, created.editToken)).json()) as {
      responses: unknown[];
    };
    expect(host.responses).toHaveLength(1);
  });

  it("reveals results when the host clears the flag", async () => {
    const created = (await (
      await post({ ...validPoll, resultsHidden: true })
    ).json()) as { id: string; editToken: string };
    await submit(created.id, "Ada");
    expect((await best(created.id)).status).toBe(403);

    const patched = await SELF.fetch(
      `https://api.test/v1/polls/${created.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: ORIGIN,
          Authorization: `Bearer ${created.editToken}`,
        },
        body: JSON.stringify({ resultsHidden: false }),
      },
    );
    expect(
      ((await patched.json()) as { resultsHidden: boolean }).resultsHidden,
    ).toBe(false);
    expect((await best(created.id)).status).toBe(200);
  });

  it("defaults resultsHidden to false", async () => {
    const { id } = (await (await post(validPoll)).json()) as { id: string };
    const poll = (await (await get(id)).json()) as { resultsHidden: boolean };
    expect(poll.resultsHidden).toBe(false);
  });
});

describe("response deadline + manual close", () => {
  function submit(id: string, name = "Ada") {
    return SELF.fetch(`https://api.test/v1/polls/${id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({
        name,
        tz: "Europe/Oslo",
        slots: ["2099-07-15T09:00"],
      }),
    });
  }
  function patch(id: string, body: unknown, token: string) {
    return SELF.fetch(`https://api.test/v1/polls/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  it("freezes responses once the host closes the poll, and reopens", async () => {
    const created = (await (await post(validPoll)).json()) as {
      id: string;
      editToken: string;
    };
    expect((await submit(created.id)).status).toBe(200);

    const closed = (await (
      await patch(created.id, { closed: true }, created.editToken)
    ).json()) as { closed: boolean; closedAt: string };
    expect(closed.closed).toBe(true);
    expect(closed.closedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const blocked = await submit(created.id);
    expect(blocked.status).toBe(409);
    expect(((await blocked.json()) as { error: string }).error).toBe("closed");

    // still readable (200, not 410)
    expect(
      (
        await SELF.fetch(`https://api.test/v1/polls/${created.id}`, {
          headers: { Origin: ORIGIN },
        })
      ).status,
    ).toBe(200);

    // host can still lock a slot on a closed poll
    expect(
      (
        await SELF.fetch(`https://api.test/v1/polls/${created.id}/lock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: ORIGIN,
            Authorization: `Bearer ${created.editToken}`,
          },
          body: JSON.stringify({ slot: "2099-07-15T09:00" }),
        })
      ).status,
    ).toBe(200);

    await patch(created.id, { closed: false }, created.editToken);
    // A fresh name (Ada is now claimed by the ownership feature) confirms writes
    // are unfrozen after reopening.
    expect((await submit(created.id, "Bob")).status).toBe(200);
  });

  it("freezes responses once a deadline has passed", async () => {
    const past = (await (
      await post({ ...validPoll, deadline: "2020-01-01T00:00:00Z" })
    ).json()) as { id: string };
    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${past.id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { closed: boolean; deadline: string };
    expect(poll.deadline).toBe("2020-01-01T00:00:00Z");
    expect(poll.closed).toBe(true);
    expect((await submit(past.id)).status).toBe(409);
  });

  it("stays open before a future deadline", async () => {
    const future = (await (
      await post({ ...validPoll, deadline: "2099-12-31T00:00:00Z" })
    ).json()) as { id: string };
    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${future.id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { closed: boolean };
    expect(poll.closed).toBe(false);
    expect((await submit(future.id)).status).toBe(200);
  });

  it("reopening a deadline-closed poll clears the elapsed deadline", async () => {
    const created = (await (
      await post({ ...validPoll, deadline: "2020-01-01T00:00:00Z" })
    ).json()) as { id: string; editToken: string };
    expect((await submit(created.id)).status).toBe(409);

    const reopened = (await (
      await patch(created.id, { closed: false }, created.editToken)
    ).json()) as { closed: boolean; deadline: string | null };
    expect(reopened.deadline).toBeNull();
    expect(reopened.closed).toBe(false);
    expect((await submit(created.id, "Bo")).status).toBe(200);
  });

  it("reopening keeps a still-future deadline", async () => {
    const created = (await (
      await post({ ...validPoll, deadline: "2099-12-31T00:00:00Z" })
    ).json()) as { id: string; editToken: string };
    const reopened = (await (
      await patch(created.id, { closed: false }, created.editToken)
    ).json()) as { deadline: string | null };
    expect(reopened.deadline).toBe("2099-12-31T00:00:00Z");
  });

  it("forbids a non-host from closing", async () => {
    const { id } = (await (await post(validPoll)).json()) as { id: string };
    expect((await patch(id, { closed: true }, "nope")).status).toBe(403);
  });
});

describe("PATCH /v1/polls/:id", () => {
  function patch(id: string, body: unknown, token?: string) {
    return SELF.fetch(`https://api.test/v1/polls/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }
  function submit(id: string, name: string, slots: string[]) {
    return SELF.fetch(`https://api.test/v1/polls/${id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ name, tz: "Europe/Oslo", slots }),
    });
  }
  async function newPoll(overrides: Record<string, unknown> = {}) {
    return (await (await post({ ...validPoll, ...overrides })).json()) as {
      id: string;
      editToken: string;
    };
  }

  it("lets the host rename a poll", async () => {
    const { id, editToken } = await newPoll();
    const res = await patch(id, { title: "Renamed" }, editToken);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { title: string }).title).toBe("Renamed");

    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { title: string };
    expect(poll.title).toBe("Renamed");
  });

  it("lets the host add a day and extends the expiry", async () => {
    const { id, editToken } = await newPoll();
    const days = [...validPoll.days, "2099-07-18"];
    const res = await patch(id, { days }, editToken);
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { days: string[]; expiresAt: string };
    expect(updated.days).toEqual(days);
    expect(updated.expiresAt).toBe("2099-08-01"); // 2099-07-18 + 14d grace
  });

  it("lets the host extend the window when slot-aligned", async () => {
    const { id, editToken } = await newPoll();
    const res = await patch(id, { from: "08:00", to: "16:00" }, editToken);
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { from: string; to: string };
    expect(updated.from).toBe("08:00");
    expect(updated.to).toBe("16:00");
  });

  it("lets the host toggle visibility", async () => {
    const { id, editToken } = await newPoll({ public: false });
    const res = await patch(id, { public: true }, editToken);
    expect(((await res.json()) as { public: boolean }).public).toBe(true);
  });

  it("preserves existing responses across an additive edit", async () => {
    const { id, editToken } = await newPoll();
    await submit(id, "Ada", ["2099-07-15T09:00"]);
    await patch(id, { days: [...validPoll.days, "2099-07-18"] }, editToken);

    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { responses: Array<{ name: string; slots: string[] }> };
    expect(poll.responses).toHaveLength(1);
    expect(poll.responses[0]).toMatchObject({
      name: "Ada",
      slots: ["2099-07-15T09:00"],
    });
  });

  it("forbids non-hosts (missing or wrong token)", async () => {
    const { id } = await newPoll();
    expect((await patch(id, { title: "x" })).status).toBe(403);
    expect((await patch(id, { title: "x" }, "nope")).status).toBe(403);
  });

  it("rejects removing a day", async () => {
    const { id, editToken } = await newPoll();
    const res = await patch(id, { days: ["2099-07-15"] }, editToken);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "not_additive",
    );
  });

  it("rejects shrinking the window", async () => {
    const { id, editToken } = await newPoll();
    const res = await patch(id, { to: "12:00" }, editToken);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "not_additive",
    );
  });

  it("rejects extending the window off the slot grid", async () => {
    const { id, editToken } = await newPoll(); // 30-min slots from 09:00
    const res = await patch(id, { from: "08:45" }, editToken);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "not_additive",
    );
  });

  it("rejects changing the slot length", async () => {
    const { id, editToken } = await newPoll(); // slot 30
    const res = await patch(id, { slot: 60 }, editToken);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "slot_change_unsupported",
    );
  });

  it("rejects a merged window where from is not before to", async () => {
    const { id, editToken } = await newPoll(); // from 09:00, to 15:00
    const res = await patch(id, { to: "08:00" }, editToken);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "from_after_to",
    );
  });

  it("rejects an empty body", async () => {
    const { id, editToken } = await newPoll();
    const res = await patch(id, {}, editToken);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "invalid_body",
    );
  });

  it("404s for an unknown poll", async () => {
    const res = await patch("nope00", { title: "x" }, "tok");
    expect(res.status).toBe(404);
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

  it("upserts the same name (with its token) instead of duplicating", async () => {
    const { id } = await newPoll();
    const first = (await (
      await submit(id, {
        name: "Ada",
        tz: "Europe/Oslo",
        slots: ["2099-07-15T09:00"],
      })
    ).json()) as { responseToken: string };
    expect(first.responseToken).toMatch(/^[0-9a-f]{48}$/);
    await submit(id, {
      name: "Ada",
      tz: "Europe/Oslo",
      slots: ["2099-07-16T10:00"],
      secret: first.responseToken,
    });

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
    expect(((await res.json()) as { error: string }).error).toBe(
      "invalid_slots",
    );
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

  it("rate-limits submissions beyond SUBMIT_LIMIT (10 in tests)", async () => {
    const { id } = await newPoll();
    // First write claims the name and returns its token; re-using it (same name
    // upserts, never hitting the distinct-respondent cap) isolates the per-IP
    // submission throttle.
    const token = (
      (await (
        await submit(id, {
          name: "Ada",
          tz: "Europe/Oslo",
          slots: ["2099-07-15T09:00"],
        })
      ).json()) as { responseToken: string }
    ).responseToken;
    let res!: Response;
    for (let i = 0; i < 10; i++) {
      res = await submit(id, {
        name: "Ada",
        tz: "Europe/Oslo",
        slots: ["2099-07-15T09:00"],
        secret: token,
      });
    }
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toBe(
      "rate_limited",
    );
  });

  it("caps distinct respondents at MAX_RESPONSES (3 in tests)", async () => {
    const { id } = await newPoll();
    let status = 0;
    for (const name of ["A", "B", "C", "D"]) {
      status = (
        await submit(id, {
          name,
          tz: "Europe/Oslo",
          slots: ["2099-07-15T09:00"],
        })
      ).status;
    }
    expect(status).toBe(429); // 4th distinct respondent rejected
  });
});

describe("response ownership (overwrite protection)", () => {
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
  const base = { tz: "Europe/Oslo", slots: ["2099-07-15T09:00"] };

  it("auto-claims a name and returns a one-time token for the first writer", async () => {
    const { id } = await newPoll();
    const res = await submit(id, { name: "Ada", ...base });
    const json = (await res.json()) as { responseToken?: string };
    expect(res.status).toBe(200);
    expect(json.responseToken).toMatch(/^[0-9a-f]{48}$/);
  });

  it("rejects a re-write of a claimed name without its token (403)", async () => {
    const { id } = await newPoll();
    await submit(id, { name: "Ada", ...base });
    const res = await submit(id, { name: "Ada", ...base, slots: [] });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe(
      "name_protected",
    );
  });

  it("rejects a wrong token but accepts the right one", async () => {
    const { id } = await newPoll();
    const token = (
      (await (await submit(id, { name: "Ada", ...base })).json()) as {
        responseToken: string;
      }
    ).responseToken;
    expect(
      (await submit(id, { name: "Ada", ...base, secret: "nope" })).status,
    ).toBe(403);
    expect(
      (await submit(id, { name: "Ada", ...base, secret: token })).status,
    ).toBe(200);
  });

  it("lets a respondent set their own password and re-edit with it", async () => {
    const { id } = await newPoll();
    const first = (await (
      await submit(id, { name: "Ada", ...base, secret: "pw123" })
    ).json()) as { responseToken?: string };
    // A user-supplied secret is the claim; no auto-token is minted.
    expect(first.responseToken).toBeUndefined();
    expect((await submit(id, { name: "Ada", ...base })).status).toBe(403);
    expect(
      (await submit(id, { name: "Ada", ...base, secret: "pw123" })).status,
    ).toBe(200);
  });

  it("does not leak secret_hash in the poll response", async () => {
    const { id } = await newPoll();
    await submit(id, { name: "Ada", ...base });
    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { responses: Array<Record<string, unknown>> };
    expect(poll.responses[0]).not.toHaveProperty("secret_hash");
    expect(poll.responses[0]).not.toHaveProperty("secretHash");
  });
});

describe("weekday polls", () => {
  const weekdayPoll = {
    title: "Weekly standup",
    kind: "weekdays",
    days: ["fri", "mon", "wed"],
    from: "09:00",
    to: "11:00",
    slot: 30,
    tz: "Europe/Oslo",
    public: true,
  };

  it("creates a weekday poll, stores week-ordered days and a from-creation expiry", async () => {
    const { id } = (await (await post(weekdayPoll)).json()) as { id: string };
    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { kind: string; days: string[]; expiresAt: string };
    expect(poll.kind).toBe("weekdays");
    expect(poll.days).toEqual(["mon", "wed", "fri"]); // sorted by week order
    // Expiry is a real date in the future (60 days from creation), not derived
    // from weekday tokens.
    expect(poll.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(poll.expiresAt > new Date().toISOString().slice(0, 10)).toBe(true);
  });

  it("accepts weekday slot keys and ranks them", async () => {
    const { id } = (await (await post(weekdayPoll)).json()) as { id: string };
    await SELF.fetch(`https://api.test/v1/polls/${id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({
        name: "Ada",
        tz: "Europe/Oslo",
        slots: ["monT09:00", "wedT09:00"],
      }),
    });
    const best = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}/best`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { results: Array<{ slot: string; count: number }> };
    expect(best.results.map((r) => r.slot)).toContain("monT09:00");
  });

  it("rejects a weekday key outside the poll grid", async () => {
    const { id } = (await (await post(weekdayPoll)).json()) as { id: string };
    const res = await SELF.fetch(`https://api.test/v1/polls/${id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({
        name: "Ada",
        tz: "Europe/Oslo",
        slots: ["tueT09:00"], // Tue isn't in the poll
      }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "invalid_slots",
    );
  });

  it("rejects an invalid weekday token at creation", async () => {
    const res = await post({ ...weekdayPoll, days: ["funday"] });
    expect(res.status).toBe(400);
  });

  it("rejects a calendar date when kind is weekdays", async () => {
    const res = await post({ ...weekdayPoll, days: ["2026-07-15"] });
    expect(res.status).toBe(400);
  });

  it("defaults kind to 'dates' when omitted", async () => {
    const { id } = (await (await post(validPoll)).json()) as { id: string };
    const poll = (await (
      await SELF.fetch(`https://api.test/v1/polls/${id}`, {
        headers: { Origin: ORIGIN },
      })
    ).json()) as { kind: string };
    expect(poll.kind).toBe("dates");
  });
});
