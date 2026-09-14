// Own ES256 JWT issuer (auth cutover complete — no Supabase).
//
// The JWT has:
//   iss = "https://cigarro.in/auth"
//   aud = "cigarro-storefront"
//   sub = users.id  (stable userId used everywhere)
const ownIssuer = "https://cigarro.in/auth";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: ownIssuer,
      jwks: "https://cigarro.in/.well-known/jwks.json",
      algorithm: "ES256",
    },
  ],
};
