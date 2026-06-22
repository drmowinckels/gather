import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createPollSchema,
  submitSlotsSchema,
  lockSchema,
  patchPollSchema,
} from "./schema";
import { shortId, editToken } from "./id";
import { validSlotKeys } from "./slots";
import { rankSlots } from "./aggregate";
import { expiryDate, isExpired, todayUTC } from "./dates";
import { rateLimit } from "./ratelimit";
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

// Fetch a poll, or return the matching error response (404 unknown, 410 expired).
// Centralises the not-found / expiry gate every read & write endpoint shares.
async function loadActivePoll(
  c: Context<{ Bindings: Env }>,
  id: string,
): Promise<PollRow | Response> {
  const row = await c.env.DB.prepare(`SELECT * FROM polls WHERE id = ?`)
    .bind(id)
    .first<PollRow>();
  if (!row) return c.json({ error: "not_found" }, 404);
  if (isExpired(row.expires_at, todayUTC())) return c.json({ error: "expired" }, 410);
  return row;
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
  maybe: string | null;
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
      maybe: JSON.parse(r.maybe ?? "[]") as string[],
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
    const ip = c.req.header("CF-Connecting-IP") ?? "anon";
    const limit = Number.parseInt(c.env.CREATE_LIMIT, 10) || 30;
    if (!(await rateLimit(c.env.DB, `create:${ip}`, limit, 60))) {
      return c.json({ error: "rate_limited" }, 429);
    }

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
  const row = await loadActivePoll(c, id);
  if (row instanceof Response) return row;

  let responses: ResponseRow[] = [];
  if (canSeeResults(c, row)) {
    const result = await c.env.DB.prepare(
      `SELECT name, tz, slots, maybe, updated_at FROM responses WHERE poll_id = ? ORDER BY id`,
    )
      .bind(id)
      .all<ResponseRow>();
    responses = result.results;
  }

  return c.json(serializePoll(row, responses));
});

