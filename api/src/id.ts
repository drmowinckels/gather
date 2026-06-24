const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function shortId(len = 6): string {
  // Rejection sampling: discard bytes in the partial final block so every
  // character is equiprobable (a plain `% 62` skews toward the first 8 chars).
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  while (out.length < len) {
    for (const b of crypto.getRandomValues(new Uint8Array(len - out.length))) {
      if (b < limit) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function editToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(24)));
}
