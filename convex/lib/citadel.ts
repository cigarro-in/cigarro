// Citadel super-admin SSO constants. Zero env vars by design: the values are
// the Citadel deployment (Convex site origin) and this project's registration.
//
// Citadel registration for this project (see Citadel hub, projects tab):
//   slug        cigarro
//   audience    cigarro            (JWT aud, must equal CITADEL_AUDIENCE)
//   callbackUrl https://admin.cigarro.in/sa/callback
//   convexUrl   https://proper-coyote-383.convex.cloud
//   issuer      https://calm-spaniel-415.convex.site

// Read from Convex env vars; the literals are code defaults used when unset.
//   CITADEL_JWKS_URL, CITADEL_ISSUER, CITADEL_AUDIENCE
//   CORS_ALLOWED_ORIGINS  comma-separated, default https://admin.cigarro.in
const CITADEL_ISSUER_DEFAULT = "https://calm-spaniel-415.convex.site";
export const CITADEL_ISSUER: string =
  process.env.CITADEL_ISSUER || CITADEL_ISSUER_DEFAULT;
export const CITADEL_JWKS_URL: string =
  process.env.CITADEL_JWKS_URL || `${CITADEL_ISSUER_DEFAULT}/.well-known/jwks.json`;
export const CITADEL_AUDIENCE: string = process.env.CITADEL_AUDIENCE || "cigarro";
// Citadel hub (the "Open from Citadel" target).
export const CITADEL_HUB_URL = "https://keybastion.pages.dev";

// Launch token lifetime is 60 s on the Citadel side. Verification accepts
// that window plus a small clock-skew allowance.
export const LAUNCH_MAX_TTL_S = 60;
export const CLOCK_SKEW_S = 5;
export const JWKS_CACHE_MS = 5 * 60 * 1000;

export const SA_SESSION_HARD_CAP_MS = 60 * 60 * 1000; // 1 h
export const SA_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 min
export const SA_WRITE_WINDOW_MS = 15 * 60 * 1000; // 15 min after exchange

// Browser origins allowed to call /api/sa/* (CORS). Anything else gets no
// Access-Control-Allow-Origin header.
export function isAllowedSaOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const listed = (process.env.CORS_ALLOWED_ORIGINS || "https://admin.cigarro.in")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (listed.includes(origin)) return true;
  return /^http:\/\/localhost:\d+$/.test(origin);
}
