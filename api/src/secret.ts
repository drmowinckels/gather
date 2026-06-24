// Per-response secret hashing. A response is "claimed" by a secret (the user's
// chosen password, or an auto-minted high-entropy token); we store only a
// PBKDF2-SHA256 hash and verify in constant time. Runs on the Worker via Web
// Crypto (crypto.subtle), available without any dependency.

import { editToken, toHex } from "./id";

const ITERATIONS = 100_000;
const KEY_BITS = 256;
const enc = new TextEncoder();

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derive(
  secret: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

// A high-entropy token (192 bits) that claims a name for same-browser editing —
// same shape as a poll's edit token.
export const mintResponseToken = editToken;

// "pbkdf2$<iterations>$<saltHex>$<hashHex>" — self-describing so the iteration
// count can be raised later without breaking existing hashes.
export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(secret, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

const HEX_PAIRS = /^(?:[0-9a-f]{2})+$/i;

export async function verifySecret(
  secret: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  // Reject a malformed envelope before deriving rather than feeding garbage to
  // fromHex (which would otherwise silently drop bytes).
  if (!HEX_PAIRS.test(parts[2]) || !HEX_PAIRS.test(parts[3])) return false;
  const actual = await derive(secret, fromHex(parts[2]), iterations);
  return timingSafeEqual(actual, fromHex(parts[3]));
}
