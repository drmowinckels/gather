# gather

Find a time, together. **gather** is an API-first group-availability scheduler —
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

- **App:** https://drmowinckels.io/gather/
- **API:** https://gather-api.drmowinckels.workers.dev

## Status

**Slice 1 (done):** create a poll → it persists in D1 → the link reopens it in
any browser. Landing, create-poll form (with live CLI-equivalent), and a poll
page with a shareable link.

**Next slices:** the drag-to-paint availability grid (direction B — soft
columns) + `POST /v1/polls/:id/slots`; the group heatmap + `GET /best`;
per-viewer timezone conversion; then the CLI and the Jinx GitHub-bot integration.

## API

Base: the deployed Worker URL. See [`design/HANDOFF.md`](design/HANDOFF.md) for
the full contract and visual spec.

| Method | Endpoint        | Body                                          | Returns                     |
| ------ | --------------- | --------------------------------------------- | --------------------------- |
| `POST` | `/v1/polls`     | `{title, days[], from, to, slot, tz, public}` | `{id, url, editToken}`      |
| `GET`  | `/v1/polls/:id` | —                                             | poll + aggregated responses |

`POST /v1/polls/:id/slots` and `GET /v1/polls/:id/best` land in the next slices.

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
npm run dev                  # vite on http://localhost:5173/gather/
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

> The frontend is served from `/gather/` (project Pages site). If you move it to
> a custom domain at the root, set `base` in `web/vite.config.ts` and
> `WEB_BASE_URL` in `api/wrangler.toml` accordingly.

## Notes

- No accounts. Creating a poll returns an **edit token** stored client-side;
  anyone with the link can respond.
- `npm audit` advisories in both packages are confined to the dev toolchain
  (vite / vitest / wrangler / miniflare). Production dependencies — the Worker
  (Hono, zod) and the SPA (React) — report **0 vulnerabilities**.
- `design/` holds the original design handoff and the HTML visual spec. It is a
  reference, not shipped code.
