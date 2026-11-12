import { ConvexError } from "convex/values";

// AES-256-GCM helpers for secrets at rest (the Gmail refresh token).
// Key: env GMAIL_TOKEN_KEY = base64 of 32 random bytes. Ciphertext format:
// base64( iv(12 bytes) || AES-GCM ciphertext+tag ). Default Convex runtime
// (WebCrypto), so no "use node".
//
// Generate a key once:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Losing or rotating the key makes every stored token undecryptable; the
// poller then marks the org needs_reconnect (no silent failure).

const IV_BYTES = 12;

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function importKey(): Promise<CryptoKey> {
  const raw = process.env.GMAIL_TOKEN_KEY;
  if (!raw) throw new ConvexError({ code: "GMAIL_KEY_MISSING" });
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = b64ToBytes(raw.trim());
  } catch {
    throw new ConvexError({ code: "GMAIL_KEY_INVALID" });
  }
  if (keyBytes.length !== 32) throw new ConvexError({ code: "GMAIL_KEY_INVALID" });
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const out = new Uint8Array(IV_BYTES + ct.length);
  out.set(iv, 0);
  out.set(ct, IV_BYTES);
  return bytesToB64(out);
}

export async function decryptSecret(encoded: string): Promise<string> {
  const key = await importKey();
  const data = b64ToBytes(encoded);
  if (data.length <= IV_BYTES) throw new ConvexError({ code: "GMAIL_TOKEN_CORRUPT" });
  const iv = data.slice(0, IV_BYTES);
  const ct = data.slice(IV_BYTES);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    // Wrong key or tampered ciphertext.
    throw new ConvexError({ code: "GMAIL_TOKEN_CORRUPT" });
  }
}
