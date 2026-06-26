// Trigger a client-side file download from in-memory text — no round trip to a
// server. Used for the CSV export, which is built in the browser from responses
// the API already returned (so it works even for a host on a private poll).
export function downloadText(
  filename: string,
  text: string,
  mime = "text/plain",
): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
