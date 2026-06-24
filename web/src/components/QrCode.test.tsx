import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QrCode } from "./QrCode";

describe("QrCode", () => {
  it("renders an accessible QR svg with module geometry for the value", () => {
    render(
      <QrCode value="https://samkoma.example/#/e/abc123" label="QR for poll" />,
    );
    const img = screen.getByRole("img", { name: /qr for poll/i });
    const path = img.querySelector("path");
    expect(path).toBeTruthy();
    // a non-trivial QR has many dark modules → a long path
    expect((path?.getAttribute("d") ?? "").length).toBeGreaterThan(50);
  });

  it("offers SVG and PNG downloads", () => {
    render(<QrCode value="x" label="QR" />);
    expect(screen.getByRole("button", { name: /download svg/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /png/i })).toBeTruthy();
  });
});
