import type { Poll, PollKind } from "./api";

// The subset of a poll's settings that prefill a new poll's create form. No
// responses, lock, deadline or expiry — a duplicate is a fresh poll that only
// reuses the shape.
export interface PollTemplate {
  title: string;
  kind: PollKind;
  days: string[];
  from: string;
  to: string;
  slot: number;
  tz: string;
  public: boolean;
  resultsHidden: boolean;
}

// Build a create-form prefill from an existing poll. Specific calendar dates are
// dropped — they're likely in the past and would make an already-expired poll —
// so the duplicator picks fresh dates; recurring weekday tokens carry over.
export function pollToTemplate(poll: Poll): PollTemplate {
  return {
    title: poll.title,
    kind: poll.kind,
    days: poll.kind === "weekdays" ? poll.days : [],
    from: poll.from,
    to: poll.to,
    slot: poll.slot,
    tz: poll.tz,
    public: poll.public,
    resultsHidden: poll.resultsHidden,
  };
}
