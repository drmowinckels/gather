import { useMemo } from "react";
import type { OverlapResult } from "@samkoma/core";
import { buildOverlapBand, overlapHourSet } from "../lib/overlap";
import { tzOffsetLabel, cityLabel } from "../lib/datetime";
import { useT } from "../i18n";

interface Props {
  zones: string[];
  workFrom: string;
  workTo: string;
  homeTz: string;
  refDate: string;
  overlap: OverlapResult;
}

function cellClass(base: string, isOverlap: boolean, isWork: boolean): string {
  return `${base}${isOverlap ? " overlap" : isWork ? " work" : ""}`;
}

// A timezone-overlap band, in the spirit of timezoneoverlap.com: columns are the
// hours of the poll's home day, and each row shows what local hour those instants
// are in a covered zone. Working hours are tinted; the columns inside the
// `overlap` window (from overlapWindow) are the meeting-worthy overlap.
export function OverlapBand({
  zones,
  workFrom,
  workTo,
  homeTz,
  refDate,
  overlap,
}: Props) {
  const t = useT();
  const band = useMemo(
    () => buildOverlapBand(zones, workFrom, workTo, homeTz, refDate),
    [zones, workFrom, workTo, homeTz, refDate],
  );
  const overlapHours = useMemo(() => overlapHourSet(overlap), [overlap]);
  const overlapCount = overlapHours.filter(Boolean).length;

  return (
    <div
      className="tzband-wrap"
      tabIndex={0}
      role="group"
      aria-label={t("create.cover.bandRegion")}
    >
      <table className="tzband">
        <caption className="sr-only">
          {overlapCount > 0
            ? t("create.cover.bandCaption", { count: overlapCount })
            : t("create.cover.bandCaptionEmpty")}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="tzband-corner">
              {cityLabel(homeTz)}
              <span className="tzband-zone-off">
                {t("create.cover.bandYou")}
              </span>
            </th>
            {band.hours.map((h) => (
              <th
                key={h}
                scope="col"
                className={cellClass(
                  "tzband-hr",
                  overlapHours[h],
                  band.homeCells[h].inWindow,
                )}
              >
                {h}
                {overlapHours[h] && (
                  <span className="sr-only">
                    {" "}
                    {t("create.cover.bandOverlapCell")}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {band.rows.map((row) => (
            <tr key={row.zone}>
              <th scope="row" className="tzband-zone">
                {cityLabel(row.zone)}
                <span className="tzband-zone-off">
                  {tzOffsetLabel(row.zone)}
                </span>
              </th>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className={cellClass(
                    "tzband-cell",
                    overlapHours[i],
                    cell.inWindow,
                  )}
                >
                  {cell.hour}
                  {overlapHours[i] && (
                    <span className="sr-only">
                      {" "}
                      {t("create.cover.bandOverlapCell")}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tzband-legend">
        <span>
          <span className="tzband-key work" />
          {t("create.cover.legendWork")}
        </span>
        <span className="sep" />
        <span>
          <span className="tzband-key overlap" />
          {t("create.cover.legendOverlap")}
        </span>
      </div>
    </div>
  );
}
