import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "../i18n";
import { FormatMenu } from "./FormatMenu";

function renderMenu() {
  return render(
    <LangProvider>
      <FormatMenu />
    </LangProvider>,
  );
}

describe("FormatMenu", () => {
  it("defaults to Auto and is collapsed", () => {
    renderMenu();
    const trigger = screen.getByRole("button", {
      name: "Date and time format",
    });
    expect(trigger).toHaveTextContent("Auto");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("opens and switches the time format", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", {
      name: "Date and time format",
    });
    await user.click(trigger);

    const timeGroup = screen.getByRole("radiogroup", { name: "Time" });
    await user.click(within(timeGroup).getByRole("radio", { name: "24h" }));

    expect(within(timeGroup).getByRole("radio", { name: "24h" })).toBeChecked();
    expect(trigger).toHaveTextContent("24h");
  });

  it("switches the date format to ISO", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      screen.getByRole("button", { name: "Date and time format" }),
    );

    const dateGroup = screen.getByRole("radiogroup", { name: "Date" });
    await user.click(within(dateGroup).getByRole("radio", { name: "ISO" }));

    expect(within(dateGroup).getByRole("radio", { name: "ISO" })).toBeChecked();
  });
});
