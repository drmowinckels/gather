import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { deleteExpired } from "../src/cleanup";

async function insertPoll(id: string, expiresAt: string | null) {
  await env.DB.prepare(
    `INSERT INTO polls
       (id, title, days, from_time, to_time, slot_minutes, tz, is_public, edit_token, created_at, expires_at)
     VALUES (?, 't', '[]', '09:00', '10:00', 30, 'UTC', 1, 'tok', '2020-01-01T00:00:00Z', ?)`,
  )
    .bind(id, expiresAt)
    .run();
}

async function insertResponse(pollId: string) {
  await env.DB.prepare(
    `INSERT INTO responses (poll_id, name, tz, slots, updated_at)
     VALUES (?, 'Ada', 'UTC', '[]', '2020-01-01')`,
  )
    .bind(pollId)
    .run();
}

describe("deleteExpired", () => {
  it("removes expired polls and their responses, keeps current and legacy ones", async () => {
    await insertPoll("expired1", "2099-07-01");
    await insertResponse("expired1");
    await insertPoll("current1", "2099-09-30");
    await insertPoll("legacy1", null);

    const removed = await deleteExpired(env.DB, "2099-08-01");
    expect(removed).toBe(1);

    const remaining = await env.DB.prepare(
      `SELECT id FROM polls WHERE id IN ('expired1','current1','legacy1') ORDER BY id`,
    ).all<{ id: string }>();
    expect(remaining.results.map((r) => r.id)).toEqual(["current1", "legacy1"]);

    const orphans = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM responses WHERE poll_id = 'expired1'`,
    ).first<{ c: number }>();
    expect(orphans?.c).toBe(0);
  });

  it("is a no-op when nothing is expired", async () => {
    await insertPoll("future1", "2099-12-31");
    expect(await deleteExpired(env.DB, "2099-08-01")).toBe(0);
  });
});
