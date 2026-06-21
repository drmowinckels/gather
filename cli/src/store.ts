import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

export const TOKEN_FILE = join(homedir(), ".samkoma");

function load(): Record<string, string> {
  try {
    const parsed = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveToken(id: string, token: string): void {
  const all = load();
  all[id] = token;
  // 0600 — the edit token is a secret that gates host actions.
  writeFileSync(TOKEN_FILE, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 });
}

export function getToken(id: string): string | undefined {
  return load()[id];
}
