// Supabase → Convex JWT bridge.
//
// Supabase's newer JWT Signing Keys feature uses ES256 (elliptic curve).
// Older projects may still use RS256 — check /auth/v1/.well-known/jwks.json
// to confirm which algorithm your project's JWKS advertises.
//
// The Supabase JWT has:
//   iss = "<project-url>/auth/v1"
//   aud = "authenticated"
//   sub = auth.users.id  (what we use as userId everywhere)

const supabaseUrl = process.env.SUPABASE_URL ?? "";

// Auth Phase 2: dual-issuer soak. Our own ES256 JWTs (sub = same stable
// userId string, so zero data migration) are trusted alongside Supabase.
// New logins mint ours; old Supabase sessions keep working until expiry.
// After 7 clean days, remove the Supabase provider below.
const ownIssuer = "https://cigarro.in/auth";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: ownIssuer,
      jwks: "https://cigarro.in/.well-known/jwks.json",
      algorithm: "ES256",
    },
    {
      type: "customJwt",
      issuer: `${supabaseUrl}/auth/v1`,
      jwks: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      algorithm: "ES256",
    },
  ],
};
