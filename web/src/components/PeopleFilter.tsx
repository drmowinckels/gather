import { useState } from "react";

// A disclosure of respondent chips: toggle people in or out of the tally so the
// host can ask "what works if we drop Alice and Bob?". Inclusion is tracked by
// the parent as a set of *excluded* names, so anyone who responds later is
// counted by default. Collapsed by default to keep the results view clean.
export function PeopleFilter({
  names,
  excluded,
  onToggle,
  onReset,
}: {
  names: string[];
  excluded: Set<string>;
  onToggle: (name: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const included = names.length - excluded.size;
  const filtering = excluded.size > 0;

  return (
    <div style={{ margin: "0 0 18px" }}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {filtering
          ? `Counting ${included} of ${names.length} people`
          : "Filter people"}
        <span aria-hidden="true"> {open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div
            className="chips"
            role="group"
            aria-label="People counted in the results"
          >
            {names.map((name) => {
              const on = !excluded.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  className={`chip${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() => onToggle(name)}
                >
                  {name}
                </button>
              );
            })}
          </div>
          {filtering && (
            <button
              type="button"
              className="subtle"
              style={{
                marginTop: 10,
                display: "block",
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
                fontSize: 13,
                textDecoration: "underline",
                cursor: "pointer",
              }}
              onClick={onReset}
            >
              Reset — count everyone
            </button>
          )}
        </div>
      )}
    </div>
  );
}
