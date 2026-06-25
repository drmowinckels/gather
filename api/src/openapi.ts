// OpenAPI 3 document for the public API. Request-body schemas are derived from
// the same zod validators the routes use (via zod-to-json-schema), so they can't
// drift from what the server actually accepts. Path coverage is guarded by a
// test that diffs DOCUMENTED_PATHS against the app's registered routes.
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  createPollSchema,
  submitSlotsSchema,
  lockSchema,
  patchPollSchema,
} from "./schema";
import type { z } from "zod";

type Json = Record<string, unknown>;

function body(s: z.ZodTypeAny): Json {
  return {
    required: true,
    content: {
      "application/json": {
        schema: zodToJsonSchema(s, {
          target: "openApi3",
          $refStrategy: "none",
        }) as Json,
      },
    },
  };
}

const ID_PARAM = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "The poll's short id.",
};

const ERROR = {
  type: "object",
  properties: { error: { type: "string" } },
} as const;

function ok(description: string): Json {
  return {
    description,
    content: { "application/json": { schema: { type: "object" } } },
  };
}

function err(description: string): Json {
  return { description, content: { "application/json": { schema: ERROR } } };
}

// Every poll-scoped route can 404 (unknown) or 410 (expired); spread onto each.
const NOT_FOUND_OR_EXPIRED = {
  "404": err("not_found"),
  "410": err("expired"),
};
// Results-visibility routes work anonymously or with the host token; host-only
// routes require it.
const OPTIONAL_AUTH = [{}, { editToken: [] }];
const HOST_ONLY = [{ editToken: [] }];

// Every public path the document covers; the drift test asserts this matches the
// app's registered v1 routes exactly.
export const DOCUMENTED_PATHS = [
  "/v1/polls",
  "/v1/polls/{id}",
  "/v1/polls/{id}/slots",
  "/v1/polls/{id}/best",
  "/v1/polls/{id}/lock",
  "/v1/polls/{id}/ics",
  "/v1/metrics",
];

export function openApiDocument(serverUrl: string): Json {
  return {
    openapi: "3.0.3",
    info: {
      title: "samkoma API",
      version: "v1",
      description:
        "Group-availability scheduling. No accounts: creating a poll returns an " +
        "edit token used as a Bearer credential for host-only actions (PATCH, " +
        "lock) and to read a private or hidden poll's results. A poll is one of " +
        "two kinds: `dates` (specific calendar dates, slot keys " +
        "`YYYY-MM-DDThh:mm`) or `weekdays` (recurring, slot keys `monThh:mm`).",
    },
    servers: [{ url: serverUrl }],
    tags: [{ name: "polls" }, { name: "metrics" }],
    components: {
      securitySchemes: {
        editToken: {
          type: "http",
          scheme: "bearer",
          description:
            "A poll's edit token (returned by POST /v1/polls), sent as " +
            "`Authorization: Bearer <token>`.",
        },
      },
    },
    paths: {
      "/v1/polls": {
        post: {
          tags: ["polls"],
          summary: "Create a poll",
          requestBody: body(createPollSchema),
          responses: {
            "201": ok("Created — returns { id, url, editToken }."),
            "400": err("invalid_body"),
            "429": err("rate_limited"),
          },
        },
      },
      "/v1/polls/{id}": {
        get: {
          tags: ["polls"],
          summary: "Fetch a poll and its aggregated responses",
          parameters: [ID_PARAM],
          security: OPTIONAL_AUTH,
          responses: {
            "200": ok(
              "The poll. Responses are included only when visible to the caller " +
                "(public and not hidden, or the host).",
            ),
            ...NOT_FOUND_OR_EXPIRED,
          },
        },
        patch: {
          tags: ["polls"],
          summary: "Edit a poll (host only)",
          parameters: [ID_PARAM],
          security: HOST_ONLY,
          requestBody: body(patchPollSchema),
          responses: {
            "200": ok("Updated poll."),
            "400": err("invalid_body / not_additive / from_after_to"),
            "403": err("forbidden"),
            ...NOT_FOUND_OR_EXPIRED,
          },
        },
      },
      "/v1/polls/{id}/slots": {
        post: {
          tags: ["polls"],
          summary: "Submit or update your availability",
          parameters: [ID_PARAM],
          requestBody: body(submitSlotsSchema),
          responses: {
            "200": ok(
              "Saved response. On a first, unprotected write the body includes a " +
                "one-time `responseToken` that claims the name for later edits.",
            ),
            "400": err("invalid_slots"),
            "403": err("name_protected"),
            "409": err("closed"),
            "429": err("rate_limited / poll_full"),
            ...NOT_FOUND_OR_EXPIRED,
          },
        },
      },
      "/v1/polls/{id}/best": {
        get: {
          tags: ["polls"],
          summary: "Ranked best slots",
          parameters: [
            ID_PARAM,
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 1000 },
            },
          ],
          security: OPTIONAL_AUTH,
          responses: {
            "200": ok("{ total, results: [{ slot, count, names }] }."),
            "403": err("forbidden"),
            ...NOT_FOUND_OR_EXPIRED,
          },
        },
      },
      "/v1/polls/{id}/lock": {
        post: {
          tags: ["polls"],
          summary: "Lock in (or clear) the chosen slot (host only)",
          parameters: [ID_PARAM],
          security: HOST_ONLY,
          requestBody: body(lockSchema),
          responses: {
            "200": ok("Updated poll."),
            "400": err("invalid_slots"),
            "403": err("forbidden"),
            ...NOT_FOUND_OR_EXPIRED,
          },
        },
      },
      "/v1/polls/{id}/ics": {
        get: {
          tags: ["polls"],
          summary: "Calendar export (.ics) of the locked slot",
          parameters: [ID_PARAM],
          responses: {
            "200": {
              description: "An iCalendar document for the locked slot.",
              content: { "text/calendar": { schema: { type: "string" } } },
            },
            "409": err("not_locked"),
            ...NOT_FOUND_OR_EXPIRED,
          },
        },
      },
      "/v1/metrics": {
        get: {
          tags: ["metrics"],
          summary: "Usage counters (lifetime totals + recent daily series)",
          description:
            "Aggregate-only counts of polls created and responses submitted. " +
            "These outlive the polls themselves (which are deleted at expiry), " +
            "so they record activity over time. No per-poll detail is exposed.",
          parameters: [
            {
              name: "days",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 365,
                default: 90,
              },
              description:
                "Length in days of the returned daily series. Lifetime totals " +
                "are unaffected.",
            },
          ],
          responses: {
            "200": ok(
              "{ totals: { pollsCreated, responsesSubmitted }, daily: " +
                "[{ day, pollsCreated, responsesSubmitted }] }.",
            ),
          },
        },
      },
    },
  };
}

// Minimal interactive docs via Scalar, loading the spec from `specUrl`.
export function docsHtml(specUrl: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>samkoma API reference</title>
  </head>
  <body>
    <script id="api-reference" data-url="${specUrl}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1"></script>
  </body>
</html>`;
}
