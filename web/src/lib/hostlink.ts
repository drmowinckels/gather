// A "host link" carries the edit token in the URL hash so the host can manage a
// poll from any device. The token lives after the "#", so it is never sent to a
// server in the request line and is stripped from the Referer header.

export function parseHostToken(hash: string): string | null {
  const q = hash.indexOf("?");
  if (q === -1) return null;
  return new URLSearchParams(hash.slice(q + 1)).get("host");
}

export function buildHostLink(href: string, token: string): string {
  const base = href.split("?")[0];
  return `${base}?host=${encodeURIComponent(token)}`;
}
