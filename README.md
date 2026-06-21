# gather

Find a time, together.

**gather** is an API-first group-availability scheduler —
a modern [when2meet](https://www.when2meet.com) alternative. A host creates a
poll for some days and times, shares one link, respondents paint when they're
free, and a live heatmap surfaces the slot that works for the most people.

Everything the web UI does is a thin client over a REST API, so a CLI or a bot
can create polls and read results programmatically too.

## How it runs (static frontend, persistent links)

GitHub Pages only serves static files, but a scheduling tool needs shared,
persistent state. So gather is split in two:

| Part       | Lives on                | What it is                             |
| ---------- | ----------------------- | -------------------------------------- |
| **`web/`** | GitHub Pages            | React + TypeScript + Vite SPA (static) |
| **`api/`** | Cloudflare Workers + D1 | REST API + SQLite database             |

The browser calls the Worker cross-origin (CORS). Poll links persist
indefinitely because the data lives in D1, not in the page. Both tiers are free
at this scale.

```
browser ──fetch──▶  gather-api.<sub>.workers.dev  ──▶  D1 (SQLite)
(Pages SPA)                 (Worker, REST)
```

## Live

- **App:** https://gather.drmowinckels.io
- **API:** https://api.gather.drmowinckels.io

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

**Slice 5 (done):** the host can "lock in" the winning slot
(`POST /v1/polls/:id/lock`, edit-token gated). Everyone sees a "Locked in" banner
and the locked cell is ringed; the host can unlock.

**Slice 6 (done):** polls auto-expire **14 days after their last day**. The
expiry is stored at creation; expired polls return `410` and a daily Cloudflare
Cron Trigger deletes them (and their responses), so stale polls don't pile up.
The poll page shows "Link active until <date>".

**Slice 7 (done):** a `gather` CLI (`cli/`) — a thin client over the API:
`gather new`, `gather best`, `gather lock`/`unlock`, with edit tokens stored in
`~/.gather`. See [CLI](#cli).

**Next slices:** the Jinx GitHub-bot integration; rate-limiting hardening.

## API

Base: the deployed Worker URL. See [`design/HANDOFF.md`](design/HANDOFF.md) for
the full contract and visual spec.

| Method | Endpoint              | Body                                          | Returns                                |
| ------ | --------------------- | --------------------------------------------- | -------------------------------------- |
| `POST` | `/v1/polls`           | `{title, days[], from, to, slot, tz, public}` | `{id, url, editToken}`                 |
| `GET`  | `/v1/polls/:id`       | —                                             | poll + aggregated responses            |
| `POST` | `/v1/polls/:id/slots` | `{name, tz, slots[]}`                         | saved `{name, tz, slots, …}`           |
| `GET`  | `/v1/polls/:id/best`  | `?limit=` (optional)                          | `{total, results[{slot,count,names}]}` |
| `POST` | `/v1/polls/:id/lock`  | `{slot}` (or `{slot:null}`), host token       | updated poll                           |

Slot keys are `YYYY-MM-DDThh:mm` in the poll's canonical timezone. For a
non-public poll, `GET /v1/polls/:id` returns an empty `responses` list and
`GET /v1/polls/:id/best` returns `403` unless the request sends the edit token
as `Authorization: Bearer <token>`.

## CLI

`cli/` is a thin client over the same API. It stores edit tokens in `~/.gather`
so the host can lock from the terminal.

```bash
cd cli && npm install && npm run build
node dist/index.js new "Team offsite" --days mon-fri --from 09:00 --to 17:00 --tz Europe/Oslo --public
node dist/index.js best <id>
node dist/index.js lock <id> 2026-07-15T09:00
```

`--days` accepts ISO dates (`2026-07-15,2026-07-16`) or weekdays/ranges
(`mon-fri`, `tue,wed,thu`); weekdays resolve to their next upcoming occurrence.
The API base defaults to production; override with `--api` or `$GATHER_API`.

## Develop

Requires Node 20+.

```bash
# API (terminal 1)
cd api
npm install
cp .dev.vars.example .dev.vars
npm run migrate:local        # apply migrations to the local D1
npm run dev                  # wrangler dev on http://localhost:8787

# Web (terminal 2)
cd web
npm install
cp .env.example .env         # VITE_API_BASE=http://localhost:8787
npm run dev                  # vite on http://localhost:5173/
```

### Test

```bash
cd api && npm test           # Worker + D1 integration (vitest-pool-workers)
cd web && npm test           # api client + form (vitest + testing-library)
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
   cd api && npx wrangler d1 create gather
   ```
2. **Add GitHub Actions secrets** (repo → Settings → Secrets → Actions):
   - `CLOUDFLARE_API_TOKEN` — token with Workers + D1 edit permissions
   - `CLOUDFLARE_ACCOUNT_ID`
3. **Enable Pages**: repo → Settings → Pages → Source = **GitHub Actions**.
4. **First run** deploys the Worker. Note its `*.workers.dev` URL, then add a
   GitHub Actions **variable** `VITE_API_BASE` = that URL and re-run the workflow
   so the web build points at the live API.

> The frontend is served at the root of the custom domain `gather.drmowinckels.io`
> (Vite `base` is `/`). The API has a Cloudflare Worker custom domain
> `api.gather.drmowinckels.io`. `ALLOWED_ORIGINS` / `WEB_BASE_URL` in
> `api/wrangler.toml` and the `VITE_API_BASE` repo variable all point at these.

## Notes

- No accounts. Creating a poll returns an **edit token** stored client-side;
  anyone with the link can respond.
- `npm audit` advisories in both packages are confined to the dev toolchain
  (vite / vitest / wrangler / miniflare). Production dependencies — the Worker
  (Hono, zod) and the SPA (React) — report **0 vulnerabilities**.
- `design/` holds the original design handoff and the HTML visual spec. It is a
  reference, not shipped code.
