import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

const createPoll = vi.fn();
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  createPoll: (...args: unknown[]) => createPoll(...args),
  ApiError: class ApiError extends Error {},
}));

import { CreatePoll } from "./CreatePoll";

function renderForm() {
  return render(
    <MemoryRouter>
      <CreatePoll />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigate.mockReset();
  createPoll.mockReset();
});

describe("CreatePoll", () => {
  it("disables submit until a title and at least one day are set", async () => {
    const user = userEvent.setup();
    renderForm();

    const submit = screen.getByRole("button", { name: /create poll/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Event name"), "Standup");
    expect(submit).toBeDisabled();

    const day = [
      ...document.querySelectorAll<HTMLButtonElement>("[data-iso]"),
    ].find(
      (c) =>
        !(c as HTMLButtonElement).disabled &&
        c.getAttribute("aria-pressed") === "false",
    )!;
    await user.click(day);

    expect(submit).toBeEnabled();
  });

  it("creates the poll and navigates to its page on submit", async () => {
    createPoll.mockResolvedValue({
      id: "9fK2qd",
      url: "x/#/e/9fK2qd",
      editToken: "secret-token",
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Event name"), "Standup");
    const day = [
      ...document.querySelectorAll<HTMLButtonElement>("[data-iso]"),
    ].find(
      (c) =>
        !(c as HTMLButtonElement).disabled &&
        c.getAttribute("aria-pressed") === "false",
    )!;
    await user.click(day);

    await user.click(screen.getByRole("button", { name: /create poll/i }));

    await waitFor(() => expect(createPoll).toHaveBeenCalledTimes(1));
    const payload = createPoll.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Standup",
      from: "09:00",
      to: "17:00",
      slot: 30,
      public: true,
    });
    expect(payload.days).toHaveLength(1);
    expect(typeof payload.tz).toBe("string");

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/e/9fK2qd"));
    expect(localStorage.getItem("samkoma:edit:9fK2qd")).toBe("secret-token");
  });

  it("sends resultsHidden when the hide-results toggle is on", async () => {
    createPoll.mockResolvedValue({ id: "h1", url: "x", editToken: "t" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Event name"), "Standup");
    const day = [
      ...document.querySelectorAll<HTMLButtonElement>("[data-iso]"),
    ].find(
      (c) =>
        !(c as HTMLButtonElement).disabled &&
        c.getAttribute("aria-pressed") === "false",
    )!;
    await user.click(day);
    await user.click(screen.getByLabelText(/hide results until i reveal/i));
    await user.click(screen.getByRole("button", { name: /create poll/i }));

    await waitFor(() => expect(createPoll).toHaveBeenCalledTimes(1));
    expect(createPoll.mock.calls[0][0].resultsHidden).toBe(true);
  });

  it("creates a weekday poll when the 'Days of the week' type is chosen", async () => {
    createPoll.mockResolvedValue({ id: "wk", url: "x", editToken: "t" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Event name"), "Standup");
    await user.click(screen.getByRole("radio", { name: /days of the week/i }));
    await user.click(screen.getByRole("button", { name: "Mon" }));
    await user.click(screen.getByRole("button", { name: "Wed" }));
    await user.click(screen.getByRole("button", { name: /create poll/i }));

    await waitFor(() => expect(createPoll).toHaveBeenCalledTimes(1));
    const payload = createPoll.mock.calls[0][0];
    expect(payload.kind).toBe("weekdays");
    expect(payload.days).toEqual(["mon", "wed"]); // week order
  });
});

describe("CreatePoll — duplicate prefill", () => {
  function renderWithTemplate(template: unknown) {
    return render(
      <MemoryRouter
        initialEntries={[{ pathname: "/new", state: { template } }]}
      >
        <CreatePoll />
      </MemoryRouter>,
    );
  }

  it("prefills settings and clears the dates of a dates poll", () => {
    renderWithTemplate({
      title: "Team offsite",
      kind: "dates",
      days: [],
      from: "10:00",
      to: "16:00",
      slot: 60,
      tz: "Europe/Oslo",
      public: false,
      resultsHidden: true,
    });
    expect(
      screen.getByRole("heading", { name: /duplicate poll/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Event name")).toHaveValue("Team offsite");
    expect(screen.getByLabelText(/no earlier than/i)).toHaveValue("10:00");
    expect(screen.getByLabelText(/no later than/i)).toHaveValue("16:00");
    expect(screen.getByText("No days selected yet.")).toBeInTheDocument();
  });

  it("carries weekday tokens through and submits them unchanged", async () => {
    createPoll.mockResolvedValue({ id: "d1", url: "x", editToken: "t" });
    const user = userEvent.setup();
    renderWithTemplate({
      title: "Weekly standup",
      kind: "weekdays",
      days: ["mon", "wed"],
      from: "09:00",
      to: "10:00",
      slot: 30,
      tz: "UTC",
      public: true,
      resultsHidden: false,
    });
    expect(screen.getByRole("button", { name: "Mon" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: /create poll/i }));
    await waitFor(() => expect(createPoll).toHaveBeenCalledTimes(1));
    expect(createPoll.mock.calls[0][0]).toMatchObject({
      kind: "weekdays",
      days: ["mon", "wed"],
      from: "09:00",
      public: true,
    });
  });
});
