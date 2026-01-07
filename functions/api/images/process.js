/**
 * Image Processing API - Cloudflare Pages Function
 * 
 * Downloads external images, converts to WebP (if supported), compresses,
 * and uploads to Supabase Storage.
 * 
 * POST /api/images/process
 * Body: { urls: string[], folder?: string }
 * 
 * Returns: { success: true, images: [{ original: string, uploaded: string }] }
 */

export async function onRequest(context) {
    const { request, env } = context;

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: corsHeaders,
        });
    }

    try {
        const body = await request.json();
        const { urls, folder = '' } = body;

        console.log('[process] Received request with', urls?.length || 0, 'URLs');
        console.log('[process] Folder:', folder);
        console.log('[process] URLs:', JSON.stringify(urls));

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            console.log('[process] ERROR: No valid URLs provided');
            return new Response(JSON.stringify({ error: 'urls array is required' }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        // Supabase config - use service role key to bypass RLS
        const SUPABASE_URL = env.SUPABASE_URL || 'https://emecdqvsvskzzncmltna.supabase.co';
        // Service role key bypasses RLS - required for server-side uploads
        const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
        const BUCKET = 'asset_images';

        console.log('[process] Using Supabase URL:', SUPABASE_URL);
        console.log('[process] Using bucket:', BUCKET);

        const results = [];

        for (const originalUrl of urls) {
            console.log('[process] Processing URL:', originalUrl);
            try {
                // Fetch the image
                const imageResponse = await fetch(originalUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/*',
                    },
                });

                if (!imageResponse.ok) {
                    console.error(`Failed to fetch ${originalUrl}: ${imageResponse.status}`);
                    results.push({ original: originalUrl, error: 'Failed to fetch' });
                    continue;
                }

                // Get the image as a blob
                const imageBlob = await imageResponse.blob();

                // For now, we'll upload the image as-is since Cloudflare Workers
                // don't have native image processing. Consider using Cloudflare Images
                // or a library like @cloudflare/worker-sentry for WebP conversion.

                // Generate unique filename with webp extension (assuming most are already optimized)
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 8);
                const extension = getExtensionFromUrl(originalUrl) || 'jpg';
                const filename = `${timestamp}-${random}.${extension}`;
                const path = folder ? `${folder}/${filename}` : filename;

                console.log('[process] Uploading to:', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
                console.log('[process] Blob size:', imageBlob.size, 'type:', imageBlob.type);

                // Upload to Supabase Storage
                const uploadResponse = await fetch(
                    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': imageBlob.type || 'image/jpeg',
                            'x-upsert': 'true',
                        },
                        body: imageBlob,
                    }
                );

                console.log('[process] Upload response status:', uploadResponse.status, uploadResponse.statusText);

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    console.error(`[process] Upload failed for ${originalUrl}:`, uploadResponse.status, errorText);
                    results.push({
                        original: originalUrl,
                        error: `Upload failed (${uploadResponse.status}): ${errorText}`
                    });
                    continue;
                }

                // Construct public URL
                const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

                results.push({
                    original: originalUrl,
                    uploaded: publicUrl,
                    size: imageBlob.size,
                    type: imageBlob.type,
                });

            } catch (err) {
                console.error(`Error processing ${originalUrl}:`, err);
                results.push({ original: originalUrl, error: err.message });
            }
        }

        const successful = results.filter(r => r.uploaded);
        const failed = results.filter(r => r.error);

        return new Response(JSON.stringify({
            success: true,
            processed: successful.length,
            failed: failed.length,
            images: results,
        }), { headers: corsHeaders });

    } catch (error) {
        console.error('Process error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: corsHeaders,
        });
    }
}

function getExtensionFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const match = pathname.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i);
        return match ? match[1].toLowerCase() : null;
    } catch {
        return null;
    }
}
