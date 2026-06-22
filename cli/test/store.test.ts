import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveToken, getToken } from "../src/store";

let dir: string | undefined;

function tmpFile(): string {
  dir = mkdtempSync(join(tmpdir(), "samkoma-store-"));
  return join(dir, ".samkoma");
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("token store", () => {
  it("round-trips a token by id", () => {
    const f = tmpFile();
    saveToken("abc123", "secret-token", f);
    expect(getToken("abc123", f)).toBe("secret-token");
    expect(getToken("missing", f)).toBeUndefined();
  });

  it("tightens permissions to 0600 even when the file already existed loosely", () => {
    const f = tmpFile();
    writeFileSync(f, "{}", { mode: 0o644 });
    saveToken("abc123", "secret-token", f);
    expect(statSync(f).mode & 0o777).toBe(0o600);
  });
});
