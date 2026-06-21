export type Status = "yes" | "maybe";
export type Marks = Map<string, Status>;

// Tap/drag cycles a cell: busy -> available -> maybe -> busy.
export function cycleNext(current: Status | undefined): Status | undefined {
  if (current === undefined) return "yes";
  if (current === "yes") return "maybe";
  return undefined;
}

export function applyMark(
  marks: Marks,
  key: string,
  target: Status | undefined,
): Marks {
  const next = new Map(marks);
  if (target === undefined) next.delete(key);
  else next.set(key, target);
  return next;
}

// Build the paint state from a saved response's two arrays.
export function marksFrom(slots: string[], maybe: string[]): Marks {
  const m: Marks = new Map();
  for (const k of slots) m.set(k, "yes");
  for (const k of maybe) if (!m.has(k)) m.set(k, "maybe");
  return m;
}

// Split the paint state back into the two arrays the API expects.
export function splitMarks(marks: Marks): { slots: string[]; maybe: string[] } {
  const slots: string[] = [];
  const maybe: string[] = [];
  for (const [key, status] of marks) {
    (status === "yes" ? slots : maybe).push(key);
  }
  return { slots, maybe };
}
