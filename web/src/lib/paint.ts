export type PaintMode = "fill" | "erase";

// Dragging from a free cell erases; dragging from a busy cell fills.
export function modeFor(slots: Set<string>, key: string): PaintMode {
  return slots.has(key) ? "erase" : "fill";
}

export function applyPaint(
  slots: Set<string>,
  key: string,
  mode: PaintMode,
): Set<string> {
  const next = new Set(slots);
  if (mode === "fill") next.add(key);
  else next.delete(key);
  return next;
}
