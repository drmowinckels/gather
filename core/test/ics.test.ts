import { describe, it, expect } from "vitest";
import { buildLockedIcs, icsFilename } from "../src/ics.js";

const datesPoll = {
  id: "abc123",
  title: "Team offsite",
  kind: "dates" as const,
  tz: "Europe/Oslo",
  slotMinutes: 30,
  lockedSlot: "2099-07-15T09:00",
};

// Fixed stamps keep the output deterministic.
const fixed = {
  uid: "abc123-2099-07-15T09:00@samkoma",
  dtstamp: new Date("2099-06-01T00:00:00Z"),
};

function lines(ics: string): string[] {
  return ics.split("\r\n");
}

describe("buildLockedIcs (dated poll)", () => {
  const ics = buildLockedIcs(datesPoll, {
    ...fixed,
    url: "https://samkoma.example/#/e/abc123",
  });

  it("is a single-event calendar with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    const ls = lines(ics);
    expect(ls.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(ls).toContain("VERSION:2.0");
  });

  it("emits the locked slot as an absolute UTC instant (summer = CEST +2)", () => {
    // 2099-07-15 09:00 Oslo (CEST) == 07:00 UTC; +30 min slot -> 07:30 UTC.
    const ls = lines(ics);
    expect(ls).toContain("DTSTART:20990715T070000Z");
    expect(ls).toContain("DTEND:20990715T073000Z");
    expect(ls).not.toContain("RRULE:FREQ=WEEKLY;BYDAY=WE");
  });

  it("uses the date's own DST offset (winter = CET +1)", () => {
    const winter = buildLockedIcs(
      { ...datesPoll, lockedSlot: "2099-01-15T09:00" },
      fixed,
    );
    expect(lines(winter)).toContain("DTSTART:20990115T080000Z");
  });

  it("carries the title and url, and a stable UID", () => {
    const ls = lines(ics);
    expect(ls).toContain("SUMMARY:Team offsite");
    expect(ls).toContain("DESCRIPTION:https://samkoma.example/#/e/abc123");
    expect(ls).toContain("UID:abc123-2099-07-15T09:00@samkoma");
    expect(ls).toContain("DTSTAMP:20990601T000000Z");
  });
});

describe("buildLockedIcs (weekday poll)", () => {
  const weekdayPoll = {
    id: "wk1",
    title: "Weekly standup",
    kind: "weekdays" as const,
    tz: "Europe/Oslo",
    slotMinutes: 60,
    lockedSlot: "wedT09:00",
  };

  const ics = buildLockedIcs(weekdayPoll, {
    uid: "wk1-wedT09:00@samkoma",
    dtstamp: new Date("2099-06-01T00:00:00Z"),
    now: new Date("2099-06-01T12:00:00Z"),
  });

  it("emits a weekly RRULE on the right day", () => {
    expect(lines(ics)).toContain("RRULE:FREQ=WEEKLY;BYDAY=WE");
  });

  it("uses floating local time (no Z) anchored to the next matching weekday", () => {
    const dtstart = lines(ics).find((l) => l.startsWith("DTSTART:"))!;
    expect(dtstart).toMatch(/^DTSTART:\d{8}T090000$/); // floating, no trailing Z
    const date = dtstart.slice("DTSTART:".length, "DTSTART:".length + 8);
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    expect(new Date(`${iso}T00:00:00Z`).getUTCDay()).toBe(3); // Wednesday
    // 09:00 + 60 min, same day, still floating.
    expect(lines(ics)).toContain(`DTEND:${date}T100000`);
  });
});

describe("buildLockedIcs (escaping & folding)", () => {
  it("escapes commas, semicolons, backslashes and newlines in text", () => {
    const ics = buildLockedIcs(
      { ...datesPoll, title: "Lunch; drinks, maybe\\stuff\nafter" },
      fixed,
    );
    expect(lines(ics)).toContain(
      "SUMMARY:Lunch\\; drinks\\, maybe\\\\stuff\\nafter",
    );
  });

  it("folds content lines longer than 75 octets", () => {
    const ics = buildLockedIcs({ ...datesPoll, title: "x".repeat(120) }, fixed);
    for (const l of lines(ics)) {
      // Folded continuation lines begin with a space; no logical line exceeds 75.
      expect(l.length).toBeLessThanOrEqual(75);
    }
    expect(ics).toContain("\r\n "); // a fold actually happened
  });

  it("folds multibyte titles on octet boundaries without corrupting code points", () => {
    const enc = new TextEncoder();
    const ics = buildLockedIcs({ ...datesPoll, title: "🎉".repeat(40) }, fixed);
    for (const l of lines(ics)) {
      expect(enc.encode(l).length).toBeLessThanOrEqual(75); // octets, not chars
    }
    expect(ics).not.toContain("�"); // no surrogate split → replacement char
    // Unfold (CRLF + single space) and recover the title intact.
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${"🎉".repeat(40)}`);
  });

  it("strips control characters and neutralizes a bare CR in text fields", () => {
    const cr = String.fromCharCode(13);
    const bell = String.fromCharCode(7);
    // bell is stripped; the bare CR becomes an escaped newline.
    const ics = buildLockedIcs(
      { ...datesPoll, title: `a${bell}b${cr}c` },
      fixed,
    );
    expect(lines(ics)).toContain("SUMMARY:ab\\nc");
  });
});

describe("icsFilename", () => {
  it("slugifies the title", () => {
    expect(icsFilename("Team Offsite 2099!")).toBe("team-offsite-2099.ics");
  });
  it("falls back to 'event' for an empty slug", () => {
    expect(icsFilename("———")).toBe("event.ics");
  });
});
