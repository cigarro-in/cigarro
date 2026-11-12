import {
  CITADEL_AUDIENCE,
  CITADEL_ISSUER,
  CITADEL_JWKS_URL,
  CLOCK_SKEW_S,
  JWKS_CACHE_MS,
  LAUNCH_MAX_TTL_S,
} from "./citadel";

// Verifier for Citadel launch JWTs (EdDSA / Ed25519, 60 s lifetime).
// Implemented on WebCrypto so no JOSE dependency is needed. Convex's default
// runtime provides crypto.subtle with Ed25519.

export type Jwk = {
  kty: string;
  crv?: string;
  x?: string;
  kid?: string;
  alg?: string;
  use?: string;
};

export type LaunchClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  jti: string;
  iat?: number;
  exp: number;
  scope: "superadmin";
  write: boolean;
  citadelSid: string;
};

export class LaunchTokenError extends Error {}

const enc = new TextEncoder();

export function b64urlToBytes(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new LaunchTokenError("bad base64url");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeJsonPart(part: string): Record<string, unknown> {
  const parsed = JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new LaunchTokenError("bad json segment");
  }
  return parsed as Record<string, unknown>;
}

// Pure verification against a given key set. `nowS` is injectable for tests.
export async function verifyLaunchTokenWithKeys(
  token: string,
  keys: Jwk[],
  nowS: number = Math.floor(Date.now() / 1000),
): Promise<LaunchClaims> {
  if (typeof token !== "string" || token.length > 4096) {
    throw new LaunchTokenError("bad token");
  }
  const parts = token.split(".");
  if (parts.length !== 3) throw new LaunchTokenError("malformed token");
  const [headerPart, payloadPart, sigPart] = parts;

  const header = decodeJsonPart(headerPart);
  if (header.alg !== "EdDSA") throw new LaunchTokenError("bad alg");
  if (typeof header.kid !== "string") throw new LaunchTokenError("no kid");

  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new LaunchTokenError("unknown kid");
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string") {
    throw new LaunchTokenError("unsupported key");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "OKP", crv: "Ed25519", x: jwk.x, key_ops: ["verify"], ext: true } as JsonWebKey,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const sig = b64urlToBytes(sigPart);
  const ok = await crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    sig as BufferSource,
    enc.encode(`${headerPart}.${payloadPart}`),
  );
  if (!ok) throw new LaunchTokenError("bad signature");

  const claims = decodeJsonPart(payloadPart) as Partial<LaunchClaims>;

  if (claims.iss !== CITADEL_ISSUER) throw new LaunchTokenError("wrong iss");
  const audOk = Array.isArray(claims.aud)
    ? claims.aud.includes(CITADEL_AUDIENCE)
    : claims.aud === CITADEL_AUDIENCE;
  if (!audOk) throw new LaunchTokenError("wrong aud");
  if (claims.scope !== "superadmin") throw new LaunchTokenError("bad scope");
  if (typeof claims.exp !== "number") throw new LaunchTokenError("no exp");
  if (claims.exp < nowS - CLOCK_SKEW_S) throw new LaunchTokenError("expired");
  if (claims.exp > nowS + LAUNCH_MAX_TTL_S + CLOCK_SKEW_S) {
    throw new LaunchTokenError("ttl too long");
  }
  if (typeof claims.iat === "number" && claims.iat > nowS + CLOCK_SKEW_S) {
    throw new LaunchTokenError("iat in future");
  }
  if (typeof claims.write !== "boolean") throw new LaunchTokenError("bad write");
  if (typeof claims.citadelSid !== "string" || !claims.citadelSid) {
    throw new LaunchTokenError("bad citadelSid");
  }
  if (typeof claims.jti !== "string" || !claims.jti) throw new LaunchTokenError("bad jti");
  if (typeof claims.sub !== "string" || !claims.sub) throw new LaunchTokenError("bad sub");
  return claims as LaunchClaims;
}

// JWKS cache, module-scoped (per isolate). A kid miss forces one refetch so a
// freshly rotated key works before the 5 min TTL runs out.
let jwksCache: { fetchedAt: number; keys: Jwk[] } | null = null;

async function fetchJwks(): Promise<Jwk[]> {
  const res = await fetch(CITADEL_JWKS_URL, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new LaunchTokenError(`jwks http ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  if (!Array.isArray(body.keys)) throw new LaunchTokenError("jwks malformed");
  return body.keys;
}

export async function verifyLaunchToken(token: string): Promise<LaunchClaims> {
  const now = Date.now();
  if (!jwksCache || now - jwksCache.fetchedAt > JWKS_CACHE_MS) {
    jwksCache = { fetchedAt: now, keys: await fetchJwks() };
  }
  const kidOf = (t: string) => {
    try {
      return decodeJsonPart(t.split(".")[0] ?? "").kid;
    } catch {
      return undefined;
    }
  };
  const kid = kidOf(token);
  if (typeof kid === "string" && !jwksCache.keys.some((k) => k.kid === kid)) {
    jwksCache = { fetchedAt: now, keys: await fetchJwks() };
  }
  return verifyLaunchTokenWithKeys(token, jwksCache.keys, Math.floor(now / 1000));
}

// Opaque session token: 32 random bytes, base64url. Only the hash is stored.
export function newSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToB64url(bytes);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
