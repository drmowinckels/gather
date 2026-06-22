import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";

export const TOKEN_FILE = join(homedir(), ".samkoma");

function load(file: string): Record<string, string> {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveToken(
  id: string,
  token: string,
  file: string = TOKEN_FILE,
): void {
  const all = load(file);
  all[id] = token;
  writeFileSync(file, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 });
  // `mode` only applies when the file is created; chmod enforces 0600 on an
  // existing file too. The edit token is a secret that gates host actions.
  chmodSync(file, 0o600);
}

export function getToken(
  id: string,
  file: string = TOKEN_FILE,
): string | undefined {
  return load(file)[id];
}
