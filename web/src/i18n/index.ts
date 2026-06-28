// Public barrel for the i18n module. Internal files import each other directly
// (locales → registry → translate → LangProvider); only consumers import from
// here, so there is no import cycle through this file.

export type { Catalog, TKey } from "./locales/en";
export type { Plural, CatalogPart } from "./types";
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_ORDER,
  LOCALE_ALIASES,
  isLocale,
} from "./registry";
export type { Locale } from "./registry";
export { makeT, translate, interpolate } from "./translate";
export type { TFunc, Vars } from "./translate";
export {
  LangProvider,
  useT,
  useLocale,
  useLang,
  useTimeFormat,
  useDateFormat,
} from "./LangProvider";
