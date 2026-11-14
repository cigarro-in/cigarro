import { useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { RotateCw, ZoomIn } from 'lucide-react';
import { cropImageBlob, type PixelArea } from '../../lib/images/crop';
import { Banner } from './Banner';
import { Button } from './Button';
import { Dialog } from './Overlay';
import type { CropPreset, CropRatio } from './useImageCrop';

// Lazy-loaded through useImageCrop. Do not import this file from ui/index.ts.

const MAX_ZOOM = 4;

export interface ImageCropDialogProps {
  file: File;
  position: { index: number; total: number };
  presets: CropPreset[];
  ratio: CropRatio;
  onRatioChange: (ratio: CropRatio) => void;
  maxDim: number;
  title: string;
  /** `skipRest` is true when the admin picked "Skip cropping for the rest". */
  onApply: (blob: Blob, skipRest: boolean) => void;
  onCancel: () => void;
}

type Busy = 'crop' | 'full' | 'skip' | null;

/**
 * Crop frame with aspect presets, zoom, rotate and "Use full image".
 * react-easy-crop handles drag, wheel and touch pinch. Output is drawn on
 * canvas by cropImageBlob and then goes through the usual WebP pipeline.
 */
export function ImageCropDialog({
  file,
  position,
  presets,
  ratio,
  onRatioChange,
  maxDim,
  title,
  onApply,
  onCancel,
}: ImageCropDialogProps) {
  const [url, setUrl] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [media, setMedia] = useState<{ w: number; h: number } | null>(null);
  const [area, setArea] = useState<PixelArea | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  // A new file (next in the batch) starts with a fresh frame. The chosen ratio stays.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setMedia(null);
    setArea(null);
    setError(null);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // Rotating swaps width and height, so "Original" follows the turned image.
  const naturalRatio = media ? (rotation % 180 === 0 ? media.w / media.h : media.h / media.w) : 1;
  const aspect = ratio === 'original' ? naturalRatio : ratio;
  const remaining = position.total - position.index - 1;
  const working = busy !== null;

  const run = async (kind: Exclude<Busy, null>) => {
    setBusy(kind);
    setError(null);
    try {
      let blob: Blob;
      if (kind === 'full') {
        // Whole image, no rotation: hand over the file untouched.
        blob = rotation === 0 ? file : await cropImageBlob(file, null, rotation, maxDim);
      } else {
        if (!area) throw new Error('Crop not ready');
        blob = await cropImageBlob(file, area, rotation, maxDim);
      }
      onApply(blob, kind === 'skip');
    } catch {
      setError('This image could not be prepared. Try another file or a different frame.');
      setBusy(null);
    }
  };

  const footer = (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void run('full')} disabled={working}>
          Use full image
        </Button>
        {remaining > 0 && (
          <Button variant="plain" size="sm" onClick={() => void run('skip')} disabled={working || !area}>
            Skip cropping for the rest
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={working}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void run('crop')} loading={busy === 'crop'} disabled={working || !area}>
          {position.total > 1 ? 'Apply and next' : 'Apply crop'}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !working) onCancel();
      }}
      title={title}
      size="lg"
      footer={footer}
    >
      <div className="space-y-3">
        {position.total > 1 && (
          <p className="text-xs text-[var(--admin-text-muted)]">
            Image {position.index + 1} of {position.total}: <span className="font-medium text-[var(--admin-text)]">{file.name}</span>
          </p>
        )}

        <div className="relative h-[min(50vh,420px)] w-full overflow-hidden rounded-[var(--admin-radius)] bg-neutral-900">
          {url && (
            <Cropper
              image={url}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              minZoom={1}
              maxZoom={MAX_ZOOM}
              cropShape="rect"
              showGrid
              restrictPosition
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onMediaLoaded={(m) => setMedia({ w: m.naturalWidth, h: m.naturalHeight })}
              onCropComplete={(_: Area, pixels: Area) => setArea(pixels)}
            />
          )}
        </div>

        <div role="group" aria-label="Aspect ratio" className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = ratio === preset.ratio;
            return (
              <Button
                key={preset.label}
                variant={active ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={active}
                onClick={() => onRatioChange(preset.ratio)}
                disabled={working}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-xs text-[var(--admin-text-muted)]">
            <ZoomIn className="size-4 shrink-0" aria-hidden />
            <span className="shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={working}
              className="w-full accent-[var(--admin-primary)]"
            />
          </label>
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCw aria-hidden />}
            onClick={() => setRotation((r) => (r + 90) % 360)}
            disabled={working}
          >
            Rotate 90°
          </Button>
        </div>

        <p className="text-xs text-[var(--admin-text-muted)]">
          Drag to move the frame. Pinch or scroll to zoom. Only the framed area is kept.
        </p>
        {error && <Banner tone="critical">{error}</Banner>}
      </div>
    </Dialog>
  );
}
