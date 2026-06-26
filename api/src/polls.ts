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
import { mintResponseToken, hashSecret, verifySecret } from "./secret";
import {
  validSlotKeys,
  buildLockedIcs,
  icsFilename,
  responsesToCsv,
  csvFilename,
} from "@samkoma/core";
import { rankSlots } from "./aggregate";
import { expiryDate, addGraceDays, isExpired, todayUTC } from "./dates";
import { rateLimit } from "./ratelimit";
import { recordEvent } from "./stats";
import type { Env } from "./types";

const GRACE_DAYS = 14; // dated polls: days after the last day
const WEEKDAY_GRACE_DAYS = 60; // weekday polls: days after creation
const WEEK_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Canonical, de-duplicated day order: chronological for dates, week order for
// weekdays (so stored `days` and the rendered grid line up).
function sortDays(kind: string, days: string[]): string[] {
  const unique = [...new Set(days)];
  return kind === "weekdays"
    ? unique.sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b))
    : unique.sort();
}

function badRequest(c: Context, issues: unknown) {
  return c.json({ error: "invalid_body", issues }, 400);
}

function bearerToken(c: Context): string | null {
  const header = c.req.header("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function clientIp(c: Context): string {
  return c.req.header("CF-Connecting-IP") ?? "anon";
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The host (proves ownership via the edit token) always sees results. Everyone
// else sees them only when the poll is public AND not curtained by the host's
// hidden-results mode.
function canSeeResults(c: Context, row: PollRow): boolean {
  const token = bearerToken(c);
  if (token !== null && constantTimeEqual(token, row.edit_token)) return true;
  return row.is_public === 1 && row.results_hidden === 0;
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
  if (isExpired(row.expires_at, todayUTC()))
    return c.json({ error: "expired" }, 410);
  return row;
}

interface PollRow {
  id: string;
  title: string;
  kind: string;
  days: string;
  from_time: string;
  to_time: string;
  slot_minutes: number;
  tz: string;
  is_public: number;
  results_hidden: number;
  edit_token: string;
  created_at: string;
  locked_slot: string | null;
  expires_at: string | null;
  deadline: string | null;
  closed_at: string | null;
}

// A poll is closed for new responses when the host closed it early, or once its
// deadline has passed. Closing only freezes writes — reads still return 200.
function pollClosed(row: PollRow): boolean {
  if (row.closed_at) return true;
  return row.deadline !== null && Date.now() > Date.parse(row.deadline);
}

interface ResponseRow {
  name: string;
  tz: string;
  slots: string;
  maybe: string | null;
  updated_at: string;
}

// Normalise the raw DB `kind` string to the typed union (single source of truth
// for the dates/weekdays vocabulary).
function pollKind(row: PollRow): "dates" | "weekdays" {
  return row.kind === "weekdays" ? "weekdays" : "dates";
}

function serializePoll(row: PollRow, responses: ResponseRow[]) {
  return {
    id: row.id,
    title: row.title,
    kind: pollKind(row),
    days: JSON.parse(row.days) as string[],
    from: row.from_time,
    to: row.to_time,
    slot: row.slot_minutes,
    tz: row.tz,
    public: row.is_public === 1,
    resultsHidden: row.results_hidden === 1,
    deadline: row.deadline ?? null,
    closedAt: row.closed_at ?? null,
    closed: pollClosed(row),
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
    const limit = Number.parseInt(c.env.CREATE_LIMIT, 10) || 30;
    if (!(await rateLimit(c.env.DB, `create:${clientIp(c)}`, limit, 60))) {
      return c.json({ error: "rate_limited" }, 429);
    }

    const body = c.req.valid("json");
    const id = shortId();
    const token = editToken();
    const createdAt = new Date().toISOString();
    const days = sortDays(body.kind, body.days);
    const expiresAt =
      body.kind === "weekdays"
        ? addGraceDays(createdAt.slice(0, 10), WEEKDAY_GRACE_DAYS)
        : expiryDate(days, GRACE_DAYS);

    await c.env.DB.prepare(
      `INSERT INTO polls
         (id, title, kind, days, from_time, to_time, slot_minutes, tz, is_public, results_hidden, edit_token, created_at, expires_at, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        body.title,
        body.kind,
        JSON.stringify(days),
        body.from,
        body.to,
        body.slot,
        body.tz,
        body.public ? 1 : 0,
        body.resultsHidden ? 1 : 0,
        token,
        createdAt,
        expiresAt,
        body.deadline ?? null,
      )
      .run();

    await recordEvent(c.env.DB, "polls_created", createdAt.slice(0, 10));

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

// Data export: every painted slot as a tidy CSV (one row per respondent+slot).
// Gated exactly like the aggregate reads — visible to the host, or to anyone on
// a public, non-hidden poll; 403 otherwise.
polls.get("/:id/csv", async (c) => {
  const id = c.req.param("id");
  const row = await loadActivePoll(c, id);
  if (row instanceof Response) return row;
  if (!canSeeResults(c, row)) return c.json({ error: "forbidden" }, 403);

  const result = await c.env.DB.prepare(
    `SELECT name, slots, maybe FROM responses WHERE poll_id = ? ORDER BY id`,
  )
    .bind(id)
    .all<{ name: string; slots: string; maybe: string | null }>();
  const responses = result.results.map((r) => ({
    name: r.name,
    slots: JSON.parse(r.slots) as string[],
    maybe: JSON.parse(r.maybe ?? "[]") as string[],
  }));

  return c.body(responsesToCsv(responses), 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${csvFilename(row.title)}"`,
  });
});

// Calendar export: the locked slot as a single-event iCalendar. Public (the
// locked slot is already shown to everyone), so anyone with the link can add it
// to their own calendar. 409 if the host hasn't locked a slot yet.
polls.get("/:id/ics", async (c) => {
  const id = c.req.param("id");
  const row = await loadActivePoll(c, id);
  if (row instanceof Response) return row;
  if (!row.locked_slot) return c.json({ error: "not_locked" }, 409);

  const ics = buildLockedIcs(
    {
      id: row.id,
      title: row.title,
      kind: pollKind(row),
      tz: row.tz,
      slotMinutes: row.slot_minutes,
      lockedSlot: row.locked_slot,
    },
    { url: `${c.env.WEB_BASE_URL}/#/e/${row.id}` },
  );

  return c.body(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${icsFilename(row.title)}"`,
  });
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
    return c.json(
      serializePoll({ ...row, locked_slot: slot }, responses.results),
    );
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
      days: sortDays(row.kind, body.days ?? (JSON.parse(row.days) as string[])),
      from: body.from ?? row.from_time,
      to: body.to ?? row.to_time,
      slot: row.slot_minutes,
      isPublic: body.public ?? row.is_public === 1,
      resultsHidden: body.resultsHidden ?? row.results_hidden === 1,
      deadline: body.deadline === undefined ? row.deadline : body.deadline,
      closedAt:
        body.closed === undefined
          ? row.closed_at
          : body.closed
            ? new Date().toISOString()
            : null,
    };

    // Reopening a poll whose deadline has already passed must actually reopen
    // it: drop the elapsed deadline (a still-future one is kept). Otherwise the
    // poll would re-report as closed and "Reopen" would do nothing.
    if (
      body.closed === false &&
      next.deadline !== null &&
      Date.now() > Date.parse(next.deadline)
    ) {
      next.deadline = null;
    }

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
      return c.json(
        { error: "not_additive", removed: removed.slice(0, 10) },
        400,
      );
    }

    // Weekday polls expire from creation, so their expiry is unaffected by edits.
    const expiresAt =
      row.kind === "weekdays"
        ? row.expires_at
        : expiryDate(next.days, GRACE_DAYS);
    await c.env.DB.prepare(
      `UPDATE polls
         SET title = ?, days = ?, from_time = ?, to_time = ?,
             is_public = ?, results_hidden = ?, expires_at = ?,
             deadline = ?, closed_at = ?
       WHERE id = ?`,
    )
      .bind(
        next.title,
        JSON.stringify(next.days),
        next.from,
        next.to,
        next.isPublic ? 1 : 0,
        next.resultsHidden ? 1 : 0,
        expiresAt,
        next.deadline,
        next.closedAt,
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
          results_hidden: next.resultsHidden ? 1 : 0,
          expires_at: expiresAt,
          deadline: next.deadline,
          closed_at: next.closedAt,
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
    // Per-IP throttle: the only authenticated-free write, so it needs a guard
    // against a leaked link being flooded (junk responses + filling the cap).
    const limit = Number.parseInt(c.env.SUBMIT_LIMIT, 10) || 120;
    if (!(await rateLimit(c.env.DB, `slots:${clientIp(c)}`, limit, 60))) {
      return c.json({ error: "rate_limited" }, 429);
    }

    const id = c.req.param("id");
    const poll = await loadActivePoll(c, id);
    if (poll instanceof Response) return poll;
    if (pollClosed(poll)) return c.json({ error: "closed" }, 409);

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
      return c.json(
        { error: "invalid_slots", invalid: invalid.slice(0, 10) },
        400,
      );
    }

    // Ownership: once a name has a secret, only a writer who presents it may
    // overwrite it. The first writer claims the name — with their own password,
    // or an auto-minted token returned once for seamless same-browser editing.
    const existing = await c.env.DB.prepare(
      `SELECT secret_hash FROM responses WHERE poll_id = ? AND name = ?`,
    )
      .bind(id, body.name)
      .first<{ secret_hash: string | null }>();

    let secretHash: string;
    let mintedToken: string | undefined;
    if (existing?.secret_hash) {
      // A 403 here also reveals that the name is claimed (200 vs 403 is a
      // claimed/unclaimed oracle). That's an accepted tradeoff: on a public poll
      // the names are already listed, and writes are rate-limited per IP.
      if (
        !body.secret ||
        !(await verifySecret(body.secret, existing.secret_hash))
      ) {
        return c.json({ error: "name_protected" }, 403);
      }
      secretHash = existing.secret_hash;
    } else if (body.secret) {
      secretHash = await hashSecret(body.secret);
    } else {
      mintedToken = mintResponseToken();
      secretHash = await hashSecret(mintedToken);
    }

    // Cap distinct respondents per poll (only a brand-new name adds one).
    if (!existing) {
      const cap = Number.parseInt(c.env.MAX_RESPONSES, 10) || 1000;
      const counts = await c.env.DB.prepare(
        `SELECT COUNT(*) AS c FROM responses WHERE poll_id = ?`,
      )
        .bind(id)
        .first<{ c: number }>();
      if (counts && counts.c >= cap) {
        return c.json({ error: "poll_full" }, 429);
      }
    }

    // Atomic write: the guard makes the SELECT-then-write race-safe. The row is
    // only touched when it's unclaimed (secret_hash IS NULL) or owned by this
    // caller (the hash we verified above). If a concurrent first-write claimed
    // the name between our SELECT and here, the guard fails, nothing is written,
    // and RETURNING yields no row — so we never clobber the winner's data nor
    // hand back a token that doesn't match the stored hash.
    const now = new Date().toISOString();
    const written = await c.env.DB.prepare(
      `INSERT INTO responses (poll_id, name, tz, slots, maybe, secret_hash, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(poll_id, name)
       DO UPDATE SET tz = excluded.tz, slots = excluded.slots,
                     maybe = excluded.maybe, updated_at = excluded.updated_at,
                     secret_hash = COALESCE(responses.secret_hash, excluded.secret_hash)
       WHERE responses.secret_hash IS NULL OR responses.secret_hash = ?
       RETURNING secret_hash`,
    )
      .bind(
        id,
        body.name,
        body.tz,
        JSON.stringify(slots),
        JSON.stringify(maybe),
        secretHash,
        now,
        existing?.secret_hash ?? secretHash,
      )
      .first<{ secret_hash: string }>();

    // Lost a concurrent claim race — the name's owner got there first.
    if (!written) return c.json({ error: "name_protected" }, 403);

    await recordEvent(c.env.DB, "responses_submitted", now.slice(0, 10));

    // The guard only writes a row carrying our hash, so a minted token is valid
    // exactly when the write succeeded.
    return c.json({
      name: body.name,
      tz: body.tz,
      slots,
      maybe,
      updatedAt: now,
      ...(mintedToken ? { responseToken: mintedToken } : {}),
    });
  },
);
