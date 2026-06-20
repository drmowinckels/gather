import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const createPollSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    days: z.array(z.string().regex(ISO_DATE)).min(1).max(60),
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
  .refine((d) => d.from < d.to, {
    message: "from must be earlier than to",
    path: ["from"],
  });

export type CreatePollInput = z.infer<typeof createPollSchema>;

const SLOT_KEY = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export const submitSlotsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  tz: z.string().min(1).max(64).refine(isValidTimezone, {
    message: "tz must be a valid IANA timezone",
  }),
  slots: z.array(z.string().regex(SLOT_KEY)).max(5000),
});

export type SubmitSlotsInput = z.infer<typeof submitSlotsSchema>;
