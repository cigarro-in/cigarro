// Canvas crop + rotate for admin uploads (browser only). The admin picks the
// frame in ImageCropDialog; this draws exactly that region at most `maxDim`
// on its long edge. The output then goes through uploadImageToR2 with
// keepOriginalResolution, so the square crop in convertToWebp never runs.

export interface PixelArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draw `source` rotated by `rotation` (0, 90, 180 or 270 degrees clockwise)
 * and cut out `area`, given in the rotated image's pixels. `area` null means
 * the whole rotated image. PNG keeps transparency (logos); JPEG sources stay JPEG.
 */
export async function cropImageBlob(
  source: Blob,
  area: PixelArea | null,
  rotation: number,
  maxDim: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const quarter = ((Math.round(rotation / 90) % 4) + 4) % 4;
    const swapped = quarter % 2 === 1;
    const rotatedW = swapped ? bitmap.height : bitmap.width;
    const rotatedH = swapped ? bitmap.width : bitmap.height;
    const crop = area ?? { x: 0, y: 0, width: rotatedW, height: rotatedH };
    const width = Math.max(1, Math.round(crop.width));
    const height = Math.max(1, Math.round(crop.height));
    const scale = Math.min(1, maxDim / Math.max(width, height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    const jpeg = source.type === 'image/jpeg';
    if (jpeg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Map the rotated image's centre onto the canvas, then shift the crop origin.
    const rad = (quarter * Math.PI) / 2;
    ctx.scale(scale, scale);
    ctx.translate(-crop.x, -crop.y);
    ctx.translate(rotatedW / 2, rotatedH / 2);
    ctx.rotate(rad);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, jpeg ? 'image/jpeg' : 'image/png', 0.95),
    );
    if (!blob) throw new Error('Crop failed');
    return blob;
  } finally {
    bitmap.close();
  }
}
