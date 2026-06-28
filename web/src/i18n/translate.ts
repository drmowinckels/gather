import { en } from "./locales/en";
import type { Catalog, TKey } from "./locales/en";
import { LOCALES } from "./registry";
import type { Locale } from "./registry";

export type Vars = Record<string, string | number>;
export type TFunc = (key: TKey, vars?: Vars) => string;

type Entry = string | { one: string; other: string };

// Replace `{name}` placeholders; an unknown placeholder is left verbatim so a
// typo surfaces in the UI rather than vanishing.
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

// Resolve a key for a locale, falling back active locale → English → the key
// itself, so a gap never blanks the UI. Plural groups select via the locale's
// CLDR rule (Intl.PluralRules), keyed off `vars.count`.
export function translate(locale: Locale, key: TKey, vars?: Vars): string {
  const catalog = LOCALES[locale] as Catalog;
  const entry: Entry = catalog[key] ?? en[key];

  if (entry == null) {
    if (import.meta.env?.DEV) {
      console.warn(`[i18n] missing translation key: ${String(key)}`);
    }
    return String(key);
  }

  if (typeof entry === "string") {
    return interpolate(entry, vars);
  }

  const count = Number(vars?.count ?? 0);
  const rule = new Intl.PluralRules(locale).select(count);
  const template = rule === "one" ? entry.one : entry.other;
  return interpolate(template, vars);
}

export function makeT(locale: Locale): TFunc {
  return (key, vars) => translate(locale, key, vars);
}
