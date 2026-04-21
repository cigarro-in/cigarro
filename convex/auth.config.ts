// Supabase → Convex JWT bridge.
//
// Fill VITE_SUPABASE_URL (same value your React app uses).
// Supabase must be on asymmetric JWT signing (RS256) — enable under
// Project Settings → Auth → JWT Signing Keys. Legacy HS256 projects need
// to migrate before Convex can verify their tokens.
//
// The Supabase JWT has:
//   iss = "<project-url>/auth/v1"
//   aud = "authenticated"
//   sub = auth.users.id  (what we use as userId everywhere)

const supabaseUrl = process.env.SUPABASE_URL ?? "";

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "authenticated",
      issuer: `${supabaseUrl}/auth/v1`,
      jwks: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
};
