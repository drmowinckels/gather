import { describe, it, expect } from "vitest";
import { shortId, editToken } from "../src/id";

const ALPHABET = /^[0-9A-Za-z]+$/;

describe("shortId", () => {
  it("returns the requested length using only the alphabet", () => {
    expect(shortId()).toHaveLength(6);
    expect(shortId(10)).toHaveLength(10);
    for (let i = 0; i < 50; i++) expect(shortId()).toMatch(ALPHABET);
  });

  it("covers the whole alphabet over many draws (no truncated range)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) for (const ch of shortId(12)) seen.add(ch);
    // Plain modulo bias would still hit every char; this guards the sampler
    // doesn't get stuck or collapse the range.
    expect(seen.size).toBeGreaterThan(50); // of 62
  });
});

describe("editToken", () => {
  it("is 48 lowercase hex chars (24 random bytes)", () => {
    expect(editToken()).toMatch(/^[0-9a-f]{48}$/);
    expect(editToken()).not.toBe(editToken());
  });
});
