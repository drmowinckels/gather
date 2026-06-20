import { Hono } from "hono";
import { cors } from "hono/cors";
import { polls } from "./polls";
import { deleteExpired } from "./cleanup";
import { todayUTC } from "./dates";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = String(c.env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      return allowed.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

app.get("/", (c) => c.json({ name: "gather", version: "v1" }));
app.route("/v1/polls", polls);

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default {
  fetch: app.fetch,
  // Daily cron: purge polls that expired (last day + grace period).
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext) {
    const removed = await deleteExpired(env.DB, todayUTC());
    console.log(`gather cron: removed ${removed} expired poll(s)`);
  },
} satisfies ExportedHandler<Env>;
