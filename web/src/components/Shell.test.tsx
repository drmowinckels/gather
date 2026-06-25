import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Shell } from "./Shell";
import { GITHUB_URL, SUPPORT_URL } from "../lib/links";

function renderShell(props: { showNewPoll?: boolean } = {}) {
  return render(
    <MemoryRouter>
      <Shell {...props}>
        <p>content</p>
      </Shell>
    </MemoryRouter>,
  );
}

describe("Shell", () => {
  it("renders the primary nav links and the new-poll button", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "API" })).toHaveAttribute(
      "href",
      "/api",
    );
    expect(within(nav).getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(within(nav).getByRole("link", { name: /github/i })).toHaveAttribute(
      "href",
      GITHUB_URL,
    );
    expect(
      within(nav).getByRole("link", { name: /new poll/i }),
    ).toHaveAttribute("href", "/new");
  });

  it("hides the new-poll button when showNewPoll is false", () => {
    renderShell({ showNewPoll: false });
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).queryByRole("link", { name: /new poll/i })).toBeNull();
  });

  it("surfaces support, docs and project links in the footer", () => {
    renderShell();
    const footer = screen.getByRole("navigation", { name: "Footer" });
    expect(
      within(footer).getByRole("link", { name: /buy me a coffee/i }),
    ).toHaveAttribute("href", SUPPORT_URL);
    expect(
      within(footer).getByRole("link", { name: /^docs/i }).getAttribute("href"),
    ).toContain("/docs");
  });

  it("offers a skip link that targets the main landmark", () => {
    renderShell();
    const skip = screen.getByRole("link", { name: /skip to content/i });
    expect(skip).toHaveAttribute("href", "#main");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("toggles the colour theme", async () => {
    const user = userEvent.setup();
    renderShell();
    const before = document.documentElement.getAttribute("data-theme");
    await user.click(screen.getByRole("button", { name: /switch to/i }));
    expect(document.documentElement.getAttribute("data-theme")).not.toBe(
      before,
    );
  });
});
