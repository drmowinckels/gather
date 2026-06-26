export interface CsvResponse {
  name: string;
  slots: string[];
  maybe?: string[];
  group?: string;
}

// RFC 4180: a field is quoted (and embedded quotes doubled) when it contains a
// comma, a quote, or a newline. Leading/trailing spaces are preserved as-is.
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(",");
}

// Tidy (long) CSV of every painted slot: one row per (respondent, slot), with a
// `status` of "available" or "maybe". Slot keys are canonical (the poll's home
// tz) — the same form the rest of the API uses. Rows are ordered by slot, then
// available before maybe, then name, so the file is stable and diff-friendly.
// CRLF line endings per RFC 4180.
export function responsesToCsv(responses: CsvResponse[]): string {
  const rows: {
    name: string;
    slot: string;
    status: string;
    group: string;
    rank: number;
  }[] = [];
  for (const r of responses) {
    const group = r.group ?? "";
    for (const slot of r.slots)
      rows.push({ name: r.name, slot, status: "available", group, rank: 0 });
    for (const slot of r.maybe ?? [])
      rows.push({ name: r.name, slot, status: "maybe", group, rank: 1 });
  }
  rows.sort(
    (a, b) =>
      a.slot.localeCompare(b.slot) ||
      a.rank - b.rank ||
      a.name.localeCompare(b.name),
  );
  const lines = [csvRow(["name", "slot", "status", "group"])];
  for (const row of rows)
    lines.push(csvRow([row.name, row.slot, row.status, row.group]));
  return lines.join("\r\n") + "\r\n";
}

// A filesystem-safe ".csv" filename derived from the poll title.
export function csvFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "poll"}-availability.csv`;
}
