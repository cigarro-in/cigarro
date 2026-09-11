// Cache invalidation endpoint: POST https://cigarro.in/api/invalidate-cache
//
// Two modes:
//  1. Real purge (preferred): when CLOUDFLARE_API_TOKEN (Zone:Cache Purge)
//     and CLOUDFLARE_ZONE_ID env vars are set, purges the given URLs (or a
//     default set of key pages) via the Cloudflare purge_cache API.
//  2. Warm fallback: otherwise re-fetches key endpoints with cache-busting
//     headers so the next visitor triggers a fresh edge fetch.
//
// Auth: requires a Supabase session JWT for an admin user
// (Authorization: Bearer <access_token>), verified against the profiles
// table. Set PURGE_REQUIRE_ADMIN=false to disable (not recommended).

import { createClient } from '@supabase/supabase-js';

const DEFAULT_PURGE_URLS = [
  'https://cigarro.in/',
  'https://cigarro.in/products',
  'https://cigarro.in/brands',
  'https://cigarro.in/categories',
  'https://cigarro.in/blogs',
  'https://cigarro.in/sitemap.xml',
  'https://cigarro.in/api/homepage-data',
  'https://cigarro.in/api/categories',
  'https://cigarro.in/api/products',
  'https://cigarro.in/api/brands',
];

function json(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

async function requireAdmin(request, env) {
  if (env.PURGE_REQUIRE_ADMIN === 'false') return { ok: true };
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey =
    env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_KEY;
  if (!supabaseUrl || !anonKey) return { ok: false, error: 'Auth not configured' };
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { ok: false, error: 'Missing session' };
  const sb = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || !userId) return { ok: false, error: 'Invalid session' };
  const { data: profile } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.is_admin) return { ok: false, error: 'Admin only' };
  return { ok: true };
}

async function realPurge(urls, env) {
  const token = env.CLOUDFLARE_API_TOKEN;
  const zone = env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) return null;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: urls }),
    }
  );
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.success !== false, detail: data };
}

async function warmUrls(urls) {
  return await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
          cf: { cacheTtl: 0, cacheEverything: false },
        });
        return { url, success: response.ok, status: response.status };
      } catch (err) {
        return { url, success: false, error: err.message };
      }
    })
  );
}

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const gate = await requireAdmin(request, env);
  if (!gate.ok) {
    return json({ error: gate.error || 'Unauthorized' }, 401, corsHeaders);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const urls =
    Array.isArray(body.urls) && body.urls.length > 0
      ? body.urls.filter(
          (u) => typeof u === 'string' && u.startsWith('https://cigarro.in/')
        ).slice(0, 100)
      : DEFAULT_PURGE_URLS;

  // Real purge when credentials exist, warm fallback otherwise.
  const purge = await realPurge(urls, env).catch((err) => ({
    ok: false,
    detail: String(err?.message || err),
  }));
  if (purge) {
    return json(
      {
        success: purge.ok,
        mode: 'purge',
        message: purge.ok
          ? `Purged ${urls.length} URLs from edge cache.`
          : 'Cloudflare purge API failed — see detail.',
        detail: purge.detail,
        results: urls.map((url) => ({ url, success: purge.ok })),
      },
      purge.ok ? 200 : 502,
      corsHeaders
    );
  }

  const results = await warmUrls(urls);
  const successCount = results.filter((r) => r.success).length;
  return json(
    {
      success: true,
      mode: 'warm',
      message:
        `No purge credentials configured — warmed ${successCount}/${urls.length} ` +
        `endpoints instead. Add CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID for true purges.`,
      results,
    },
    200,
    corsHeaders
  );
}
