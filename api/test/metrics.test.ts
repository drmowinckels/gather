import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const ORIGIN = "http://localhost:5173";
const today = new Date().toISOString().slice(0, 10);

const validPoll = {
  title: "Team offsite",
  days: ["2099-07-15", "2099-07-16", "2099-07-17"],
  from: "09:00",
  to: "15:00",
  slot: 30,
  tz: "Europe/Oslo",
  public: true,
};

function createPoll() {
  return SELF.fetch("https://api.test/v1/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(validPoll),
  });
}

function submit(id: string, name: string, secret?: string) {
  return SELF.fetch(`https://api.test/v1/polls/${id}/slots`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({
      name,
      tz: "Europe/Oslo",
      slots: ["2099-07-15T09:00"],
      ...(secret ? { secret } : {}),
    }),
  });
}

interface Metrics {
  totals: { pollsCreated: number; responsesSubmitted: number };
  daily: { day: string; pollsCreated: number; responsesSubmitted: number }[];
}

async function getMetrics(query = ""): Promise<Metrics> {
  const res = await SELF.fetch(`https://api.test/v1/metrics${query}`, {
    headers: { Origin: ORIGIN },
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Metrics;
}

describe("GET /v1/metrics", () => {
  it("starts at zero with no daily rows", async () => {
    const m = await getMetrics();
    expect(m.totals).toEqual({ pollsCreated: 0, responsesSubmitted: 0 });
    expect(m.daily).toEqual([]);
  });

  it("counts each created poll in the lifetime total and today's row", async () => {
    await createPoll();
    await createPoll();

    const m = await getMetrics();
    expect(m.totals.pollsCreated).toBe(2);
    expect(m.totals.responsesSubmitted).toBe(0);
    expect(m.daily).toHaveLength(1);
    expect(m.daily[0]).toMatchObject({
      day: today,
      pollsCreated: 2,
      responsesSubmitted: 0,
    });
  });

  it("counts each availability submission", async () => {
    const { id } = (await (await createPoll()).json()) as { id: string };
    expect((await submit(id, "Ada")).status).toBe(200);
    expect((await submit(id, "Bo")).status).toBe(200);

    const m = await getMetrics();
    expect(m.totals.pollsCreated).toBe(1);
    expect(m.totals.responsesSubmitted).toBe(2);
  });

  it("counts a genuine edit (re-submission with the response token)", async () => {
    const { id } = (await (await createPoll()).json()) as { id: string };
    const first = (await (await submit(id, "Ada")).json()) as {
      responseToken: string;
    };
    expect((await submit(id, "Ada", first.responseToken)).status).toBe(200);

    const m = await getMetrics();
    expect(m.totals.responsesSubmitted).toBe(2);
  });

  it("does not count rejected writes (invalid body, name clash)", async () => {
    const { id } = (await (await createPoll()).json()) as { id: string };
    const bad = await SELF.fetch(`https://api.test/v1/polls/${id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ name: "", tz: "Europe/Oslo", slots: [] }),
    });
    expect(bad.status).toBe(400);

    // A re-submission without the owner's token is rejected (403) and must not count.
    await submit(id, "Ada");
    expect((await submit(id, "Ada")).status).toBe(403);

    const m = await getMetrics();
    expect(m.totals.responsesSubmitted).toBe(1);
  });

  it("clamps a garbage days param and still serves the data", async () => {
    await createPoll();
    const m = await getMetrics("?days=not-a-number");
    expect(m.totals.pollsCreated).toBe(1);
    expect(m.daily).toHaveLength(1);
  });

  it("includes today's row for a one-day window", async () => {
    await createPoll();
    const m = await getMetrics("?days=1");
    expect(m.daily.map((d) => d.day)).toContain(today);
  });
});
