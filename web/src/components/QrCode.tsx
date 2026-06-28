import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { useT } from "../i18n";

const QUIET = 4; // modules of light margin so scanners lock on

// Build the QR matrix once and derive both an SVG path (for rendering) and a
// standalone SVG document (for download). The encoded value lives only in the
// matrix geometry, never as text in the markup.
function build(value: string): { path: string; dim: number; doc: string } {
  const qr = qrcode(0, "M"); // type 0 = auto-size, error correction level M
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const dim = count + QUIET * 2;
  let path = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) path += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    }
  }
  const doc =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" ` +
    `width="${dim * 12}" height="${dim * 12}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#000000"/></svg>`;
  return { path, dim, doc };
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function QrCode({ value, label }: { value: string; label: string }) {
  const t = useT();
  // Auto-sizing throws if the value exceeds even a type-40 QR; degrade instead
  // of crashing the page (unreachable for poll links, but defensive).
  const built = useMemo(() => {
    try {
      return build(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!built) {
    return (
      <p className="subtle" style={{ fontSize: 13, marginTop: 12 }}>
        {t("qr.tooLong")}
      </p>
    );
  }
  const { path, dim, doc } = built;

  function downloadSvg() {
    downloadBlob(new Blob([doc], { type: "image/svg+xml" }), "samkoma-qr.svg");
  }

  function downloadPng() {
    const px = 512;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, px, px);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, "samkoma-qr.png");
      });
    };
    img.src = `data:image/svg+xml;base64,${btoa(doc)}`;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: 14,
      }}
    >
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${dim} ${dim}`}
        shapeRendering="crispEdges"
        style={{
          width: 168,
          height: 168,
          background: "#ffffff",
          borderRadius: 8,
          padding: 4,
        }}
      >
        <path d={path} fill="#000000" />
      </svg>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={downloadSvg}
        >
          {t("qr.downloadSvg")}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={downloadPng}
        >
          {t("qr.downloadPng")}
        </button>
      </div>
    </div>
  );
}
