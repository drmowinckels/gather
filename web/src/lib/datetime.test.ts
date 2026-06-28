import { describe, it, expect, afterEach } from "vitest";
import {
  getDisplayLocale,
  setDisplayLocale,
  setTimeFormat,
  setDateFormat,
  localizedDateFormat,
  dayHeader,
  formatDayRange,
  formatTime,
  formatHour,
  formatDayLabel,
} from "./datetime";

// 2026-07-15 is a Wednesday.
const WED = "2026-07-15";

// Restore the test baseline (see test/setup.ts): en-US locale, 24h time, auto date.
afterEach(() => {
  setDisplayLocale("en-US");
  setTimeFormat("24h");
  setDateFormat("auto");
});

describe("display locale", () => {
  it("formats date labels in the active display locale", () => {
    setDisplayLocale("en");
    expect(dayHeader(WED).weekday).toBe("Wed");

    setDisplayLocale("nb");
    expect(dayHeader(WED).weekday).toBe("ons.");
  });

  it("localizes the day-range label", () => {
    setDisplayLocale("en");
    expect(formatDayRange([WED])).toBe("Wed, Jul 15");

    setDisplayLocale("nb");
    expect(formatDayRange([WED])).toBe("ons. 15. juli");
  });

  it("getDisplayLocale reflects the most recent set", () => {
    setDisplayLocale("nb");
    expect(getDisplayLocale()).toBe("nb");
  });

  it("caches one formatter per (locale, options) and rebuilds on locale change", () => {
    const opts = { weekday: "short" } as const;

    setDisplayLocale("en");
    const a = localizedDateFormat(opts);
    expect(localizedDateFormat(opts)).toBe(a); // same locale → cached

    setDisplayLocale("nb");
    expect(localizedDateFormat(opts)).not.toBe(a); // new locale → new formatter
  });
});

describe("time format", () => {
  it("24h shows a 24-hour clock regardless of locale", () => {
    setTimeFormat("24h");
    setDisplayLocale("en");
    expect(formatTime("09:00")).toBe("09:00");
    expect(formatTime("14:30")).toBe("14:30");
  });

  it("12h shows a 12-hour clock with AM/PM", () => {
    setTimeFormat("12h");
    setDisplayLocale("en");
    expect(formatTime("09:00")).toBe("9:00 AM");
    expect(formatTime("14:30")).toBe("2:30 PM");
  });

  it("auto follows the locale's own convention", () => {
    setTimeFormat("auto");
    setDisplayLocale("en");
    expect(formatTime("09:00")).toBe("9:00 AM");
    setDisplayLocale("nb");
    expect(formatTime("14:30")).toBe("14:30");
  });

  it("formatHour labels only the hour, in the chosen format", () => {
    setTimeFormat("24h");
    expect(formatHour("09:00")).toBe("09");
    expect(formatHour("09:30")).toBe(""); // not on the hour
    setTimeFormat("12h");
    setDisplayLocale("en");
    expect(formatHour("09:00")).toBe("9 AM");
  });
});

describe("date format", () => {
  it("auto shows a locale label, iso shows the ISO date", () => {
    setDisplayLocale("en");
    setDateFormat("auto");
    expect(formatDayLabel(WED)).toBe("Wed 15");

    setDateFormat("iso");
    expect(formatDayLabel(WED)).toBe("2026-07-15");
  });

  it("iso renders the day range as ISO dates", () => {
    setDateFormat("iso");
    expect(formatDayRange(["2026-07-15", "2026-07-17"])).toBe(
      "2026-07-15 – 2026-07-17 · 2 days",
    );
  });
});
