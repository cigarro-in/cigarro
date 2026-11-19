// Store app icons for the installed admin PWA and push notifications.
// Generated in the browser from the store's site icon (fallback: logo) on a canvas,
// then uploaded to R2 under <store>/images/ with a version
// suffix, so every set is new (create-only uploads, nothing overwritten).

import { fetchRemoteBytes, uploadPngToR2 } from './upload';

export interface AppIconUrls {
  icon192: string;
  icon512: string;
  maskable512: string;
  apple180: string;
  version: string;
}

const WHITE = '#ffffff';
// "any" icons: image centred on white, with a small margin.
const ANY_SCALE = 0.9;
// Maskable icons: the image sits inside the central ~70%, the safe zone that
// launchers can crop to a circle or squircle.
const MASKABLE_SCALE = 0.7;
const APPLE_SCALE = 0.9;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Pick the icon source: the site icon, else the logo. Empty string when neither is set. */
export function appIconSource(brand: { faviconUrl?: string | null; logoUrl?: string | null }): string {
  return (brand.faviconUrl || brand.logoUrl || '').trim();
}

function canvasPng(size: number, background: string, image: ImageBitmap, scale: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Contain the image inside the scaled box, keeping its aspect ratio, centred.
  const box = size * scale;
  const fit = Math.min(box / image.width, box / image.height);
  const w = image.width * fit;
  const h = image.height * fit;
  ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob && blob.type === 'image/png' ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
}

/** Render the four icon PNGs from one source image. */
export async function renderAppIcons(source: Blob, brandColor?: string | null) {
  const image = await createImageBitmap(source);
  try {
    const maskableBg = brandColor && HEX.test(brandColor) ? brandColor : WHITE;
    const [icon192, icon512, maskable512, apple180] = await Promise.all([
      canvasPng(192, WHITE, image, ANY_SCALE),
      canvasPng(512, WHITE, image, ANY_SCALE),
      canvasPng(512, maskableBg, image, MASKABLE_SCALE),
      canvasPng(180, WHITE, image, APPLE_SCALE),
    ]);
    return { icon192, icon512, maskable512, apple180 };
  } finally {
    image.close();
  }
}

/**
 * Generate the icon set from `sourceUrl` (the site icon or logo) and upload it.
 * Returns the URLs to store in siteSettings.appIcons.
 */
export async function generateAndUploadAppIcons(sourceUrl: string, brandColor?: string | null): Promise<AppIconUrls> {
  const source = await fetchRemoteBytes(sourceUrl);
  const icons = await renderAppIcons(source, brandColor);
  const version = Date.now().toString(36);
  const [a, b, c, d] = await Promise.all([
    uploadPngToR2(icons.icon192, { slug: `icon-192-${version}` }),
    uploadPngToR2(icons.icon512, { slug: `icon-512-${version}` }),
    uploadPngToR2(icons.maskable512, { slug: `maskable-512-${version}` }),
    uploadPngToR2(icons.apple180, { slug: `apple-180-${version}` }),
  ]);
  return { icon192: a.url, icon512: b.url, maskable512: c.url, apple180: d.url, version };
}
