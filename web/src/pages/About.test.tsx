import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { About } from "./About";
import { SUPPORT_URL } from "../lib/links";

function renderAbout() {
  return render(
    <MemoryRouter>
      <About />
    </MemoryRouter>,
  );
}

describe("About", () => {
  it("explains the why with the philosophy principles", () => {
    renderAbout();
    expect(
      screen.getByRole("heading", {
        name: /we made the boring part painless/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /no accounts, ever/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /api-first, not api-eventually/i }),
    ).toBeInTheDocument();
  });

  it("names the maintainer and origin", () => {
    renderAbout();
    expect(screen.getByText(/dr\. athanasia mowinckel/i)).toBeInTheDocument();
    expect(screen.getByText(/rladies\+ community bot/i)).toBeInTheDocument();
  });

  it("offers a Buy Me a Coffee support link", () => {
    renderAbout();
    const links = screen.getAllByRole("link", { name: /buy me a coffee/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    links.forEach((l) => expect(l).toHaveAttribute("href", SUPPORT_URL));
  });
});
