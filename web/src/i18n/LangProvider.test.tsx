import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider, useLocale, useT } from "./index";

function Probe() {
  const [locale, setLocale] = useLocale();
  const t = useT();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t("nav.newPoll")}</span>
      <button type="button" onClick={() => setLocale("nb")}>
        to nb
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <LangProvider>
      <Probe />
    </LangProvider>,
  );
}

describe("LangProvider", () => {
  it("defaults to English when the browser locale is en-US", () => {
    renderProbe();
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByTestId("label")).toHaveTextContent("New poll");
    expect(document.documentElement.lang).toBe("en");
  });

  it("switches locale, re-rendering translations and reflecting <html lang>", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole("button", { name: "to nb" }));
    expect(screen.getByTestId("locale")).toHaveTextContent("nb");
    expect(screen.getByTestId("label")).toHaveTextContent("Ny avstemning");
    expect(document.documentElement.lang).toBe("nb");
  });

  it("persists the chosen locale to localStorage", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole("button", { name: "to nb" }));
    expect(localStorage.getItem("samkoma-lang")).toBe("nb");
  });

  it("honours a previously saved locale over the browser default", () => {
    localStorage.setItem("samkoma-lang", "nb");
    renderProbe();
    expect(screen.getByTestId("locale")).toHaveTextContent("nb");
    expect(screen.getByTestId("label")).toHaveTextContent("Ny avstemning");
  });

  it("falls back to the default locale outside a provider", () => {
    render(<Probe />);
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByTestId("label")).toHaveTextContent("New poll");
  });
});
