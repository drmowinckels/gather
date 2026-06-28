# Contributing to samkoma

Thanks for helping out! samkoma is an npm-workspaces monorepo (`core`, `api`,
`web`, `cli`, `client`). Most of this guide is general; the
[**Translations**](#translations) section is the one to read if you want to add
or improve a language — no prior knowledge of the codebase required.

## Getting set up

Requires Node 20+.

```bash
npm install            # once, at the repo root — links @samkoma/core
npm test               # every workspace
npm run typecheck      # tsc --noEmit across all packages
npm run format:check   # prettier
```

See the [README](README.md#develop) for running the API and web app locally.

## Before you open a PR

Run these from the repo root and make sure they pass:

```bash
npm run format:check   # or: npx prettier --write <your files>
npm run typecheck
npm test
```

Keep PRs focused and reviewable. Write a short summary and a test plan, and add
tests for any new behaviour.

## Translations

The web app is fully translatable. Translations live in **one file per
language**, which the registry auto-discovers — so adding a language means
writing a single file, with nothing to register and no component to touch.

Everything lives in [`web/src/i18n/`](web/src/i18n):

```
web/src/i18n/
  locales/
    en.ts        # English — the source of truth (defines every key)
    nb.ts        # Norwegian Bokmål
  registry.ts    # auto-discovers everything in locales/ — you don't edit this
```

[`locales/en.ts`](web/src/i18n/locales/en.ts) defines the full set of keys.
Every other language is type-checked against it, so the compiler tells you
exactly which keys you still need to translate. The registry **auto-discovers**
any file in `locales/`, so adding a language is just adding one file.

### Add a new language

1. **Copy `en.ts`.** Duplicate
   [`web/src/i18n/locales/en.ts`](web/src/i18n/locales/en.ts) to
   `web/src/i18n/locales/<code>.ts`, where `<code>` is the
   [ISO 639-1 code](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes)
   (e.g. `de`, `fr`, `nn`).

2. **Set the header.** Import the `Catalog` type, declare the catalog against it,
   give the language a `meta` (its own name + switcher position), and
   default-export it:

   ```ts
   import type { Catalog } from "./en";
   import type { LocaleMeta } from "../types";

   export const meta: LocaleMeta = { label: "Deutsch", order: 30 };

   const de: Catalog = {
     "nav.about": "Über",
     // …translate every value…
   };

   export default de;
   ```

   Typing it `: Catalog` is what makes the compiler list any key you missed.
   `label` is the language's own name (endonym); `order` sets its place in the
   switcher (English is `0`).

3. **Translate the values.** Keep every key exactly as in `en.ts`; only change
   the values. See the [rules](#translation-rules) below.

4. **That's it — there's nothing to register.** The switcher, browser-language
   detection, and the translation fallback all read from the auto-discovered
   registry. Then check your work:

   ```bash
   npm run typecheck -w samkoma-web   # lists any missing/mistyped keys
   npm test -w samkoma-web            # also verifies meta + default export
   ```

   (If your language should be picked automatically for a related browser code —
   e.g. `nn`/`no` → `nb` — add that one alias to `LOCALE_ALIASES` in
   `registry.ts`.)

### Translation rules

- **Keep every key.** Don't add, remove, or rename keys — only translate
  values. If a key is genuinely untranslatable in your language, keep the
  English value.
- **Leave placeholders intact.** `{name}`, `{count}`, etc. are filled in at
  runtime. Translate the words around them, not the braces.
- **Plurals** are written as `{ one, other }`:

  ```ts
  "results.peopleFree": {
    one: "{count} person free",
    other: "{count} people free",
  },
  ```

  Keep both forms. The right one is chosen automatically per your language's
  rules (`Intl.PluralRules`).
- **A `\n`** in a value is a deliberate line break (e.g. the landing heading) —
  keep it where it makes sense for your language.
- **Don't translate code.** CLI commands, API field names, URLs, and the
  `samkoma` brand name stay as-is.
- **Labels are endonyms** — a language's name in its own language (`Norsk`, not
  `Norwegian`).

### Improve an existing translation

Spotted an awkward phrase? Edit the value in that language's file
(`web/src/i18n/locales/<code>.ts`) and open a PR. Translation-only PRs are very
welcome.

## Code style

- Prettier is the formatter — run it before committing.
- Self-explanatory names; comments only where something genuinely needs
  explaining.
- TypeScript across `web`/`api`/`cli`; keep `npm run typecheck` clean.
