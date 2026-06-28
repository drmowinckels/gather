import { useEffect, useRef, useState } from "react";
import { useT, useTimeFormat, useDateFormat } from "../i18n";
import type { TKey } from "../i18n";
import type { TimeFormat, DateFormat } from "../lib/datetime";

const TIME_OPTIONS: { value: TimeFormat; label: TKey }[] = [
  { value: "auto", label: "format.auto" },
  { value: "12h", label: "format.h12" },
  { value: "24h", label: "format.h24" },
];
const DATE_OPTIONS: { value: DateFormat; label: TKey }[] = [
  { value: "auto", label: "format.auto" },
  { value: "iso", label: "format.iso" },
];

interface SegmentProps<T extends string> {
  label: string;
  options: { value: T; label: TKey }[];
  value: T;
  onChange: (value: T) => void;
}

function Segment<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentProps<T>) {
  const t = useT();
  return (
    <div className="format-row">
      <span className="format-label" id={`fmt-${label}`}>
        {label}
      </span>
      <div
        className="format-seg"
        role="radiogroup"
        aria-labelledby={`fmt-${label}`}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? "active" : undefined}
            onClick={() => onChange(o.value)}
          >
            {t(o.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FormatMenu() {
  const t = useT();
  const [timeFormat, setTimeFormat] = useTimeFormat();
  const [dateFormat, setDateFormat] = useDateFormat();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = TIME_OPTIONS.find((o) => o.value === timeFormat)!.label;

  return (
    <div className="format-menu" ref={ref}>
      <button
        type="button"
        className="lang-toggle"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("format.ariaTrigger")}
        onClick={() => setOpen((o) => !o)}
      >
        {t(current)}
      </button>
      {open && (
        <div className="format-panel">
          <Segment
            label={t("format.time")}
            options={TIME_OPTIONS}
            value={timeFormat}
            onChange={setTimeFormat}
          />
          <Segment
            label={t("format.date")}
            options={DATE_OPTIONS}
            value={dateFormat}
            onChange={setDateFormat}
          />
        </div>
      )}
    </div>
  );
}
