import { Hono } from "hono";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createPollSchema, submitSlotsSchema } from "./schema";
import { shortId, editToken } from "./id";
import { validSlotKeys } from "./slots";
import type { Env } from "./types";

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

    await c.env.DB.prepare(
      `INSERT INTO polls
         (id, title, days, from_time, to_time, slot_minutes, tz, is_public, edit_token, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  // Responses are visible when the poll is public, or to the host (edit token).
  const token = bearerToken(c);
  const canSeeResponses =
    row.is_public === 1 ||
    (token !== null && constantTimeEqual(token, row.edit_token));

  let responses: ResponseRow[] = [];
  if (canSeeResponses) {
    const result = await c.env.DB.prepare(
      `SELECT name, tz, slots, updated_at FROM responses WHERE poll_id = ? ORDER BY id`,
    )
      .bind(id)
      .all<ResponseRow>();
    responses = result.results;
  }

  return c.json(serializePoll(row, responses));
});

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
