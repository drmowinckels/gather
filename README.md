# samkoma

Find a time, together.

**samkoma** is an API-first group-availability scheduler —
a modern [when2meet](https://www.when2meet.com) alternative. A host creates a
poll for some days and times, shares one link, respondents paint when they're
free, and a live heatmap surfaces the slot that works for the most people.

Everything the web UI does is a thin client over a REST API, so a CLI or a bot
can create polls and read results programmatically too.

## How it runs (static frontend, persistent links)

GitHub Pages only serves static files, but a scheduling tool needs shared,
persistent state. So samkoma is split in two:

| Part       | Lives on                | What it is                             |
| ---------- | ----------------------- | -------------------------------------- |
| **`web/`** | GitHub Pages            | React + TypeScript + Vite SPA (static) |
| **`api/`** | Cloudflare Workers + D1 | REST API + SQLite database             |

The browser calls the Worker cross-origin (CORS). Poll links persist
indefinitely because the data lives in D1, not in the page. Both tiers are free
at this scale.

```
browser ──fetch──▶  samkoma-api.<sub>.workers.dev  ──▶  D1 (SQLite)
(Pages SPA)                 (Worker, REST)
```

## Live

- **App:** https://samkoma.drmowinckels.io
- **API:** https://api.samkoma.drmowinckels.io

## Status

**Slice 1 (done):** create a poll → it persists in D1 → the link reopens it in
any browser. Landing, create-poll form (with live CLI-equivalent), and a poll
page with a shareable link.

**Slice 2 (done):** drag-to-paint availability grid (direction B — soft
columns) on the poll page, saved via `POST /v1/polls/:id/slots` (upsert by name,
autosave on drag-end, keyboard toggle for a11y).

**Slice 3 (done):** group heatmap on the poll page + `GET /v1/polls/:id/best`.
Cells coloured by how many respondents are free, best slot ringed, best-slot +
runner-ups panel. Results respect the privacy flag (public, or host with the
edit token).

**Slice 4 (done):** per-viewer timezone. Each visitor sees and paints the grid
(and the heatmap) in their own zone via a timezone selector; slot keys stay
canonical (in the poll's home tz), so two people in different zones who pick the
same absolute time land on the same slot. So "14:00 Oslo" is "08:00 New York"
automatically.

**Slice 5 (done):** the host can "lock in" a slot
(`POST /v1/polls/:id/lock`, edit-token gated) — tap any heatmap cell to pick it
(defaults to the best), then lock. Everyone sees a "Locked in" banner and the
locked cell is ringed; the host can unlock.

**Slice 6 (done):** polls auto-expire **14 days after their last day**. The
expiry is stored at creation; expired polls return `410` and a daily Cloudflare
Cron Trigger deletes them (and their responses), so stale polls don't pile up.
The poll page shows "Link active until <date>".

**Slice 7 (done):** a `samkoma` CLI (`cli/`) — a thin client over the API:
`samkoma new`, `samkoma best`, `samkoma lock`/`unlock`, with edit tokens stored in
`~/.samkoma`. See [CLI](#cli).

**Slice 8 (done):** abuse hardening — per-IP poll-creation rate limit and a
per-poll respondent cap (both `429`). See [Notes](#notes).

**Slice 9 (done):** `samkoma-client` ([`client/`](client)) — a dependency-free
API client + command helpers — and a [Jinx integration guide](docs/jinx-integration.md)
for bots. The bot itself lives in its own repo as a consumer of the API.

**Slice 10 (done):** tri-state availability. Each cell cycles **available →
maybe → busy** (tap or drag); "maybe" ("might be able to make it") is stored
separately and shown in the heatmap as a diagonal hatch, with its own counts and
names. Best-slot ranks by available first, then available-or-maybe.

**Next:** Jinx wiring happens in the bot's own repo against this client.

## API

Base: the deployed Worker URL. See [`design/HANDOFF.md`](design/HANDOFF.md) for
the full contract and visual spec.

| Method | Endpoint              | Body                                          | Returns                                |
| ------ | --------------------- | --------------------------------------------- | -------------------------------------- |
| `POST` | `/v1/polls`           | `{title, kind?, days[], from, to, slot, tz, public}` | `{id, url, editToken}`          |
| `GET`  | `/v1/polls/:id`       | —                                             | poll + aggregated responses            |
| `POST` | `/v1/polls/:id/slots` | `{name, tz, slots[], maybe[]}`                | saved `{name, tz, slots, maybe, …}`    |
| `GET`  | `/v1/polls/:id/best`  | `?limit=` (optional)                          | `{total, results[{slot,count,names}]}` |
| `POST` | `/v1/polls/:id/lock`  | `{slot}` (or `{slot:null}`), host token       | updated poll                           |
| `GET`  | `/v1/polls/:id/ics`   | —                                             | `text/calendar` for the locked slot (`409` if none) |

A poll is one of two `kind`s (default `dates`):

- **`dates`** — specific calendar dates; `days` are ISO dates (`YYYY-MM-DD`),
  slot keys are `YYYY-MM-DDThh:mm`, and each viewer can see/paint in their own
  timezone. Polls expire 14 days after their last day.
- **`weekdays`** — recurring days of the week; `days` are weekday tokens
  (`mon`…`sun`), slot keys are `monThh:mm`, and everyone uses the poll's home
  timezone (no per-viewer conversion). Polls expire 60 days after creation.

Once a slot is locked, `GET /v1/polls/:id/ics` returns a calendar anyone can add
to their own calendar app — a single absolute-time event for a `dates` poll, or a
weekly-recurring event (`RRULE`) for a `weekdays` poll. The poll page shows an
"Add to calendar" button on the locked banner.

For a non-public poll, `GET /v1/polls/:id` returns an empty `responses` list and
`GET /v1/polls/:id/best` returns `403` unless the request sends the edit token
as `Authorization: Bearer <token>`.

## CLI

`cli/` is a thin client over the same API. It stores edit tokens in `~/.samkoma`
so the host can lock from the terminal.

```bash
npm install                  # once, at the repo root (workspaces)
npm run build -w samkoma-cli
node cli/dist/index.js new "Team offsite" --days mon-fri --from 09:00 --to 17:00 --tz Europe/Oslo --public
node cli/dist/index.js best <id>
node cli/dist/index.js lock <id> 2026-07-15T09:00
node cli/dist/index.js ics <id> --out offsite.ics   # export the locked slot
```

`--days` accepts ISO dates (`2026-07-15,2026-07-16`) or weekdays/ranges
(`mon-fri`, `tue,wed,thu`); weekdays resolve to their next upcoming occurrence.
The API base defaults to production; override with `--api` or `$SAMKOMA_API`.

## Client library & bots

[`client/`](client) is a tiny, dependency-free `samkoma-client` (a `SamkomaClient`
class plus `resolveDays` / `parseSamkomaCommand` helpers) for any consumer of the
API — Node, browser, or a Worker. See
[**docs/jinx-integration.md**](docs/jinx-integration.md) for a full bot flow
(parse an issue command → create a poll → post the link → lock the winner).

## Develop

Requires Node 20+. This is an npm-workspaces monorepo (`core`, `api`, `web`,
`cli`, `client`) — install once at the root, then target a package with `-w`.
Shared domain logic (day resolution, the slot grid, ranking) lives in
[`core/`](core) (`@samkoma/core`) and is bundled into each app at build time.

```bash
npm install                  # once, at the repo root — links @samkoma/core

# API (terminal 1)
cp api/.dev.vars.example api/.dev.vars
npm run migrate:local -w samkoma-api   # apply migrations to the local D1
npm run dev -w samkoma-api             # wrangler dev on http://localhost:8787

# Web (terminal 2)
cp web/.env.example web/.env           # VITE_API_BASE=http://localhost:8787
npm run dev -w samkoma-web             # vite on http://localhost:5173/
```

### Test

```bash
npm test                     # every workspace
npm test -w samkoma-api      # just the Worker + D1 integration suite
npm run typecheck            # tsc --noEmit across all packages
npm run format:check         # prettier
```

## Deploy (one-time setup)

> **Already configured for this repo.** The D1 database, the GitHub Actions
> secrets/variables, and Pages (custom domain `drmowinckels.io`) are all set up;
> pushing to `main` deploys both tiers. The steps below document how, for
> reference or a fresh fork.

The repo deploys on push to `main` via [`.github/workflows/deploy.yml`].

1. **Create the D1 database** and paste its id into `api/wrangler.toml`
   (replacing `REPLACE_WITH_D1_ID`):
   ```bash
   cd api && npx wrangler d1 create samkoma
   ```
2. **Add GitHub Actions secrets** (repo → Settings → Secrets → Actions):
   - `CLOUDFLARE_API_TOKEN` — token with Workers + D1 edit permissions
   - `CLOUDFLARE_ACCOUNT_ID`
3. **Enable Pages**: repo → Settings → Pages → Source = **GitHub Actions**.
4. **First run** deploys the Worker. Note its `*.workers.dev` URL, then add a
   GitHub Actions **variable** `VITE_API_BASE` = that URL and re-run the workflow
   so the web build points at the live API.

> The frontend is served at the root of the custom domain `samkoma.drmowinckels.io`
> (Vite `base` is `/`). The API has a Cloudflare Worker custom domain
> `api.samkoma.drmowinckels.io`. `ALLOWED_ORIGINS` / `WEB_BASE_URL` in
> `api/wrangler.toml` and the `VITE_API_BASE` repo variable all point at these.

## Notes

- No accounts. Creating a poll returns an **edit token** stored client-side;
  anyone with the link can respond.
- **Response ownership.** The first time a name is saved, the server returns a
  one-time secret (auto-minted token, kept in the browser) that claims it — so
  nobody can overwrite your row by typing your name. To edit from another device,
  set an optional **password** when you respond. Secrets are stored only as a
  PBKDF2 hash and verified in constant time; a re-write without the secret is
  `403`.
- **Abuse limits:** poll creation and slot submission are both rate-limited per
  IP (`CREATE_LIMIT`/min default 30, `SUBMIT_LIMIT`/min default 120), and each
  poll caps distinct respondents (`MAX_RESPONSES`, default 1000) — all `429`.
  Counters live in a tiny D1 table the daily cron purges.
- `npm audit` advisories in both packages are confined to the dev toolchain
  (vite / vitest / wrangler / miniflare). Production dependencies — the Worker
  (Hono, zod) and the SPA (React) — report **0 vulnerabilities**.
- `design/` holds the original design handoff and the HTML visual spec. It is a
  reference, not shipped code.
