# Integrating gather with a bot (e.g. Jinx)

gather is API-first: the web UI is just one client of a public REST API, and a
bot is another. This guide shows how a GitHub bot like **Jinx** can open a poll
from an issue comment, post the link, and later edit the comment with the
winning slot.

> Jinx lives in its own repo and is _one consumer_ of the API — gather is not
> branded to or owned by it. Copy the [`gather-client`](../client) module (or
> publish it) and adapt the command grammar to however your bot already parses
> issues.

## The flow

```
issue comment: /jinx gather tue-thu 9-15 tz:Europe/Oslo
        │
        ▼
  parse → POST /v1/polls ──▶ { id, url, editToken }
        │                         │
        │                         └─ store editToken for this issue (to lock later)
        ▼
  reply on the issue with the poll link + status
        │   …people paint their availability…
        ▼
  later: GET /v1/polls/:id/best  ──▶ ranked slots
        │
        ▼
  POST /v1/polls/:id/lock {slot}  (with editToken)
        │
        ▼
  edit the bot's comment: "Locked in: Wed 16, 12:00"
```

## Auth model

- **Creating a poll and reading public results need no auth.**
- `createPoll` returns an **`editToken`** — the only credential. Persist it
  (keyed by the issue/PR) so the bot can later **lock** the winning slot or read
  a **private** poll's responses. Treat it as a secret.
- Limits to expect (HTTP `429`): poll creation is rate-limited per source IP
  (default 30/min — fine for a bot at normal volume) and each poll caps distinct
  respondents. Polls auto-expire 14 days after their last day (`410` afterwards).

## Using the client

```ts
import { GatherClient, parseGatherCommand, GatherError } from "gather-client"; // or copy client/src/index.ts into your bot

const gather = new GatherClient(); // defaults to the production API

// 1. Someone comments "/jinx gather tue-thu 9-15 tz:Europe/Oslo"
async function onSlashCommand(commentBody: string, title: string) {
  const args = commentBody.replace(/^\/jinx gather\s+/, "");
  const { days, from, to, tz } = parseGatherCommand(args, {
    defaultTz: "Europe/Oslo",
  });

  const poll = await gather.createPoll({
    title,
    days,
    from,
    to,
    slot: 30,
    tz,
    public: true,
  });

  await persistEditToken(title, poll.id, poll.editToken); // your storage
  return `📋 Poll's up! **${title}**\n\n${poll.url}\n\nPaint your availability — I'll edit this comment with the winning slot once everyone's in.`;
}

// 2. Later (a deadline, a /jinx close, or a poll), pick + lock the winner.
async function lockWinner(pollId: string) {
  const editToken = await loadEditToken(pollId);
  const best = await gather.getBest(pollId, { limit: 1, editToken });
  if (best.results.length === 0) return "No availability yet.";

  const winner = best.results[0];
  await gather.lock(pollId, winner.slot, editToken);
  return `✅ Locked in **${winner.slot.replace("T", " ")}** (${winner.count}/${best.total} available).`;
}
```

### Error handling

Every call rejects with a `GatherError` carrying `code` and `status`:

```ts
try {
  await gather.createPoll(input);
} catch (err) {
  if (err instanceof GatherError && err.code === "rate_limited") {
    // back off and retry
  } else if (err instanceof GatherError && err.code === "invalid_body") {
    // tell the user the command was malformed
  } else {
    throw err;
  }
}
```

Common codes: `invalid_body` (400), `rate_limited` / `poll_full` (429),
`not_found` (404), `expired` (410), `forbidden` (403, wrong/missing edit token).

## The command grammar is yours

`parseGatherCommand` is a _reference_ parser for `tue-thu 9-15 tz:Europe/Oslo`
(a day spec, an `H-H`/`HH:MM-HH:MM` range, and `tz:<zone>`). If your bot already
has a grammar, skip it and build the `PollInput` yourself — `resolveDays()` is
exported separately to turn `"mon-fri"` / ISO lists into concrete dates.
