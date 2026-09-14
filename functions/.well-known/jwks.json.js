/**
 * JWKS endpoint for our own JWT issuer (auth Phase 2).
 * Serves the ES256 public key so Convex customJwt can verify our tokens.
 * Public, cacheable. Key material comes from env JWT_PUBLIC_JWK.
 */

export async function onRequest(context) {
  const { env } = context;
  try {
    const pub = JSON.parse(env.JWT_PUBLIC_JWK || 'null');
    if (!pub || !pub.x || !pub.y) {
      return new Response(JSON.stringify({ error: 'JWKS not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ keys: [pub] }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Bad JWKS config' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
