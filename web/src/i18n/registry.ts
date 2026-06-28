import type { Catalog } from "./locales/en";
import type { LocaleMeta } from "./types";

// The locale registry auto-discovers every file in `locales/`. To add a
// language, drop a `locales/<code>.ts` that default-exports its catalog and
// names itself via `meta` — nothing here needs editing. See CONTRIBUTING.md.

interface LocaleModule {
  default: Catalog;
  meta: LocaleMeta;
}

const modules = import.meta.glob<LocaleModule>("./locales/*.ts", {
  eager: true,
});

interface RegisteredLocale {
  code: string;
  catalog: Catalog;
  meta: LocaleMeta;
}

const registered: RegisteredLocale[] = Object.entries(modules)
  .map(([path, mod]) => ({
    code: path.slice(path.lastIndexOf("/") + 1).replace(/\.ts$/, ""),
    catalog: mod.default,
    meta: mod.meta,
  }))
  .sort(
    (a, b) =>
      (a.meta.order ?? 0) - (b.meta.order ?? 0) || a.code.localeCompare(b.code),
  );

// Locale codes are discovered at build time, so this is a string rather than a
// literal union. Per-key completeness is still enforced: each locale file is
// typed `: Catalog`.
export type Locale = string;

export const LOCALES: Record<Locale, Catalog> = Object.fromEntries(
  registered.map((r) => [r.code, r.catalog]),
);

export const LOCALE_LABELS: Record<Locale, string> = Object.fromEntries(
  registered.map((r) => [r.code, r.meta.label]),
);

// Switcher order, as discovered (sorted by each file's `meta.order`).
export const LOCALE_ORDER: Locale[] = registered.map((r) => r.code);

export const DEFAULT_LOCALE: Locale = "en";

// Browser language codes that map to a supported locale beyond an exact match
// (e.g. Nynorsk/legacy "no" → Bokmål). Keep this small and explicit.
export const LOCALE_ALIASES: Record<string, Locale> = {
  no: "nb",
  nn: "nb",
};

export function isLocale(value: string): value is Locale {
  return value in LOCALES;
}
