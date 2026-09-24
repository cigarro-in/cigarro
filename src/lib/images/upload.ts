// Client-side image pipeline for R2 uploads (admin only).
// Conversion happens HERE in the browser: drawing to canvas drops EXIF/GPS
// metadata by construction, caps dimensions, and applies lightweight WebP
// compression. The edge endpoint stores bytes as-is (it can't convert).

import { getAccessToken } from '../auth/session';

const MAX_DIM = 1600;
const WEBP_QUALITY = 0.82;

async function sessionToken(): Promise<string | null> {
  // Own JWT (auth cutover complete).
  return getAccessToken();
}

/** Decode any image → (square-crop) → resize → WebP blob (metadata-free by redraw). */
export async function convertToWebp(
  input: File | Blob,
  maxDim = MAX_DIM,
  quality = WEBP_QUALITY,
  square = true,
): Promise<Blob> {
  const bitmap = await createImageBitmap(input);
  // Center-crop to square so catalog tiles are uniform.
  let sx = 0;
  let sy = 0;
  let side = 0;
  if (square) {
    side = Math.min(bitmap.width, bitmap.height);
    sx = Math.round((bitmap.width - side) / 2);
    sy = Math.round((bitmap.height - side) / 2);
  }
  const srcW = square ? side : bitmap.width;
  const srcH = square ? side : bitmap.height;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, sx, sy, srcW, srcH, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  );
  if (!blob || blob.type !== 'image/webp') throw new Error('WebP conversion failed');
  return blob;
}

/** "1768027404281-camel-yellow-pack.jpg" → "Camel Yellow Pack". */
export function humanizeAlt(filename: string): string {
  const base = filename.split('/').pop()?.replace(/\.[a-z0-9]+$/i, '') ?? '';
  const words = base
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words) return 'Product image';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface R2UploadResult {
  url: string;
  key: string;
  alt: string;
  size: number;
}

/** Convert + upload one image to R2 via the admin-gated edge endpoint. */
export async function uploadImageToR2(
  input: File | Blob,
  opts: {
    folder?: string;
    alt?: string;
    filename?: string;
    slug?: string;
    /** Internal source marker stored as metadata, never exposed in the key. */
    pipelineSource?: string;
    /** Keep source width, height and aspect ratio (still encode as WebP). */
    keepOriginalResolution?: boolean;
  } = {},
): Promise<R2UploadResult> {
  const token = await sessionToken();
  if (!token) throw new Error('Not signed in');
  const webp = await convertToWebp(input, opts.keepOriginalResolution ? Infinity : MAX_DIM, WEBP_QUALITY, !opts.keepOriginalResolution);
  const fallbackName = (input instanceof File ? input.name : '') || opts.filename || 'image';
  const form = new FormData();
  form.append('file', webp, 'image.webp');
  if (opts.folder) form.append('folder', opts.folder);
  // SEO filename: item slug → `camel-yellow-packet-a1b2c3.webp`.
  if (opts.slug || fallbackName) form.append('slug', opts.slug || fallbackName);
  if (opts.pipelineSource) form.append('pipelineSource', opts.pipelineSource);
  form.append('alt', opts.alt || humanizeAlt(opts.slug || fallbackName));
  const res = await fetch('/api/images/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) throw new Error(body.error || 'Upload failed');
  return {
    url: body.url,
    key: body.key,
    alt: opts.alt || humanizeAlt(opts.slug || fallbackName),
    size: body.size ?? webp.size,
  };
}

/** Upload a non-image asset (video/pdf/zip) untouched via raw passthrough. */
export async function uploadRawToR2(
  input: File,
  opts: { folder?: string } = {},
): Promise<{ url: string; key: string; size: number }> {
  const token = await sessionToken();
  if (!token) throw new Error('Not signed in');
  const form = new FormData();
  form.append('file', input, input.name || 'file');
  form.append('raw', 'true');
  if (opts.folder) form.append('folder', opts.folder);
  const res = await fetch('/api/images/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) throw new Error(body.error || 'Upload failed');
  return { url: body.url, key: body.key, size: body.size ?? input.size };
}

/**
 * Fetch remote image bytes through the admin-gated `/api/images/fetch`
 * proxy (SSRF-guarded, image-type + size bounded server-side). Avoids
 * browser CORS failures on hotlinked sources and keeps untrusted bytes
 * off the client until they go through the WebP pipeline below.
 */
export async function fetchRemoteBytes(url: string): Promise<Blob> {
  const token = await sessionToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/images/fetch?url=${encodeURIComponent(url)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Fetch failed (${res.status})`);
  }
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Not an image');
  return blob;
}

/**
 * Import one remote (web-search) image into R2 through the SAME browser
 * WebP pipeline as local uploads: square-crop, resize, compress, SEO
 * filename, alt. This is the only remote-import path pickers should use.
 */
export async function importRemoteImageToR2(
  url: string,
  opts: { folder?: string; slug?: string; alt?: string; keepOriginalResolution?: boolean } = {},
): Promise<R2UploadResult> {
  const bytes = await fetchRemoteBytes(url);
  return uploadImageToR2(bytes, {
    folder: opts.folder,
    slug: opts.slug || url.split('/').pop() || 'image',
    alt: opts.alt || (opts.slug ? humanizeAlt(opts.slug) : humanizeAlt(url.split('/').pop() || '')),
    filename: url.split('/').pop() || 'image.jpg',
    keepOriginalResolution: opts.keepOriginalResolution,
  });
}

export interface R2Image {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  contentType: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

/** List the R2 image library (admin-gated). Pass cursor for next page. */
export async function listR2Images(prefix = 'asset_images/', cursor?: string): Promise<{
  images: R2Image[];
  folders: { name: string; path: string }[];
  cursor?: string;
}> {
  const token = await sessionToken();
  if (!token) throw new Error('Not signed in');
  const qs = new URLSearchParams({ prefix });
  if (cursor) qs.set('cursor', cursor);
  const res = await fetch(`/api/images/upload?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Library unavailable');
  return { images: body.images || [], folders: body.folders || [], cursor: body.cursor };
}

/** Delete one R2 object by key (admin-gated). */
export async function deleteR2Image(key: string): Promise<void> {
  const token = await sessionToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/images/upload?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new Error(body.error || 'Delete failed');
}
