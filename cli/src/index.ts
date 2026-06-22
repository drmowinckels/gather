#!/usr/bin/env node
import { parseArgs } from "node:util";
import { buildCreateBody } from "./lib.js";
import { createPoll, getBest, lockSlot } from "./api.js";
import { saveToken, getToken, TOKEN_FILE } from "./store.js";

const DEFAULT_API = process.env.SAMKOMA_API ?? "https://api.samkoma.drmowinckels.io";

const HELP = `samkoma — group scheduling from the command line

Usage:
  samkoma new "<title>" [options]     Create a poll
  samkoma best <id> [--limit N]       Show where availability converges
  samkoma lock <id> <slot>            Lock in a slot (host only)
  samkoma unlock <id>                 Unlock (host only)

Options for "new":
  --days <spec>   ISO dates or weekdays, e.g. "mon-fri" or "2026-07-15,2026-07-16"
  --from <HH:MM>  Earliest time (default 09:00)
  --to <HH:MM>    Latest time (default 17:00)
  --slot <min>    Slot size: 15, 30 or 60 (default 30)
  --tz <IANA>     Timezone (default: your system timezone)
  --public        Make group results public

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
      days: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      slot: { type: "string" },
      tz: { type: "string" },
      public: { type: "boolean", default: false },
      limit: { type: "string" },
      api: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const api = values.api ?? DEFAULT_API;
  const command = positionals[0];

  if (values.help || !command || command === "help") {
    process.stdout.write(HELP);
    return;
  }

  if (command === "new") {
    const title = positionals[1];
    if (!title) throw new Error('Usage: samkoma new "<title>" --days <spec>');
    if (!values.days) throw new Error("--days is required (e.g. --days mon-fri)");
    const body = buildCreateBody({
      title,
      days: values.days,
      from: values.from,
      to: values.to,
      slot: values.slot,
      tz: values.tz ?? systemTz(),
      public: values.public,
    });
    const created = await createPoll(api, body);
    saveToken(created.id, created.editToken);
    console.log("✓ poll created");
    console.log(`  → ${created.url}`);
    console.log(`  ${body.days.length} day(s), ${body.from}–${body.to}, ${body.slot}-min slots, ${body.tz}`);
    console.log(`  edit token saved to ${TOKEN_FILE}`);
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
    const best = await getBest(api, id, limit);
    if (best.results.length === 0) {
      console.log("No availability yet.");
      return;
    }
    console.log(`${best.total} response(s) — best slots:`);
    for (const r of best.results) {
      console.log(`  ${prettySlot(r.slot)}  ${r.count}/${best.total}  (${r.names.join(", ")})`);
    }
    return;
  }

  if (command === "lock" || command === "unlock") {
    const id = positionals[1];
    if (!id) throw new Error(`Usage: samkoma ${command} <id>${command === "lock" ? " <slot>" : ""}`);
    const token = getToken(id);
    if (!token) {
      throw new Error(`No edit token for "${id}" in ${TOKEN_FILE} — only the host who created the poll can ${command} it.`);
    }
    const slot = command === "lock" ? positionals[2] : null;
    if (command === "lock" && !slot) {
      throw new Error("Usage: samkoma lock <id> <slot>  (e.g. 2026-07-15T09:00)");
    }
    const poll = await lockSlot(api, id, slot ?? null, token);
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
