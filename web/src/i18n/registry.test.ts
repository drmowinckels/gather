import { describe, it, expect } from "vitest";
import {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_ORDER,
  DEFAULT_LOCALE,
  isLocale,
} from "./registry";
import { en } from "./locales/en";

const codes = Object.keys(LOCALES) as (keyof typeof LOCALES)[];
const enKeys = Object.keys(en).sort();

describe("locale registry", () => {
  it("every locale translates exactly the English key set", () => {
    for (const code of codes) {
      expect(Object.keys(LOCALES[code]).sort()).toEqual(enKeys);
    }
  });

  it("plural keys stay plural in every locale", () => {
    for (const key of enKeys) {
      const isPlural = typeof (en as Record<string, unknown>)[key] === "object";
      for (const code of codes) {
        const entry = (LOCALES[code] as Record<string, unknown>)[key];
        expect(typeof entry === "object").toBe(isPlural);
      }
    }
  });

  it("every locale has a label and a slot in the display order", () => {
    for (const code of codes) {
      expect(LOCALE_LABELS[code]).toBeTruthy();
      expect(LOCALE_ORDER).toContain(code);
    }
    expect(LOCALE_ORDER).toHaveLength(codes.length);
  });

  it("the default locale is registered", () => {
    expect(isLocale(DEFAULT_LOCALE)).toBe(true);
  });
});
