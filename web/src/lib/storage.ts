const EDIT_PREFIX = "samkoma:edit:";
const SLOTS_PREFIX = "samkoma:slots:";
const SECRET_PREFIX = "samkoma:secret:";
const NAME_KEY = "samkoma:name";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode / disabled) — feature degrades gracefully
  }
}

export function saveEditToken(pollId: string, token: string): void {
  write(EDIT_PREFIX + pollId, token);
}

export function getEditToken(pollId: string): string | null {
  return read(EDIT_PREFIX + pollId);
}

// The secret that lets this browser keep editing a response it owns — the token
// the server minted, or the password the visitor chose. Keyed per (poll, name).
function secretKey(pollId: string, name: string): string {
  return `${SECRET_PREFIX}${pollId}:${name}`;
}

export function saveResponseSecret(
  pollId: string,
  name: string,
  secret: string,
): void {
  write(secretKey(pollId, name), secret);
}

export function getResponseSecret(pollId: string, name: string): string | null {
  return read(secretKey(pollId, name));
}

export function saveName(name: string): void {
  write(NAME_KEY, name);
}

export function getName(): string {
  return read(NAME_KEY) ?? "";
}

export interface OwnMarks {
  slots: string[];
  maybe: string[];
}

// Cache the visitor's own availability so reload restores it even when a private
// poll hides the response list from non-hosts.
export function saveOwnMarks(pollId: string, marks: OwnMarks): void {
  write(SLOTS_PREFIX + pollId, JSON.stringify(marks));
}

export function getOwnMarks(pollId: string): OwnMarks | null {
  const raw = read(SLOTS_PREFIX + pollId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.slots) && Array.isArray(parsed.maybe)) {
      return parsed as OwnMarks;
    }
    return null;
  } catch {
    return null;
  }
}
