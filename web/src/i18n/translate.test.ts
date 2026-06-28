import { describe, it, expect } from "vitest";
import { translate, interpolate, makeT } from "./translate";
import type { TKey } from "./locales/en";

describe("interpolate", () => {
  it("fills named placeholders", () => {
    expect(
      interpolate("Switch language to {language}", { language: "Norsk" }),
    ).toBe("Switch language to Norsk");
  });

  it("coerces numbers and leaves unknown placeholders verbatim", () => {
    expect(interpolate("{count} of {missing}", { count: 3 })).toBe(
      "3 of {missing}",
    );
  });

  it("returns the template untouched when no vars are given", () => {
    expect(interpolate("{count} people")).toBe("{count} people");
  });
});

describe("translate", () => {
  it("resolves a key in the requested locale", () => {
    expect(translate("en", "nav.newPoll")).toBe("New poll");
    expect(translate("nb", "nav.newPoll")).toBe("Ny avstemning");
  });

  it("interpolates string entries", () => {
    expect(translate("nb", "lang.switchTo", { language: "English" })).toBe(
      "Bytt språk til English",
    );
  });

  it("selects the plural form per the locale's CLDR rule", () => {
    expect(translate("en", "results.peopleFree", { count: 1 })).toBe(
      "1 person free",
    );
    expect(translate("en", "results.peopleFree", { count: 4 })).toBe(
      "4 people free",
    );
    expect(translate("nb", "results.peopleFree", { count: 1 })).toBe(
      "1 person ledig",
    );
    expect(translate("nb", "results.peopleFree", { count: 0 })).toBe(
      "0 personer ledige",
    );
  });

  it("falls back to the key itself for an unknown key", () => {
    expect(translate("en", "does.not.exist" as TKey)).toBe("does.not.exist");
  });

  it("makeT binds a locale", () => {
    const t = makeT("nb");
    expect(t("nav.about")).toBe("Om");
  });
});
