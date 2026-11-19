import type { CropPreset, CropRatio } from '../../../ui/useImageCrop';

/** A slot with a known pixel size (hero banners, homepage images). */
export interface ImageSlotSize {
  width: number;
  height: number;
}

/**
 * Shape an image slot expects.
 * - square: catalog tiles (products, categories). Cropped square.
 * - free: keeps the image's own shape. No cropper.
 * - wide: link-preview share image, 1200 × 630.
 * - icon: site icon, square and small.
 * - { width, height }: a slot with a known size (hero banners).
 */
export type ImageAspect = 'square' | 'free' | 'wide' | 'icon' | ImageSlotSize;

export interface AspectConfig {
  /** Open the cropper before upload. */
  crop: boolean;
  cropPresets: CropPreset[];
  defaultRatio: CropRatio;
  /** Long-edge cap for the stored WebP. */
  maxDim: number;
  /** Centre square crop in the WebP step (square slots). */
  square: boolean;
  /** CSS aspect-ratio for previews of this slot. */
  previewRatio: string;
  /** Plain-language hint, e.g. "Square, at least 800 px". */
  hint: string;
}

export const SHARE_IMAGE_SIZE: ImageSlotSize = { width: 1200, height: 630 };

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function ratioText(size: ImageSlotSize): string {
  const g = gcd(size.width, size.height);
  return `${size.width / g}:${size.height / g}`;
}

export function aspectConfig(aspect: ImageAspect): AspectConfig {
  if (typeof aspect === 'object') {
    const ratio = aspect.width / aspect.height;
    return {
      crop: true,
      cropPresets: [
        { label: `Slot ${ratioText(aspect)}`, ratio },
        { label: 'Original', ratio: 'original' },
      ],
      defaultRatio: ratio,
      maxDim: 2400,
      square: false,
      previewRatio: `${aspect.width} / ${aspect.height}`,
      hint: `${aspect.width} × ${aspect.height} px (${ratioText(aspect)})`,
    };
  }
  switch (aspect) {
    case 'square':
      return {
        crop: true,
        cropPresets: [{ label: 'Square 1:1', ratio: 1 }],
        defaultRatio: 1,
        maxDim: 1600,
        square: true,
        previewRatio: '1 / 1',
        hint: 'Square, at least 800 × 800 px',
      };
    case 'icon':
      return {
        crop: true,
        cropPresets: [{ label: 'Square 1:1', ratio: 1 }],
        defaultRatio: 1,
        maxDim: 512,
        square: true,
        previewRatio: '1 / 1',
        hint: 'Square, at least 192 × 192 px',
      };
    case 'wide': {
      const ratio = SHARE_IMAGE_SIZE.width / SHARE_IMAGE_SIZE.height;
      return {
        crop: true,
        cropPresets: [
          { label: '1200 × 630', ratio },
          { label: 'Original', ratio: 'original' },
        ],
        defaultRatio: ratio,
        maxDim: 1600,
        square: false,
        previewRatio: '1200 / 630',
        hint: '1200 × 630 px',
      };
    }
    default:
      return {
        crop: false,
        cropPresets: [{ label: 'Original', ratio: 'original' }],
        defaultRatio: 'original',
        maxDim: 2400,
        square: false,
        previewRatio: '4 / 3',
        hint: 'Any shape, kept as it is',
      };
  }
}
