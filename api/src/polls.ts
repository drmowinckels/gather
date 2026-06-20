import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createPollSchema, submitSlotsSchema, lockSchema } from "./schema";
import { shortId, editToken } from "./id";
import { validSlotKeys } from "./slots";
import { rankSlots } from "./aggregate";
import { expiryDate, isExpired, todayUTC } from "./dates";
import type { Env } from "./types";

const GRACE_DAYS = 14;

function badRequest(c: Context, issues: unknown) {
  return c.json({ error: "invalid_body", issues }, 400);
}

function bearerToken(c: Context): string | null {
  const header = c.req.header("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Aggregated results are visible when the poll is public, or to the host
// (proves ownership via the edit token in an Authorization: Bearer header).
function canSeeResults(c: Context, row: PollRow): boolean {
  if (row.is_public === 1) return true;
  const token = bearerToken(c);
  return token !== null && constantTimeEqual(token, row.edit_token);
}

interface PollRow {
  id: string;
  title: string;
  days: string;
  from_time: string;
  to_time: string;
  slot_minutes: number;
  tz: string;
  is_public: number;
  edit_token: string;
  created_at: string;
  locked_slot: string | null;
  expires_at: string | null;
}

interface ResponseRow {
  name: string;
  tz: string;
  slots: string;
  updated_at: string;
}

function serializePoll(row: PollRow, responses: ResponseRow[]) {
  return {
    id: row.id,
    title: row.title,
    days: JSON.parse(row.days) as string[],
    from: row.from_time,
    to: row.to_time,
    slot: row.slot_minutes,
    tz: row.tz,
    public: row.is_public === 1,
    lockedSlot: row.locked_slot ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    responses: responses.map((r) => ({
      name: r.name,
      tz: r.tz,
      slots: JSON.parse(r.slots) as string[],
      updatedAt: r.updated_at,
    })),
  };
}

export const polls = new Hono<{ Bindings: Env }>();

polls.post(
  "/",
  zValidator("json", createPollSchema, (result, c) => {
    if (!result.success) return badRequest(c, result.error.issues);
  }),
  async (c) => {
    const body = c.req.valid("json");
    const id = shortId();
    const token = editToken();
    const createdAt = new Date().toISOString();
    const expiresAt = expiryDate(body.days, GRACE_DAYS);

    await c.env.DB.prepare(
      `INSERT INTO polls
         (id, title, days, from_time, to_time, slot_minutes, tz, is_public, edit_token, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        body.title,
        JSON.stringify(body.days),
        body.from,
        body.to,
        body.slot,
        body.tz,
        body.public ? 1 : 0,
        token,
        createdAt,
        expiresAt,
      )
      .run();

    return c.json(
      { id, url: `${c.env.WEB_BASE_URL}/#/e/${id}`, editToken: token },
      201,
    );
  },
);

polls.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT * FROM polls WHERE id = ?`)
    .bind(id)
    .first<PollRow>();
  if (!row) return c.json({ error: "not_found" }, 404);
  if (isExpired(row.expires_at, todayUTC())) return c.json({ error: "expired" }, 410);

  let responses: ResponseRow[] = [];
  if (canSeeResults(c, row)) {
    const result = await c.env.DB.prepare(
      `SELECT name, tz, slots, updated_at FROM responses WHERE poll_id = ? ORDER BY id`,
    )
      .bind(id)
      .all<ResponseRow>();
    responses = result.results;
  }

  return c.json(serializePoll(row, responses));
});

polls.get("/:id/best", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`SELECT * FROM polls WHERE id = ?`)
    .bind(id)
    .first<PollRow>();
  if (!row) return c.json({ error: "not_found" }, 404);
  if (isExpired(row.expires_at, todayUTC())) return c.json({ error: "expired" }, 410);
  if (!canSeeResults(c, row)) return c.json({ error: "forbidden" }, 403);

  const limitRaw = c.req.query("limit");
  const parsed = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(parsed)
    ? Math.max(1, Math.min(1000, parsed))
    : undefined;

  const result = await c.env.DB.prepare(
    `SELECT name, slots FROM responses WHERE poll_id = ?`,
  )
    .bind(id)
    .all<{ name: string; slots: string }>();
  const responses = result.results.map((r) => ({
    name: r.name,
    slots: JSON.parse(r.slots) as string[],
  }));

  return c.json(rankSlots(responses, limit));
});

polls.post(
  "/:id/lock",
  zValidator("json", lockSchema, (result, c) => {
    if (!result.success) return badRequest(c, result.error.issues);
  }),
  async (c) => {
    const id = c.req.param("id");
    const row = await c.env.DB.prepare(`SELECT * FROM polls WHERE id = ?`)
      .bind(id)
      .first<PollRow>();
    if (!row) return c.json({ error: "not_found" }, 404);
    if (isExpired(row.expires_at, todayUTC())) {
      return c.json({ error: "expired" }, 410);
    }

    const token = bearerToken(c);
    if (!token || !constantTimeEqual(token, row.edit_token)) {
      return c.json({ error: "forbidden" }, 403);
    }

    const { slot } = c.req.valid("json");
    if (slot !== null) {
      const valid = validSlotKeys(
        JSON.parse(row.days) as string[],
        row.from_time,
        row.to_time,
        row.slot_minutes,
      );
      if (!valid.has(slot)) return c.json({ error: "invalid_slots" }, 400);
    }

    await c.env.DB.prepare(`UPDATE polls SET locked_slot = ? WHERE id = ?`)
      .bind(slot, id)
      .run();

    const responses = await c.env.DB.prepare(
      `SELECT name, tz, slots, updated_at FROM responses WHERE poll_id = ? ORDER BY id`,
    )
      .bind(id)
      .all<ResponseRow>();
    return c.json(serializePoll({ ...row, locked_slot: slot }, responses.results));
  },
);

polls.post(
  "/:id/slots",
  zValidator("json", submitSlotsSchema, (result, c) => {
    if (!result.success) return badRequest(c, result.error.issues);
  }),
  async (c) => {
    const id = c.req.param("id");
    const poll = await c.env.DB.prepare(`SELECT * FROM polls WHERE id = ?`)
      .bind(id)
      .first<PollRow>();
    if (!poll) return c.json({ error: "not_found" }, 404);
    if (isExpired(poll.expires_at, todayUTC())) {
      return c.json({ error: "expired" }, 410);
    }

    const body = c.req.valid("json");
    const slots = [...new Set(body.slots)];
    const valid = validSlotKeys(
      JSON.parse(poll.days) as string[],
      poll.from_time,
      poll.to_time,
      poll.slot_minutes,
    );
    const invalid = slots.filter((s) => !valid.has(s));
    if (invalid.length > 0) {
      return c.json({ error: "invalid_slots", invalid: invalid.slice(0, 10) }, 400);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `INSERT INTO responses (poll_id, name, tz, slots, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(poll_id, name)
       DO UPDATE SET tz = excluded.tz, slots = excluded.slots, updated_at = excluded.updated_at`,
    )
      .bind(id, body.name, body.tz, JSON.stringify(slots), now)
      .run();

    return c.json({ name: body.name, tz: body.tz, slots, updatedAt: now });
  },
);
