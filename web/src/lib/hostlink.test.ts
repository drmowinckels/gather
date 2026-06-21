import { describe, it, expect } from "vitest";
import { parseHostToken, buildHostLink } from "./hostlink";

describe("parseHostToken", () => {
  it("reads the host token from a hash query", () => {
    expect(parseHostToken("#/e/abc?host=xyz")).toBe("xyz");
  });
  it("returns null when absent", () => {
    expect(parseHostToken("#/e/abc")).toBeNull();
    expect(parseHostToken("#/e/abc?other=1")).toBeNull();
  });
});

describe("buildHostLink", () => {
  it("appends the token, replacing any existing query", () => {
    expect(buildHostLink("https://h/#/e/abc", "tok")).toBe(
      "https://h/#/e/abc?host=tok",
    );
    expect(buildHostLink("https://h/#/e/abc?host=old", "new")).toBe(
      "https://h/#/e/abc?host=new",
    );
  });
});
