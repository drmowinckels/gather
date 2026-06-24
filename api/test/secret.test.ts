import { describe, it, expect } from "vitest";
import { mintResponseToken, hashSecret, verifySecret } from "../src/secret";

describe("response secret hashing", () => {
  it("verifies a secret against its own hash", async () => {
    const hash = await hashSecret("hunter2");
    expect(await verifySecret("hunter2", hash)).toBe(true);
    expect(await verifySecret("wrong", hash)).toBe(false);
  });

  it("stores only a hash, never the plaintext, and salts each hash", async () => {
    const a = await hashSecret("same");
    const b = await hashSecret("same");
    expect(a).not.toContain("same");
    expect(a).not.toBe(b); // distinct salts
    expect(a.startsWith("pbkdf2$100000$")).toBe(true);
    // both still verify despite different salts
    expect(await verifySecret("same", a)).toBe(true);
    expect(await verifySecret("same", b)).toBe(true);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifySecret("x", "not-a-hash")).toBe(false);
    expect(await verifySecret("x", "pbkdf2$abc$00$00")).toBe(false); // bad iters
    expect(await verifySecret("x", "pbkdf2$1000$gg$00")).toBe(false); // non-hex salt
    expect(await verifySecret("x", "pbkdf2$1000$0$00")).toBe(false); // odd-length hex
    expect(await verifySecret("x", "")).toBe(false);
  });

  it("mints high-entropy, unique tokens", () => {
    const a = mintResponseToken();
    const b = mintResponseToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/); // 24 bytes hex
    expect(a).not.toBe(b);
  });
});
