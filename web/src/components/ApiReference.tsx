// Renders an OpenAPI 3 document as an on-brand, readable reference. It's
// deliberately small: our spec has no $refs (schemas are inlined) and shallow
// request bodies, so a recursive renderer would be over-engineering.

import { useT } from "../i18n";

export interface JsonSchema {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  default?: unknown;
  description?: string;
}

export interface Param {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
}

export interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: Param[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: JsonSchema }>;
  };
  responses?: Record<string, { description?: string }>;
  security?: Array<Record<string, unknown>>;
}

export interface OpenApiDoc {
  info?: { title?: string; version?: string; description?: string };
  servers?: { url: string }[];
  paths?: Record<string, Record<string, Operation>>;
  tags?: { name: string }[];
}

const METHOD_ORDER = ["get", "post", "patch", "put", "delete"];

interface Row {
  method: string;
  path: string;
  op: Operation;
}

export function collectOperations(doc: OpenApiDoc): Row[] {
  const rows: Row[] = [];
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    const present = Object.keys(methods).sort(
      (a, b) => METHOD_ORDER.indexOf(a) - METHOD_ORDER.indexOf(b),
    );
    for (const method of present)
      rows.push({ method, path, op: methods[method] });
  }
  return rows;
}

// A compact, human label for a schema's type: "string", "string[]",
// "string<date-time>", or the allowed values for an enum.
export function typeLabel(schema?: JsonSchema): string {
  if (!schema) return "any";
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (schema.type === "array") return `${typeLabel(schema.items)}[]`;
  const t = Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type;
  if (t === "string" && schema.format) return `string<${schema.format}>`;
  return t ?? "object";
}

// "open" (no auth), "token optional" (anonymous or host), or "host token".
export function authLabel(security?: Array<Record<string, unknown>>): string {
  if (!security || security.length === 0) return "open";
  const anon = security.some((s) => Object.keys(s).length === 0);
  const token = security.some((s) => "editToken" in s);
  if (token && anon) return "token optional";
  if (token) return "host token";
  return "open";
}

function statusKind(code: string): string {
  if (code.startsWith("2")) return "ok";
  if (code.startsWith("4") || code.startsWith("5")) return "err";
  return "";
}

function PropertyList({ schema }: { schema: JsonSchema }) {
  const t = useT();
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const names = Object.keys(props);
  if (names.length === 0) return null;
  return (
    <dl className="props">
      {names.map((name) => {
        const p = props[name];
        return (
          <div className="prop" key={name}>
            <dt>
              <code>{name}</code>
              <span className="prop-type">{typeLabel(p)}</span>
              {!required.has(name) && (
                <span className="prop-opt">{t("apiRef.optional")}</span>
              )}
            </dt>
            <dd>
              {p.description}
              {p.default !== undefined && (
                <span className="prop-default">
                  {" "}
                  {t("apiRef.defaultsTo")}{" "}
                  <code>{JSON.stringify(p.default)}</code>
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function OperationItem({ method, path, op }: Row) {
  const t = useT();
  const body = op.requestBody?.content?.["application/json"]?.schema;
  const params = op.parameters ?? [];
  const responses = Object.entries(op.responses ?? {});
  return (
    <details className="op">
      <summary className="op-summary">
        <span className={`method ${method}`}>{method.toUpperCase()}</span>
        <code className="op-path">{path}</code>
        <span className="op-summary-text">{op.summary}</span>
        <span className="auth-tag">{authLabel(op.security)}</span>
      </summary>
      <div className="op-detail">
        {op.description && <p className="op-desc">{op.description}</p>}

        {params.length > 0 && (
          <div className="detail-block">
            <p className="detail-label">{t("apiRef.parameters")}</p>
            <dl className="props">
              {params.map((p) => (
                <div className="prop" key={`${p.in}:${p.name}`}>
                  <dt>
                    <code>{p.name}</code>
                    <span className="prop-type">{typeLabel(p.schema)}</span>
                    <span className="prop-in">
                      {t("apiRef.in", { location: p.in })}
                    </span>
                    {!p.required && (
                      <span className="prop-opt">{t("apiRef.optional")}</span>
                    )}
                  </dt>
                  <dd>{p.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {body && (
          <div className="detail-block">
            <p className="detail-label">{t("apiRef.requestBody")}</p>
            <PropertyList schema={body} />
          </div>
        )}

        {responses.length > 0 && (
          <div className="detail-block">
            <p className="detail-label">{t("apiRef.responses")}</p>
            <ul className="resp">
              {responses.map(([code, r]) => (
                <li key={code}>
                  <span className={`resp-code ${statusKind(code)}`}>
                    {code}
                  </span>
                  <span>{r.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

export function ApiReference({ spec }: { spec: OpenApiDoc }) {
  const rows = collectOperations(spec);
  const tagOrder = (spec.tags ?? []).map((t) => t.name);
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const tag = row.op.tags?.[0] ?? "other";
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag)!.push(row);
  }
  const orderedTags = [
    ...tagOrder.filter((t) => groups.has(t)),
    ...[...groups.keys()].filter((t) => !tagOrder.includes(t)),
  ];

  return (
    <div className="api-doc">
      {orderedTags.map((tag) => (
        <div className="tag-group" key={tag}>
          <h3 className="tag-title">{tag}</h3>
          {groups.get(tag)!.map((row) => (
            <OperationItem key={`${row.method} ${row.path}`} {...row} />
          ))}
        </div>
      ))}
    </div>
  );
}
