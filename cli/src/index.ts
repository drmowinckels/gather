#!/usr/bin/env node
import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { SamkomaClient } from "samkoma-client";
import { buildCreateBody, buildEditBody } from "./lib.js";
import { saveToken, getToken, TOKEN_FILE } from "./store.js";

const DEFAULT_API =
  process.env.SAMKOMA_API ?? "https://api.samkoma.drmowinckels.io";

const HELP = `samkoma — group scheduling from the command line

Usage:
  samkoma new "<title>" [options]     Create a poll
  samkoma edit <id> [options]         Edit a poll, host only (add days / extend / rename)
  samkoma best <id> [--limit N]       Show where availability converges
  samkoma lock <id> <slot>            Lock in a slot (host only)
  samkoma unlock <id>                 Unlock (host only)
  samkoma ics <id> [--out <file>]     Export the locked slot as a calendar (.ics)

Options for "new":
  --days <spec>   Dates ("2026-07-15,2026-07-16") or, with --weekdays, weekday
                  tokens/ranges ("mon-fri", "tue,thu")
  --weekdays      Make a recurring days-of-the-week poll (times stay in --tz);
                  without it, --days weekdays resolve to their next dates
  --from <HH:MM>  Earliest time (default 09:00)
  --to <HH:MM>    Latest time (default 17:00)
  --slot <min>    Slot size: 15, 30 or 60 (default 30)
  --tz <IANA>     Timezone (default: your system timezone)
  --public        Make group results public
  --hide-results  Hide the aggregate from respondents until you reveal it

Options for "edit" (only the flags you pass are changed; editing is additive —
you can add days or widen the window, but not drop slots people may have voted on):
  --title <text>  Rename the poll
  --days <spec>   New day set (must include all current days)
  --from <HH:MM>  Widen the window earlier (must stay on the slot grid)
  --to <HH:MM>    Widen the window later
  --public        Make results public      --private  Make results private
  --hide-results  Hide results from respondents   --reveal  Reveal them

  --api <url>     API base (default: $SAMKOMA_API or ${DEFAULT_API})
`;

function systemTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function prettySlot(key: string): string {
  return key.replace("T", " ");
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      title: { type: "string" },
      days: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      slot: { type: "string" },
      tz: { type: "string" },
      public: { type: "boolean" },
      private: { type: "boolean" },
      weekdays: { type: "boolean" },
      "hide-results": { type: "boolean" },
      reveal: { type: "boolean" },
      limit: { type: "string" },
      out: { type: "string" },
      api: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const api = values.api ?? DEFAULT_API;
  const client = new SamkomaClient({ baseUrl: api });
  const command = positionals[0];

  if (values.help || !command || command === "help") {
    process.stdout.write(HELP);
    return;
  }

  if (command === "new") {
    const title = positionals[1];
    if (!title) throw new Error('Usage: samkoma new "<title>" --days <spec>');
    if (!values.days)
      throw new Error("--days is required (e.g. --days mon-fri)");
    const body = buildCreateBody({
      title,
      days: values.days,
      from: values.from,
      to: values.to,
      slot: values.slot,
      tz: values.tz ?? systemTz(),
      public: values.public ?? false,
      weekdays: values.weekdays ?? false,
      hideResults: values["hide-results"] ?? false,
    });
    const created = await client.createPoll(body);
    saveToken(created.id, created.editToken);
    console.log("✓ poll created");
    console.log(`  → ${created.url}`);
    console.log(
      `  ${body.days.length} day(s), ${body.from}–${body.to}, ${body.slot}-min slots, ${body.tz}`,
    );
    console.log(`  edit token saved to ${TOKEN_FILE}`);
    return;
  }

  if (command === "edit") {
    const id = positionals[1];
    if (!id) throw new Error("Usage: samkoma edit <id> [options]");
    const token = getToken(id);
    if (!token) {
      throw new Error(
        `No edit token for "${id}" in ${TOKEN_FILE} — only the host who created the poll can edit it.`,
      );
    }
    if (values.public && values.private) {
      throw new Error("Pass either --public or --private, not both");
    }
    if (values["hide-results"] && values.reveal) {
      throw new Error("Pass either --hide-results or --reveal, not both");
    }
    const isPublic = values.public ? true : values.private ? false : undefined;
    const resultsHidden = values["hide-results"]
      ? true
      : values.reveal
        ? false
        : undefined;
    const body = buildEditBody({
      title: values.title,
      days: values.days,
      from: values.from,
      to: values.to,
      slot: values.slot,
      public: isPublic,
      resultsHidden,
    });
    const poll = await client.editPoll(id, body, token);
    console.log("✓ poll updated");
    console.log(`  ${poll.title}`);
    console.log(`  ${poll.days.length} day(s), ${poll.from}–${poll.to}`);
    return;
  }

  if (command === "best") {
    const id = positionals[1];
    if (!id) throw new Error("Usage: samkoma best <id>");
    let limit: number | undefined;
    if (values.limit !== undefined) {
      limit = Number.parseInt(values.limit, 10);
      if (!Number.isFinite(limit) || limit < 1) {
        throw new Error("--limit must be a positive integer");
      }
    }
    const best = await client.getBest(id, { limit });
    if (best.results.length === 0) {
      console.log("No availability yet.");
      return;
    }
    console.log(`${best.total} response(s) — best slots:`);
    for (const r of best.results) {
      console.log(
        `  ${prettySlot(r.slot)}  ${r.count}/${best.total}  (${r.names.join(", ")})`,
      );
    }
    return;
  }

  if (command === "ics") {
    const id = positionals[1];
    if (!id) throw new Error("Usage: samkoma ics <id> [--out <file>]");
    const ics = await client.getIcs(id);
    if (values.out) {
      writeFileSync(values.out, ics);
      console.log(`✓ wrote ${values.out}`);
    } else {
      process.stdout.write(ics);
    }
    return;
  }

  if (command === "lock" || command === "unlock") {
    const id = positionals[1];
    if (!id)
      throw new Error(
        `Usage: samkoma ${command} <id>${command === "lock" ? " <slot>" : ""}`,
      );
    const token = getToken(id);
    if (!token) {
      throw new Error(
        `No edit token for "${id}" in ${TOKEN_FILE} — only the host who created the poll can ${command} it.`,
      );
    }
    const slot = command === "lock" ? positionals[2] : null;
    if (command === "lock" && !slot) {
      throw new Error(
        "Usage: samkoma lock <id> <slot>  (e.g. 2026-07-15T09:00)",
      );
    }
    const poll =
      command === "lock"
        ? await client.lock(id, slot as string, token)
        : await client.unlock(id, token);
    console.log(
      poll.lockedSlot
        ? `✓ locked in ${prettySlot(poll.lockedSlot)}`
        : "✓ unlocked",
    );
    return;
  }

  throw new Error(`Unknown command: "${command}". Run "samkoma --help".`);
}

main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
