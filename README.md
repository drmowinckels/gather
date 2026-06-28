# samkoma

Find a time, together.

**samkoma** is an API-first group-availability scheduler — a modern
[when2meet](https://www.when2meet.com) alternative. A host creates a poll,
shares one link, respondents paint when they're free, and a live heatmap
surfaces the slot that works for the most people. Everything the web UI does is
a thin client over a REST API, so a CLI or a bot can drive it too.

- **App:** https://samkoma.org
- **API:** https://api.samkoma.org

## Architecture

GitHub Pages serves only static files, so samkoma is split in two:

| Part       | Lives on                | What it is                             |
| ---------- | ----------------------- | -------------------------------------- |
| **`web/`** | GitHub Pages            | React + TypeScript + Vite SPA (static) |
| **`api/`** | Cloudflare Workers + D1 | REST API + SQLite database             |

```
browser ──fetch──▶  api.samkoma.org  ──▶  D1 (SQLite)
(Pages SPA)           (Worker, REST)
```

The browser calls the Worker cross-origin. Poll links persist because state
lives in D1, not the page — and both tiers are free at this scale. Shared domain
logic (day resolution, the slot grid, ranking) lives in [`core/`](core) and is
bundled into each app.

## Features

- **Paint availability** — drag across a grid; tri-state **available → maybe →
  busy**, keyboard-accessible.
- **Live heatmap** — the best slot is ringed and runner-ups listed; **filter
  people** to recompute over a subset.
- **Per-viewer timezone** — everyone paints in their own zone, but slot keys
  stay canonical, so the same absolute time lands on the same slot.
- **Two poll kinds** — specific **dates** or recurring **weekdays**.
- **Lock a slot** — the host locks the winner; anyone can then **add it to their
  calendar** (`.ics`).
- **No accounts** — an edit token (stored client-side) gates host actions, and
  responses are claimed with an auto-minted secret or an optional password.
- **More** — private polls & hidden results, QR share, CSV export, duplicate a
  poll, deadline & early close, and an `.ics` overlay to block out busy times.
- **Multilingual** — the UI is fully translatable; see
  [CONTRIBUTING](CONTRIBUTING.md#translations).
- Polls **auto-expire** (14 days after the last day for `dates`, 60 days after
  creation for `weekdays`) and a daily cron purges them. Per-IP rate limits and
  a per-poll respondent cap keep abuse down.

## API

Base: the deployed Worker URL. Interactive docs live at **`/docs`** and the
machine-readable spec at **`/openapi.json`** (generated from the same zod
validators the routes use, so they can't drift).

| Method | Endpoint              | Returns                                |
| ------ | --------------------- | -------------------------------------- |
| `POST` | `/v1/polls`           | `{id, url, editToken}`                 |
| `GET`  | `/v1/polls/:id`       | poll + aggregated responses            |
| `POST` | `/v1/polls/:id/slots` | the saved response                     |
| `GET`  | `/v1/polls/:id/best`  | `{total, results[{slot,count,names}]}` |
| `GET`  | `/v1/polls/:id/csv`   | `text/csv` of every response           |
| `POST` | `/v1/polls/:id/lock`  | the updated poll                       |
| `GET`  | `/v1/polls/:id/ics`   | `text/calendar` for the locked slot    |

A **`dates`** poll uses ISO dates (`YYYY-MM-DD`) with per-viewer timezones; a
**`weekdays`** poll uses weekday tokens (`mon`…`sun`) in the poll's home
timezone. Non-public polls hide responses unless the request sends the edit
token as `Authorization: Bearer <token>`.

## CLI & client

[`cli/`](cli) is a thin client over the same API, storing edit tokens in
`~/.samkoma`:

```bash
npm run build -w samkoma-cli
node cli/dist/index.js new "Team offsite" --days mon-fri --from 09:00 --to 17:00 --tz Europe/Oslo --public
node cli/dist/index.js best <id>
node cli/dist/index.js lock <id> 2026-07-15T09:00
```

[`client/`](client) is a dependency-free `samkoma-client` for any consumer
(Node, browser, or a Worker); see
[docs/jinx-integration.md](docs/jinx-integration.md) for a full bot flow.

## Develop

npm-workspaces monorepo (`core`, `api`, `web`, `cli`, `client`), Node 20+. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full guide (and how to add a
language).

```bash
npm install                  # once, at the repo root — links @samkoma/core
npm run dev -w samkoma-api   # API on :8787 (cp api/.dev.vars.example api/.dev.vars)
npm run dev -w samkoma-web   # web on :5173 (cp web/.env.example web/.env)
npm test                     # every workspace
```

## Deploy

Pushing to `main` deploys both tiers via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — **already
configured for this repo** (the D1 database, the Actions secrets, and Pages with
the `samkoma.org` custom domain). For a fresh fork:

1. Create the D1 database and paste its id into `api/wrangler.toml`:
   `cd api && npx wrangler d1 create samkoma`.
2. Add Actions secrets `CLOUDFLARE_API_TOKEN` (Workers + D1 edit) and
   `CLOUDFLARE_ACCOUNT_ID`.
3. Set Pages source to **GitHub Actions**, then add an Actions variable
   `VITE_API_BASE` = the deployed Worker URL and re-run the workflow.

DNS (the apex → GitHub Pages, `api.` → a Worker custom domain) is managed
out-of-band in Cloudflare, since the CI token only has Workers + D1 permissions.
