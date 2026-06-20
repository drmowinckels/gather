import { describe, it, expect } from "vitest";
import { expiryDate, isExpired } from "../src/dates";

describe("expiryDate", () => {
  it("is the latest day plus the grace period", () => {
    expect(
      expiryDate(["2099-07-15", "2099-07-10", "2099-07-17"], 14),
    ).toBe("2099-07-31");
  });

  it("rolls over month boundaries", () => {
    expect(expiryDate(["2099-07-25"], 14)).toBe("2099-08-08");
  });
});

describe("isExpired", () => {
  it("is true only strictly past the expiry date", () => {
    expect(isExpired("2099-07-31", "2099-08-01")).toBe(true);
    expect(isExpired("2099-07-31", "2099-07-31")).toBe(false);
    expect(isExpired("2099-07-31", "2099-07-01")).toBe(false);
  });

  it("treats null (legacy rows) as never expiring", () => {
    expect(isExpired(null, "2099-08-01")).toBe(false);
  });
});
