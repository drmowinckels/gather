# Handoff: samkoma — a modern, API-first when2meet alternative

## Overview
**samkoma** is a group-availability scheduling tool: a host creates a poll for a set of
days/times in a timezone, shares one link, respondents paint when they're free, and a live
heatmap surfaces the slot that works for the most people. It is **API-first** — everything the
web UI does is a thin client over a REST API — so a bot (e.g. **Jinx**, the R-Ladies+ GitHub
bot) or a CLI can create polls and read results programmatically.

The product is intentionally **independent** (not branded to R-Ladies or Dr. Mowinckel's). Jinx
is treated as *one consumer* of the public API, not the owner of the product.

## About the design files
The file in this bundle — `samkoma.design.html` — is a **design reference created in HTML**. It
is a prototype showing the intended look, layout, and behavior; it is **not production code to
copy**. It is authored as a "Design Component" (a streaming HTML format) and pulls a few CSS
tokens from a design system, but for implementation you should treat it purely as a visual
spec.

Your task: **recreate these designs in the target codebase's environment** using its established
patterns and libraries. If no codebase exists yet, pick the most appropriate stack (suggestion
below) and build there. Do **not** ship the HTML directly.

Open `samkoma.design.html` in a browser to see all screens laid out as labeled frames on a gray
canvas (it's a single scrollable spec sheet).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and interaction intent are all
specified below with exact values. Recreate the UI pixel-closely using the codebase's component
library, but honor these tokens. The grid/heatmap visuals are exact; respondent names, dates,
and counts in the mock are placeholder data.

## Suggested architecture (if starting fresh)
- **Frontend:** React + TypeScript + Vite. Tailwind optional; the token table below maps cleanly
  to CSS variables or a Tailwind theme.
- **Backend/API:** any REST stack (Node/Express/Fastify, Python/FastAPI, Go). Stateless poll
  resources keyed by short id; no user accounts required (edit-token model).
- **CLI:** a thin wrapper over the REST API (`samkoma new …`) that stores an edit token in
  `~/.samkoma`.
- **Bot integration (Jinx):** Jinx parses a slash-command on a GitHub issue, calls
  `POST /v1/polls`, posts the poll link as a comment, and later edits the comment with the
  winning slot.

---

## Screens / Views

### 1. Landing page
- **Purpose:** explain the product, drive "Create a poll", show the API/CLI angle.
- **Layout:** full-width. Top nav bar (logo left; links *How it works / API / Docs / GitHub*;
  right side a theme-toggle circle + primary "New poll" button). Hero is a 2-column grid
  (`~1.05fr .95fr`, gap 44px, padding 64px 40px 56px): left = eyebrow + headline + subcopy + two
  CTAs + an inline terminal snippet; right = an elevated card previewing the group heatmap.
  Below the hero, a 3-column feature row (1px dividers between cells).
- **Key components:**
  - **Nav:** height ~64px, bottom border `--border-subtle`. Logo = wordmark (see Typography).
    Links: Manrope 14px/500, `--fg-muted`, hover `--brand`.
  - **Eyebrow:** "Group scheduling, one shared link" — Manrope, 14px, uppercase,
    letter-spacing .22em, `--brand` (teal), weight 500.
  - **Headline (h1):** "Find a time, together." — Manrope 800, 60px, line-height 1.0,
    letter-spacing -0.035em, `--fg`, sentence case (NOT uppercase).
  - **Subcopy:** Manrope 18–21px, line-height 1.5, `--fg-muted`, max-width ~46ch.
  - **CTAs:** primary = filled `--brand` pill, white text, padding 14×26; secondary = outline
    (1.5px `--border`), `--fg` text, transparent bg. Both pill radius (9999px).
  - **Terminal snippet:** `--bg-inset` bg, 1px `--border-subtle`, left border 3px `--brand`,
    radius 10px, JetBrains Mono 13.5px. Example:
    `$ samkoma new "Team offsite" --days mon-fri --9to17 --tz Europe/Oslo`
  - **Hero heatmap card:** `--bg-elev-1`, 1px `--border`, radius 18px, soft shadow, padding 24.
    Mini heatmap (see Heatmap spec) + legend "fewer … everyone".
  - **Feature cells (×3):** numbered `01/02/03` (Manrope 800, 13px, .08em, `--brand`), a 17px/700
    title, and a 16px `--fg-muted` paragraph. Titles: *Paint your hours / See it converge /
    Automate it*.

### 2. Create a poll (new event form)
- **Purpose:** host configures and creates a poll. Two minutes, no account.
- **Layout:** centered card; the design shows it beside a "CLI equivalent" terminal panel.
- **Components (top → bottom):**
  - Wordmark, then **h2 "New poll"** (Manrope 800, 28px, -0.02em), then a 15px `--fg-muted`
    helper line.
  - **Event name:** text input. Inputs = `--bg-elev-2` bg, 1.5px `--border`, radius 11px,
    padding 11×14, Manrope 15px.
  - **Which days?:** wrap of pill **chips**. Default chip = `--bg-elev-2`, 1.5px `--border`,
    `--fg-muted`, radius 9999, padding 8×14, weight 600. Selected chip (`.on`) = `--brand` bg,
    white text, `--brand` border. Plus a dashed "+ pick on calendar" chip in `--brand`.
  - **Time range row:** 3 columns — "No earlier than" / "No later than" / "Slot size" inputs.
  - **Timezone:** input showing e.g. "Europe/Oslo (CEST · UTC+2)" with a hint
    "respondents see their own ▾". The host's tz is the poll's canonical tz; each respondent
    views/enters in their own.
  - **Footer row:** a toggle "Make results public" (on = `--brand` track, white knob) and the
    primary **"Create poll"** button.
- **Field labels:** `.fieldlbl` — Manrope 12px, 700, uppercase, letter-spacing .06em,
  `--fg-subtle`, margin-bottom 7px.

### 3. Your availability (the grid) — THREE visual directions to choose from
Same data + interaction, three treatments. **Pick one** for production; A is the safe default.
- **Shared structure:** header ("Your availability" + a tiny "You" tag in `--brand`), a one-line
  hint, a day-column header row, then 13 time rows (09:00–15:00 in 30-min slots; label shown on
  the hour only, e.g. `9am`, `10am`). A left time-gutter (~38px) + N day columns (`flex:1`).
  Legend at bottom: "free" / "busy".
- **Interaction:** click-and-drag to paint contiguous cells available/unavailable (drag from an
  empty cell paints "free"; drag from a filled cell erases). Touch = tap & swipe.
- **Direction A — Refined classic (solid fills):** square-ish cells, height 22px, radius 4px,
  gap 4px. Free = solid `--brand`. Busy = `--bg-inset` with a 1px inset `--border-subtle`.
- **Direction B — Soft columns (rounded), shown in dark mode:** cells height 24px, radius 8px,
  gap 6px. Free = vertical gradient `linear-gradient(180deg, --brand, mix(--brand 78%, #000))`
  so contiguous runs read as a single block of time. Busy = `--bg-elev-1`.
- **Direction C — Minimal (dot density):** transparent cells with a bottom hairline
  `--border-subtle`; a centered dot that is 14px solid `--brand` when free, 6px `--border` when
  busy. Airy/quiet.
- **Mobile:** same grid, 3 day columns visible, ~20px cells, in a phone frame; sticky bottom bar
  with "Share" (secondary) and "Save" (primary) buttons. Min touch target 44px in production.

### 4. Group results (the heatmap)
- **Purpose:** see where availability converges and lock a slot.
- **Layout:** main 2-column grid (`1fr 230px`): left = the heatmap; right = a results side-panel.
- **Heatmap:** same row/column structure as the availability grid. Each cell is colored by the
  **count** of available respondents (0…N). Cells show the count number when ≥1. The single best
  cell gets a 2px `--metallic`/`--brand` ring + a soft glow.
- **Side panel:**
  - **"Best slot" card:** `--brand` bg, white text, radius 14px. Eyebrow "BEST SLOT" (11px
    uppercase .16em), big slot label (Manrope 800, 24px, -0.02em) e.g. "Wed 16, 12:00", and
    "9 / 9 available · all in".
  - **Runner-ups list:** "RUNNER-UPS" label + rows of `slot … count/total`.
  - **Hover tooltip mock:** a popover (`--bg-elev-2`, 1px `--border`, radius 10px, shadow)
    showing the slot, "Available · N", and the list of names available at that cell.
  - **"Lock in …" button:** full-width primary.
- **Dark variant:** same, the heat glows against `--bg`; includes a 0→N gradient legend bar.

### 5. API & CLI (bot integration, Jinx-ready)
- **Purpose:** documentation surface showing the REST API and a real GitHub-issue bot flow.
- **Left — API reference card:** eyebrow "REFERENCE", h2 "One poll, two front doors", intro
  paragraph, an **endpoint table**, and a `curl` example block (dark terminal). See API contract.
- **Right — "A bot on a GitHub issue":** a mocked GitHub issue thread:
  - Issue header (open dot, title "Schedule the September offsite", "#312 · open").
  - A user comment containing a slash command:
    `/jinx samkoma tue-thu 9-15 tz:Europe/Oslo`
  - A **samkoma-bot/jinx-bot** reply card: "📋 Poll's up! **Team offsite — September**", the
    schedule line, the poll link (`samkoma.so/e/9fK2qd`), and status chips ("0 responses",
    "closes in 5 days"), plus "I'll edit this comment with the winning slot once everyone's in."

---

## Design tokens (exact)

Both themes are first-class. Implement as CSS variables (light = default, dark = `.dark` /
`[data-theme=dark]`) or a Tailwind theme. **The product uses a single teal accent + neutrals —
no gold/brass.**

### Light
| Token | Value | Use |
|---|---|---|
| `--bg` | `#ffffff` | page |
| `--bg-elev-1` | `#f6f8f8` | cards / surfaces |
| `--bg-elev-2` | `#ffffff` | inputs, popovers |
| `--bg-inset` | `#eef1f1` | code wells, busy cells |
| `--bg-tinted` | `#eef6f5` | subtle teal wash |
| `--fg` | `#16201f` | primary text |
| `--fg-muted` | `#566461` | secondary text |
| `--fg-subtle` | `#8b958f` | captions / labels |
| `--border` | `#e4e8e7` | default border |
| `--border-subtle` | `#eef1f0` | hairlines |
| `--border-strong` | `#0e5857` | emphasis rule |
| `--brand` | `#0e5857` | accent (buttons, fills, links) |
| `--brand-2` | `#1a7270` | lighter accent / code strings |
| `--botanical` | `#3f8a6e` | success ("available") |

### Dark
| Token | Value |
|---|---|
| `--bg` | `#0c1a1c` |
| `--bg-elev-1` | `#11262a` |
| `--bg-elev-2` | `#163034` |
| `--bg-inset` | `#081416` |
| `--fg` | `#eef3f2` |
| `--fg-muted` | `#aeb9b6` |
| `--fg-subtle` | `#74827e` |
| `--border` | `#21383a` |
| `--border-subtle` | `#182b2d` |
| `--border-strong` | `#6cc1bf` |
| `--brand` | `#5cc6c2` |
| `--brand-2` | `#9bd6d4` |
| `--botanical` | `#6fbf9e` |
| `--accent-soft` | `#0c2f2e` |

On dark, filled-`--brand` buttons use **`#06181a`** (near-black) text for contrast.

### Typography
- **Families:** `Manrope` for everything UI (wordmark, headings, body, labels); `JetBrains Mono`
  for code/terminal/endpoints. (Load via Google Fonts.) The ornamental serif/deco faces from the
  original system were intentionally dropped for a contemporary look.
- **Wordmark "samkoma":** Manrope 800, lowercase, letter-spacing -0.03em, single color
  (`--fg` in chrome; `#16201f`/`--brand` accents elsewhere). No special "R" treatment.
- **Scale (px):** h1 60 (-0.035em, lh 1.0) · h2 28 / 24 / 21 (-0.02em) · feature title 17/700 ·
  body 15–21 (lh 1.5) · eyebrow 12–14 uppercase, letter-spacing .2em, `--brand` · micro-labels
  11–12 uppercase, .06–.16em, 700.
- Headings are **sentence case** — explicitly set `text-transform:none`.

### Spacing / radii / shadow / motion
- **Radii:** pill buttons & chips `9999px`; inputs `11px`; cards `12–18px`; grid cells `4–8px`.
- **Shadow (light):** `0 1px 2px rgba(16,24,28,.06), 0 10px 34px rgba(16,24,28,.07)`.
- **Motion:** calm, ~120–380ms, ease-out `cubic-bezier(0.22,0.61,0.36,1)`. No bouncy springs.
- **Canvas/spec background only:** `#edefee` (not part of the app).

### Heatmap color algorithm
For a cell with `count` available out of `total` respondents:
```
pct = round(count / total * 100)            // 0..100
fill = color-mix(in oklab, var(--brand) pct%, <base>)
// <base> = transparent (light) or var(--bg-inset) (dark)
count === 0  → no fill + 1px inset var(--border-subtle)
best cell    → box-shadow: 0 0 0 2px var(--brand), 0 0 14px color-mix(--brand 60%, transparent)
number color → white/near-black when pct high (count ≥ ~55%), else var(--fg-subtle)
```

---

## Interactions & behavior
- **Paint grid:** pointerdown on a cell sets a paint mode (fill vs erase based on the starting
  cell's state), pointerenter while dragging applies it; pointerup commits. Debounce a
  `POST /slots` save (or save on blur). Keyboard: arrow-key navigation + space to toggle is a
  nice-to-have.
- **Timezone:** poll stores a canonical IANA tz; render each viewer's grid in *their* tz,
  converting slot boundaries. Show both the host tz and the viewer tz.
- **Results recompute:** counts and "best slot" derive from all submitted availabilities; best =
  max count (tie-break by earliest, then fewest hard-conflicts — define as you like).
- **Theme toggle:** persist choice (localStorage) and respect `prefers-color-scheme` when unset.
- **Responsive:** desktop wide grid; on mobile show fewer day columns with horizontal scroll and
  a sticky action bar. Min 44px touch targets.
- **No accounts:** creating a poll returns an **edit token** (stored client-side / in `~/.samkoma`
  for CLI). Anyone with the link can respond; edit token gates poll settings + lock-in.

## State (frontend)
- `poll`: `{ id, title, days[], from, to, slotMinutes, tz, public }`
- `me`: `{ name, tz, slots: Set<slotKey> }` (my painted availability)
- `responses`: `[{ name, tz, slots }]` (for results); derived `counts[slotKey]`, `bestSlot`
- UI: `theme`, `paintMode`, `isDragging`, `hoveredSlot`, save status.

---

## API contract (as drawn, plus sensible completion)
Base: `https://samkoma.so/v1` · Auth for bots: `Authorization: Bearer <token>`.

| Method | Endpoint | Body / notes | Returns |
|---|---|---|---|
| POST | `/v1/polls` | `{title, days[YYYY-MM-DD], from "HH:MM", to "HH:MM", slot <min>, tz, public}` | `{id, url, editToken}` |
| GET | `/v1/polls/:id` | — | poll + aggregated grid state |
| POST | `/v1/polls/:id/slots` | `{name, tz, slots[]}` (slot keys or ISO times) | updated availability |
| GET | `/v1/polls/:id/best` | optional `?limit=` | ranked slots `[{slot, count, total, names[]}]` |

**Create example (from the design):**
```
curl -X POST https://samkoma.so/v1/polls \
  -H "Authorization: Bearer $BOT_TOKEN" \
  -d '{
    "title": "Team offsite",
    "days": ["2025-07-15","2025-07-16","2025-07-17"],
    "from": "09:00", "to": "15:00", "slot": 30,
    "tz": "Europe/Oslo"
  }'
→ { "id": "9fK2qd", "url": "https://samkoma.so/e/9fK2qd" }
```

### CLI grammar (placeholder — confirm before building)
```
samkoma new "<title>" \
  --days tue,wed,thu          # or mon-fri
  --from 09:00 --to 15:00 --slot 30m
  --tz Europe/Oslo
  --public
→ ✓ poll created
  → https://samkoma.so/e/9fK2qd
  edit token saved to ~/.samkoma
```

### Jinx / GitHub bot flow (placeholder grammar)
1. User comments on an issue: `/jinx samkoma tue-thu 9-15 tz:Europe/Oslo`
2. Jinx calls `POST /v1/polls`, replies with the poll link + status chips.
3. Jinx polls `GET /v1/polls/:id/best` and edits its comment with the winning slot when done.
> The `/jinx samkoma …` and `samkoma new …` grammars and the `samkoma.so` domain are **assumptions**.
> Confirm/adjust to however Jinx already parses commands and your real domain.

---

## Files
- `samkoma.design.html` — the full visual spec (all 5 screens + 3 grid directions + light/dark +
  mobile), as labeled frames on a scrollable canvas. Open in any browser.

## Open questions to confirm before building
1. Exact CLI flag grammar and Jinx slash-command syntax.
2. Production domain (`samkoma.so` is a placeholder).
3. Which grid direction (A / B / C) to ship.
4. Tie-break rule for "best slot".
5. Storage model for polls (DB vs. serverless KV) and edit-token security.
