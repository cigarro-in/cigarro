// Image sizes each theme actually renders, read from the storefront CSS:
// - Classic hero (src/pages/home/Hero.tsx): aspect-video (16:9) on phones and
//   tablets. The phone image is used below 768px. From 1024px the image sits in
//   half of the slide, so it is cropped at the sides; keep the subject centred.
// - Vivid banner (src/themes/vivid/tokens.css, .vv-banner): aspect-ratio 16/7 at
//   every width. VividHeroBanners shows the phone image at every width too, so it
//   replaces the banner image wherever it is set.
// - Classic showcase (src/pages/home/ProductShowcase.tsx): the left column is 2/5
//   of the 1280px container and at least 500px tall, roughly 5:6.

export interface ImageSpec {
  width: number;
  height: number;
}

const HERO_BANNER: Record<'classic' | 'vivid', ImageSpec> = {
  classic: { width: 1600, height: 900 },
  vivid: { width: 1600, height: 700 },
};

export const HERO_PHONE_SPEC: ImageSpec = { width: 800, height: 450 };
export const SHOWCASE_IMAGE_SPEC: ImageSpec = { width: 1000, height: 1200 };
// Classic hero product card: aspect-square inside the card (Hero.tsx).
export const HERO_PRODUCT_SPEC: ImageSpec = { width: 600, height: 600 };

export function heroBannerSpec(themeId: string): ImageSpec {
  return themeId === 'vivid' ? HERO_BANNER.vivid : HERO_BANNER.classic;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function ratioLabel(spec: ImageSpec): string {
  const g = gcd(spec.width, spec.height);
  return `${spec.width / g}:${spec.height / g}`;
}

/** e.g. "1600 × 900 px (16:9), JPG or WebP, under 500 KB". */
export function sizeText(spec: ImageSpec): string {
  return `${spec.width} × ${spec.height} px (${ratioLabel(spec)}), JPG or WebP, under 500 KB`;
}
