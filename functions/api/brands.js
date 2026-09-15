// Cloudflare Worker for Brands with Edge Caching
// Caching: Requires Cache Rule in Cloudflare Dashboard
// Cache Rule: URI Path starts with /api/ → Eligible for cache (24h TTL)
// URL: https://cigarro.in/api/brands
// Wave 3: reads from Convex (fullCatalog bundle). Output shape is the exact
// legacy Supabase row JSON so consumers are untouched.

async function cxQuery(baseUrl, path, args) {
  const res = await fetch(`${baseUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  const body = await res.json();
  if (body.status !== 'success') throw new Error(`Convex ${path} failed`);
  return body.value;
}

// Supabase timestamptz serializes "+00:00"; Date.toISOString gives "Z".
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString().replace('Z', '+00:00'));

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Brands API request received');

import { requiredConvexUrl } from '../lib/env.js';
    const convexUrl = requiredConvexUrl(env);
    const bundle = await cxQuery(convexUrl, 'catalog:fullCatalog', {});

    // Legacy `select('*')` row shape, name-ascending, active only.
    const data = (bundle.brands || [])
      .filter((b) => b.isActive)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((b) => ({
        id: b.supabaseId,
        name: b.name,
        slug: b.slug,
        description: b.description ?? null,
        logo_url: b.logoUrl ?? null,
        website_url: b.websiteUrl ?? null,
        is_active: b.isActive,
        sort_order: b.sortOrder ?? null,
        meta_title: b.metaTitle ?? null,
        meta_description: b.metaDescription ?? null,
        created_at: iso(b.createdAt),
        updated_at: iso(b.updatedAt),
        heritage: b.heritage ?? null,
        country_of_origin: b.countryOfOrigin ?? null,
      }));

    console.log(`✅ Fetched ${data?.length || 0} brands`);

    // Return response - Cloudflare CDN will cache automatically
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'CDN-Cache-Control': 'max-age=86400',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Brands API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch brands', details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}