polls.get("/:id/best", async (c) => {
  const id = c.req.param("id");
  const row = await loadActivePoll(c, id);
  if (row instanceof Response) return row;
  if (!canSeeResults(c, row)) return c.json({ error: "forbidden" }, 403);

  const limitRaw = c.req.query("limit");
  const parsed = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(parsed)
    ? Math.max(1, Math.min(1000, parsed))
    : undefined;

  const result = await c.env.DB.prepare(
    `SELECT name, slots, maybe FROM responses WHERE poll_id = ?`,
  )
    .bind(id)
    .all<{ name: string; slots: string; maybe: string | null }>();
  const responses = result.results.map((r) => ({
    name: r.name,
    slots: JSON.parse(r.slots) as string[],
    maybe: JSON.parse(r.maybe ?? "[]") as string[],
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
    const row = await loadActivePoll(c, id);
    if (row instanceof Response) return row;

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
      `SELECT name, tz, slots, maybe, updated_at FROM responses WHERE poll_id = ? ORDER BY id`,
    )
      .bind(id)
      .all<ResponseRow>();
    return c.json(serializePoll({ ...row, locked_slot: slot }, responses.results));
  },
);

// Edit a poll (host only). Additive-only: an edit may rename, add days, extend
// the window or refine nothing — but it must not remove any slot that a
// respondent could already have voted on. The slot length cannot change.
polls.patch(
  "/:id",
  zValidator("json", patchPollSchema, (result, c) => {
    if (!result.success) return badRequest(c, result.error.issues);
  }),
  async (c) => {
    const id = c.req.param("id");
    const row = await loadActivePoll(c, id);
    if (row instanceof Response) return row;

    const token = bearerToken(c);
    if (!token || !constantTimeEqual(token, row.edit_token)) {
      return c.json({ error: "forbidden" }, 403);
    }

    const body = c.req.valid("json");
    if (body.slot !== undefined && body.slot !== row.slot_minutes) {
      return c.json({ error: "slot_change_unsupported" }, 400);
    }

    const next = {
      title: body.title ?? row.title,
      days: body.days ?? (JSON.parse(row.days) as string[]),
      from: body.from ?? row.from_time,
      to: body.to ?? row.to_time,
      slot: row.slot_minutes,
      isPublic: body.public ?? row.is_public === 1,
    };

    if (next.from >= next.to) return c.json({ error: "from_after_to" }, 400);

    // The new grid must be a superset of the old one, so no existing vote is
    // orphaned. This catches removed days, a shrunk window, and a window
    // extended off the slot grid (e.g. 09:00→08:45 with 30-min slots).
    const oldKeys = validSlotKeys(
      JSON.parse(row.days) as string[],
      row.from_time,
      row.to_time,
      row.slot_minutes,
    );
    const newKeys = validSlotKeys(next.days, next.from, next.to, next.slot);
    const removed = [...oldKeys].filter((k) => !newKeys.has(k));
    if (removed.length > 0) {
      return c.json({ error: "not_additive", removed: removed.slice(0, 10) }, 400);
    }

    const expiresAt = expiryDate(next.days, GRACE_DAYS);
    await c.env.DB.prepare(
      `UPDATE polls
         SET title = ?, days = ?, from_time = ?, to_time = ?,
             is_public = ?, expires_at = ?
       WHERE id = ?`,
    )
      .bind(
        next.title,
        JSON.stringify(next.days),
        next.from,
        next.to,
        next.isPublic ? 1 : 0,
        expiresAt,
        id,
      )
      .run();

    const responses = await c.env.DB.prepare(
      `SELECT name, tz, slots, maybe, updated_at FROM responses WHERE poll_id = ? ORDER BY id`,
    )
      .bind(id)
      .all<ResponseRow>();
    return c.json(
      serializePoll(
        {
          ...row,
          title: next.title,
          days: JSON.stringify(next.days),
          from_time: next.from,
          to_time: next.to,
          is_public: next.isPublic ? 1 : 0,
          expires_at: expiresAt,
        },
        responses.results,
      ),
    );
  },
);

polls.post(
  "/:id/slots",
  zValidator("json", submitSlotsSchema, (result, c) => {
    if (!result.success) return badRequest(c, result.error.issues);
  }),
  async (c) => {
    const id = c.req.param("id");
    const poll = await loadActivePoll(c, id);
    if (poll instanceof Response) return poll;

    const body = c.req.valid("json");
    const slots = [...new Set(body.slots)];
    const slotSet = new Set(slots);
    // "maybe" is distinct from "available"; a definite slot wins.
    const maybe = [...new Set(body.maybe)].filter((s) => !slotSet.has(s));
    const valid = validSlotKeys(
      JSON.parse(poll.days) as string[],
      poll.from_time,
      poll.to_time,
      poll.slot_minutes,
    );
    const invalid = [...slots, ...maybe].filter((s) => !valid.has(s));
    if (invalid.length > 0) {
      return c.json({ error: "invalid_slots", invalid: invalid.slice(0, 10) }, 400);
    }

    // Cap distinct respondents per poll (existing names just upsert).
    const cap = Number.parseInt(c.env.MAX_RESPONSES, 10) || 1000;
    const counts = await c.env.DB.prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(CASE WHEN name = ? THEN 1 ELSE 0 END), 0) AS mine
         FROM responses WHERE poll_id = ?`,
    )
      .bind(body.name, id)
      .first<{ c: number; mine: number }>();
    if (counts && counts.c >= cap && counts.mine === 0) {
      return c.json({ error: "poll_full" }, 429);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `INSERT INTO responses (poll_id, name, tz, slots, maybe, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(poll_id, name)
       DO UPDATE SET tz = excluded.tz, slots = excluded.slots,
                     maybe = excluded.maybe, updated_at = excluded.updated_at`,
    )
      .bind(id, body.name, body.tz, JSON.stringify(slots), JSON.stringify(maybe), now)
      .run();

    return c.json({ name: body.name, tz: body.tz, slots, maybe, updatedAt: now });
  },
);
