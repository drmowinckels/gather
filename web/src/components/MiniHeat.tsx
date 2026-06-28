import { useT } from "../i18n";

const DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
const ROWS = 9;
const TOTAL = 9;

function count(d: number, t: number): number {
  const peakD = 2;
  const peakT = 4;
  let c = TOTAL - Math.abs(d - peakD) * 1.6 - Math.abs(t - peakT) * 0.9;
  c += ((d * 7 + t * 5) % 3) - 1;
  return Math.max(0, Math.min(TOTAL, Math.round(c)));
}

export function MiniHeat() {
  const t = useT();
  return (
    <div
      className="card"
      style={{ padding: 24 }}
      role="img"
      aria-label={t("miniheat.ariaLabel")}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {t("miniheat.title")}
        </span>
        <span style={{ fontSize: 12, color: "var(--fg-subtle)" }}>
          {t("miniheat.respondents", { count: TOTAL })}
        </span>
      </div>

      <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
        <div style={{ width: 32 }} />
        {DAYS.map((d) => (
          <div
            key={d}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".04em",
              color: "var(--fg-subtle)",
            }}
          >
            {t(`miniheat.${d}`)}
          </div>
        ))}
      </div>

      {Array.from({ length: ROWS }, (_, r) => (
        <div
          key={r}
          style={{
            display: "flex",
            gap: 5,
            marginTop: 5,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 32,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--fg-subtle)",
              textAlign: "right",
            }}
          >
            {r % 2 === 0 ? `${9 + r}` : ""}
          </div>
          {DAYS.map((_, d) => {
            const c = count(d, r);
            const pct = Math.round((c / TOTAL) * 100);
            return (
              <div
                key={d}
                style={{
                  flex: 1,
                  height: 14,
                  borderRadius: 4,
                  background: `color-mix(in oklab, var(--brand) ${pct}%, transparent)`,
                  boxShadow:
                    c === 0 ? "inset 0 0 0 1px var(--border-subtle)" : "none",
                }}
              />
            );
          })}
        </div>
      ))}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 16,
          fontSize: 11,
          color: "var(--fg-subtle)",
        }}
      >
        <span>{t("miniheat.fewer")}</span>
        <div style={{ display: "flex", gap: 3 }}>
          {[12, 38, 64, 100].map((p) => (
            <div
              key={p}
              style={{
                width: 16,
                height: 10,
                borderRadius: 2,
                background: `color-mix(in oklab, var(--brand) ${p}%, transparent)`,
              }}
            />
          ))}
        </div>
        <span>{t("miniheat.everyone")}</span>
      </div>
    </div>
  );
}
