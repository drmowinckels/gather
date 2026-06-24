import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { app } from "../src/index";
import { DOCUMENTED_PATHS, openApiDocument } from "../src/openapi";

const HTTP_METHODS = new Set(["get", "post", "patch", "put", "delete"]);

const ORIGIN = "http://localhost:5173";

describe("GET /openapi.json", () => {
  it("serves a valid OpenAPI 3 document covering every endpoint", async () => {
    const res = await SELF.fetch("https://api.test/openapi.json", {
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, Record<string, unknown>>;
      components: { securitySchemes: Record<string, { scheme?: string }> };
    };
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBe("samkoma API");
    for (const p of DOCUMENTED_PATHS) {
      expect(Object.keys(doc.paths[p] ?? {}).length).toBeGreaterThan(0);
    }
    // bearer auth scheme documented
    expect(doc.components.securitySchemes.editToken.scheme).toBe("bearer");
  });

  it("derives the create-poll request body from the zod schema", async () => {
    const doc = (await (
      await SELF.fetch("https://api.test/openapi.json", {
        headers: { Origin: ORIGIN },
      })
    ).json()) as Record<string, any>;
    const schema =
      doc.paths["/v1/polls"].post.requestBody.content["application/json"]
        .schema;
    // properties that exist on createPollSchema, proving it came from zod
    expect(schema.properties).toHaveProperty("title");
    expect(schema.properties).toHaveProperty("kind");
    expect(schema.properties).toHaveProperty("days");
  });
});

describe("GET /docs", () => {
  it("serves an interactive docs page pointing at the spec", async () => {
    const res = await SELF.fetch("https://api.test/docs", {
      headers: { Origin: ORIGIN },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("/openapi.json");
    expect(html).toContain("@scalar/api-reference");
  });
});

describe("spec drift guard", () => {
  it("documents exactly the registered v1 method+path operations", () => {
    const doc = openApiDocument("https://api.test") as {
      paths: Record<string, Record<string, unknown>>;
    };
    const documented = new Set<string>();
    for (const [path, ops] of Object.entries(doc.paths)) {
      for (const method of Object.keys(ops)) {
        if (HTTP_METHODS.has(method)) {
          documented.add(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    const registered = new Set(
      app.routes
        .filter((r) => r.path.startsWith("/v1/") && r.method !== "ALL")
        .map((r) => `${r.method} ${r.path.replace(/:([A-Za-z]+)/g, "{$1}")}`),
    );
    expect([...registered].sort()).toEqual([...documented].sort());
    // sanity: the path-only export still lists every documented path
    expect(
      [...new Set([...documented].map((d) => d.split(" ")[1]))].sort(),
    ).toEqual([...DOCUMENTED_PATHS].sort());
  });
});
