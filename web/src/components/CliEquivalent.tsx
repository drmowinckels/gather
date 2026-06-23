interface CliProps {
  title: string;
  kind: "dates" | "weekdays";
  days: string[];
  from: string;
  to: string;
  slot: number;
  tz: string;
  isPublic: boolean;
}

export function CliEquivalent({
  title,
  kind,
  days,
  from,
  to,
  slot,
  tz,
  isPublic,
}: CliProps) {
  const daysArg =
    days.length === 0
      ? "…"
      : days.length > 4
        ? `${days.slice(0, 3).join(",")},+${days.length - 3}`
        : days.join(",");

  return (
    <div className="card" style={{ overflow: "hidden", padding: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {["#e0827d", "#e3bf95", "#8a9c7e"].map((c) => (
          <span
            key={c}
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: c,
            }}
          />
        ))}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--fg-subtle)",
            marginLeft: 8,
          }}
        >
          ~/projects
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "18px 16px",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          lineHeight: 1.7,
          color: "var(--fg-muted)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <span className="prompt" style={{ color: "var(--brand)" }}>
          $
        </span>{" "}
        samkoma new{" "}
        <span style={{ color: "var(--brand-2)" }}>
          "{title || "Untitled poll"}"
        </span>{" "}
        \{"\n"}
        {"  "}--days {daysArg}
        {kind === "weekdays" ? " --weekdays" : ""} \{"\n"}
        {"  "}--from {from} --to {to} --slot {slot}m \{"\n"}
        {"  "}--tz {tz}
        {isPublic ? " --public" : ""}
      </pre>
    </div>
  );
}
