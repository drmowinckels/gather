# Product

## Register

product

> The app surfaces (create poll, poll page, availability grid, group heatmap) are
> the primary register: design serves the scheduling task. The public marketing
> surfaces (landing, about, API reference) are **brand-register** — design carries
> the impression — and should be worked with `reference/brand.md` in mind.

## Users

- **Hosts** — someone organising a meeting for a group (a team offsite, a study
  group, an RLadies+ chapter call). Their context: they want a time settled in
  two minutes, with no account and no back-and-forth. The job: share one link,
  let people mark availability, read off the winning slot.
- **Respondents** — anyone the host shares the link with. They land cold, often on
  a phone, often interrupted. The job: paint when they're free in their own
  timezone and leave. No sign-up, no app install.
- **Developers & bots** — integrators like **Jinx** (the RLadies+ GitHub bot) and
  CLI users. The job: create polls and read results programmatically. The web UI is
  one client of the same public REST API they use.

## Product Purpose

samkoma is an API-first, account-free group-availability scheduler — a modern,
independent [when2meet](https://www.when2meet.com) alternative. A host creates a
poll for some days and times, shares one link, respondents paint when they're free,
and a live heatmap surfaces the slot that works for the most people. Everything the
web UI does is a thin client over a public REST API, so a CLI or a bot can do it
too. Success looks like: a group settles on a time without anyone creating an
account, and a developer can automate the same flow from a script.

## Brand Personality

Warm, precise, unpretentious. Friendly without being cutesy; technically credible
without being cold. The voice is a capable person who has done this for you,
not a corporation pitching a platform. Emotional goals: **relief** (scheduling is
painful — this is genuinely easy), **trust** (no accounts, your data isn't the
product, the code is open), and **welcome** (you belong here whether you arrived
from a shared link or a `curl` command).

## Anti-references

- Generic SaaS landing pages: gradient-mesh hero, the hero-metric template, endless
  identical icon+heading+text feature cards.
- Corporate stock photography and "team collaboration" imagery.
- when2meet's dated, utilitarian grey-and-green look — we honour the function,
  not the form.
- Cold/clinical enterprise tools and dark-pattern signup walls.
- "Premium" gold/brass accents. samkoma uses a single teal accent + neutrals; warmth
  comes from copy, type, and detail, never from a metallic palette.

## Design Principles

1. **Show, don't tell.** The heatmap is the demo; the live CLI-equivalent panel
   proves the API-first claim instead of asserting it. Lead with the artefact.
2. **No friction, no accounts.** Every surface honours "two minutes, no sign-up."
   Never ask for more than the task needs.
3. **Warm precision.** A human voice over a precise, restrained system. Warmth is
   carried by copy and craft, not by decoration or noise.
4. **One identity, two front doors.** The UI and the API are the same product;
   the design treats the API as a first-class surface, not an afterthought.
5. **Independent & open.** Trustworthy and fundable by goodwill, not venture money.
   The work should feel crafted by a person, not assembled by a company.

## Accessibility & Inclusion

- WCAG 2.1 AA: body text ≥ 4.5:1 contrast, large text ≥ 3:1, visible focus rings.
- Fully keyboard-operable, including the paint grid (arrow-key nav + space toggle).
- Respects `prefers-reduced-motion` and `prefers-color-scheme`; both light and dark
  themes are first-class.
- Minimum 44×44px touch targets on coarse pointers.
- Colour is never the sole signal — the heatmap shows availability counts as numbers
  as well as colour intensity.
