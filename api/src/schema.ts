import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEKDAY_SET = new Set<string>(WEEKDAYS);

function isRealDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// A `days` entry is valid if it matches the poll kind: a real calendar date for
// "dates", a weekday token (mon–sun) for "weekdays".
function checkDays(
  kind: "dates" | "weekdays",
  days: string[],
  ctx: z.RefinementCtx,
): void {
  days.forEach((day, i) => {
    const ok =
      kind === "dates"
        ? ISO_DATE.test(day) && isRealDate(day)
        : WEEKDAY_SET.has(day);
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days", i],
        message:
          kind === "dates"
            ? "must be a real calendar date"
            : "must be a weekday (mon–sun)",
      });
    }
  });
}

export const createPollSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    kind: z.enum(["dates", "weekdays"]).default("dates"),
    days: z.array(z.string()).min(1).max(60),
    from: z.string().regex(HHMM),
    to: z.string().regex(HHMM),
    slot: z
      .number()
      .int()
      .refine((v) => [15, 30, 60].includes(v), {
        message: "slot must be 15, 30 or 60 minutes",
      }),
    tz: z.string().min(1).max(64).refine(isValidTimezone, {
      message: "tz must be a valid IANA timezone",
    }),
    public: z.boolean().optional().default(false),
  })
  .superRefine((d, ctx) => {
    checkDays(d.kind, d.days, ctx);
    if (d.from >= d.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "from must be earlier than to",
      });
    }
  });

export type CreatePollInput = z.infer<typeof createPollSchema>;

// Patch days may be dates or weekdays; the handler enforces the kind and the
// additive-only rule against the poll's existing slot grid.
const dayString = z
  .string()
  .refine((s) => (ISO_DATE.test(s) && isRealDate(s)) || WEEKDAY_SET.has(s), {
    message: "must be a real calendar date or a weekday",
  });

// Partial edit of a poll. Every field is optional, but at least one must be
// present. The from/to ordering is enforced in the handler against the merged
// (existing + patched) values, since a body may carry only one of them.
export const patchPollSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    days: z.array(dayString).min(1).max(60).optional(),
    from: z.string().regex(HHMM).optional(),
    to: z.string().regex(HHMM).optional(),
    slot: z
      .number()
      .int()
      .refine((v) => [15, 30, 60].includes(v), {
        message: "slot must be 15, 30 or 60 minutes",
      })
      .optional(),
    public: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "provide at least one field to update",
  });

export type PatchPollInput = z.infer<typeof patchPollSchema>;

// Slot keys are "YYYY-MM-DDThh:mm" (dated polls) or "monThh:mm" (weekday polls).
const SLOT_KEY =
  /^(\d{4}-\d{2}-\d{2}|mon|tue|wed|thu|fri|sat|sun)T([01]\d|2[0-3]):[0-5]\d$/;

export const submitSlotsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  tz: z.string().min(1).max(64).refine(isValidTimezone, {
    message: "tz must be a valid IANA timezone",
  }),
  slots: z.array(z.string().regex(SLOT_KEY)).max(5000),
  maybe: z.array(z.string().regex(SLOT_KEY)).max(5000).optional().default([]),
  // The secret that owns this name: a previously-issued response token, or the
  // respondent's chosen password. Absent on a first, unprotected write.
  secret: z.string().min(1).max(200).optional(),
});

export type SubmitSlotsInput = z.infer<typeof submitSlotsSchema>;

export const lockSchema = z.object({
  slot: z.string().regex(SLOT_KEY).nullable(),
});

export type LockInput = z.infer<typeof lockSchema>;
