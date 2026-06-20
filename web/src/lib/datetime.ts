export function listTimezones(): string[] {
  const sof = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf;
  if (typeof sof === "function") {
    try {
      return sof("timeZone");
    } catch {
      // fall through to a small default set
    }
  }
  return [
    "UTC",
    "Europe/Oslo",
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
  ];
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function tzOffsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    return name ?? "";
  } catch {
    return "";
  }
}

const ISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export interface DayOption {
  iso: string;
  label: string;
}

export function upcomingDays(count: number, start = new Date()): DayOption[] {
  const out: DayOption[] = [];
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
  });
  for (let i = 0; i < count; i++) {
    const d = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
    );
    out.push({ iso: ISO(d), label: fmt.format(d) });
  }
  return out;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const pad = (n: number): string => String(n).padStart(2, "0");

// Start times of each slot block within [from, to), stepping by slotMin.
export function timeSlots(from: string, to: string, slotMin: number): string[] {
  const start = toMinutes(from);
  const end = toMinutes(to);
  const out: string[] = [];
  for (let t = start; t + slotMin <= end; t += slotMin) {
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
}

export function slotKey(day: string, time: string): string {
  return `${day}T${time}`;
}

// Label shown in the time gutter — only on the hour, e.g. "9am", "12pm".
export function hourLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (m !== 0) return "";
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ampm}`;
}

export function dayHeader(iso: string): { weekday: string; day: string } {
  const d = new Date(`${iso}T00:00:00`);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(d),
  };
}

export function formatDayRange(days: string[]): string {
  if (days.length === 0) return "No days yet";
  const sorted = [...days].sort();
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const label = (iso: string) => fmt.format(new Date(`${iso}T00:00:00`));
  if (sorted.length === 1) return label(sorted[0]);
  return `${label(sorted[0])} – ${label(sorted[sorted.length - 1])} · ${sorted.length} days`;
}
