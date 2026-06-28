import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_ALIASES, isLocale } from "./registry";
import type { Locale } from "./registry";
import { makeT } from "./translate";
import type { TFunc } from "./translate";
import {
  setDisplayLocale,
  setTimeFormat as applyTimeFormat,
  setDateFormat as applyDateFormat,
} from "../lib/datetime";
import type { TimeFormat, DateFormat } from "../lib/datetime";

const LANG_KEY = "samkoma-lang";
const TIME_KEY = "samkoma-timeformat";
const DATE_KEY = "samkoma-dateformat";

// The display-preferences context: UI language plus the date/time format
// overrides. They live together because every text-rendering component already
// subscribes via useT(), so a format change re-renders them with no extra wiring.
interface LangContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunc;
  timeFormat: TimeFormat;
  setTimeFormat: (value: TimeFormat) => void;
  dateFormat: DateFormat;
  setDateFormat: (value: DateFormat) => void;
}

const LangContext = createContext<LangContextValue | null>(null);

// Saved choice wins; otherwise match the browser's language against the
// registry (exact base code, then an alias like nn/no → nb); otherwise default.
function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && isLocale(saved)) return saved;
  } catch {
    // storage unavailable — fall through to browser detection
  }
  const nav =
    typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "";
  const base = nav.split("-")[0];
  if (isLocale(base)) return base;
  if (base in LOCALE_ALIASES) return LOCALE_ALIASES[base];
  return DEFAULT_LOCALE;
}

function isTimeFormat(value: string): value is TimeFormat {
  return value === "auto" || value === "12h" || value === "24h";
}
function isDateFormat(value: string): value is DateFormat {
  return value === "auto" || value === "iso";
}

function readPref<T extends string>(
  key: string,
  guard: (v: string) => v is T,
  fallback: T,
): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved && guard(saved)) return saved;
  } catch {
    // storage unavailable — use the default
  }
  return fallback;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(() =>
    readPref(TIME_KEY, isTimeFormat, "auto"),
  );
  const [dateFormat, setDateFormat] = useState<DateFormat>(() =>
    readPref(DATE_KEY, isDateFormat, "auto"),
  );

  // Keep date/time formatting in sync with these choices. Set during render
  // (LangProvider renders before its children) so labels and the chosen prefs
  // never disagree, even on the first paint after a switch.
  setDisplayLocale(locale);
  applyTimeFormat(timeFormat);
  applyDateFormat(dateFormat);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LANG_KEY, locale);
      localStorage.setItem(TIME_KEY, timeFormat);
      localStorage.setItem(DATE_KEY, dateFormat);
    } catch {
      // storage unavailable (private mode / disabled) — degrades gracefully
    }
  }, [locale, timeFormat, dateFormat]);

  const t = useMemo(() => makeT(locale), [locale]);
  const value = useMemo<LangContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      timeFormat,
      setTimeFormat,
      dateFormat,
      setDateFormat,
    }),
    [locale, t, timeFormat, dateFormat],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

// Outside a provider, resolve against the defaults instead of throwing, so a
// component can render in isolation (e.g. unit tests) without ceremony.
function useLangContext(): LangContextValue {
  const ctx = useContext(LangContext);
  const fallback = useMemo<LangContextValue>(
    () => ({
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: makeT(DEFAULT_LOCALE),
      timeFormat: "auto",
      setTimeFormat: () => {},
      dateFormat: "auto",
      setDateFormat: () => {},
    }),
    [],
  );
  return ctx ?? fallback;
}

export function useLang(): LangContextValue {
  return useLangContext();
}

export function useT(): TFunc {
  return useLangContext().t;
}

export function useLocale(): [Locale, (locale: Locale) => void] {
  const { locale, setLocale } = useLangContext();
  return [locale, setLocale];
}

export function useTimeFormat(): [TimeFormat, (value: TimeFormat) => void] {
  const { timeFormat, setTimeFormat } = useLangContext();
  return [timeFormat, setTimeFormat];
}

export function useDateFormat(): [DateFormat, (value: DateFormat) => void] {
  const { dateFormat, setDateFormat } = useLangContext();
  return [dateFormat, setDateFormat];
}
