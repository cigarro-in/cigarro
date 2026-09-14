// Client-side image pipeline for R2 uploads (admin only).
// Conversion happens HERE in the browser: drawing to canvas drops EXIF/GPS
// metadata by construction, caps dimensions, and applies lightweight WebP
// compression. The edge endpoint stores bytes as-is (it can't convert).

import { supabase } from '../supabase/client';
import { getAccessToken } from '../auth/session';

const MAX_DIM = 1600;
const WEBP_QUALITY = 0.82;

async function sessionToken(): Promise<string | null> {
  // Ours first (Phase 2); Supabase fallback during the soak.
  const ours = getAccessToken();
  if (ours) return ours;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Decode any image → resize → WebP blob (metadata-free by redraw). */
export async function convertToWebp(
  input: File | Blob,
  maxDim = MAX_DIM,
  quality = WEBP_QUALITY,
): Promise<Blob> {
  const bitmap = await createImageBitmap(input);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  );
  if (!blob) throw new Error('WebP conversion failed');
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
  opts: { folder?: string; alt?: string; filename?: string; slug?: string } = {},
): Promise<R2UploadResult> {
  const token = await sessionToken();
  if (!token) throw new Error('Not signed in');
  const webp = await convertToWebp(input);
  const fallbackName = (input instanceof File ? input.name : '') || opts.filename || 'image';
  const form = new FormData();
  form.append('file', webp, 'image.webp');
  if (opts.folder) form.append('folder', opts.folder);
  // SEO filename: item slug → `camel-yellow-packet-a1b2c3.webp`.
  if (opts.slug || fallbackName) form.append('slug', opts.slug || fallbackName);
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
    alt: opts.alt || humanizeAlt(fallbackName),
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

export interface R2Image {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
  contentType: string;
  createdAt: string;
}

/** List the R2 image library (admin-gated). */
export async function listR2Images(prefix = 'asset_images/'): Promise<{
  images: R2Image[];
  folders: { name: string; path: string }[];
}> {
  const token = await sessionToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`/api/images/upload?prefix=${encodeURIComponent(prefix)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Library unavailable');
  return { images: body.images || [], folders: body.folders || [] };
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
