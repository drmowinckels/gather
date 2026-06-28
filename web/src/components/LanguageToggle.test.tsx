import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "../i18n";
import { LanguageToggle } from "./LanguageToggle";

function renderToggle() {
  return render(
    <LangProvider>
      <LanguageToggle />
    </LangProvider>,
  );
}

describe("LanguageToggle", () => {
  it("shows the current locale and offers to switch to the next", () => {
    renderToggle();
    const button = screen.getByRole("button", {
      name: "Switch language to Norsk",
    });
    expect(button).toHaveTextContent("EN");
  });

  it("cycles to the next locale on click, localizing its own label", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button"));
    const button = screen.getByRole("button", {
      name: "Bytt språk til English",
    });
    expect(button).toHaveTextContent("NB");
  });
});
