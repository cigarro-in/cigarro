import { useEffect, useId, useState, type CSSProperties, type DragEvent } from 'react';
import { Check, ImagePlus } from 'lucide-react';
import { cn } from '../../../../components/ui/utils';
import { Banner, Button } from '../../../ui';
import { aspectConfig, ratioText, type ImageAspect } from './aspect';
import { ImagePickerDialog, type PickerTab } from './ImagePickerDialog';
import { Thumb } from './tiles';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

// Natural pixel size of an image URL, or null until it has loaded.
function useNaturalSize(url: string): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setSize(null);
    if (!url) return;
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return size;
}

const PREVIEW_WIDTH: Record<'square' | 'icon' | 'wide' | 'free' | 'slot', string> = {
  square: 'w-24',
  icon: 'w-16',
  wide: 'w-48',
  free: 'w-32',
  slot: 'w-48',
};

/**
 * One image slot in a form: preview, "Choose image" / "Change" / "Remove",
 * and drop-a-file-on-it. Opens the shared ImagePickerDialog. Empty string = no image.
 * For slots with a known size, warns when the chosen image is far from it.
 */
export function ImageInput({
  label,
  value,
  onChange,
  aspect = 'free',
  slug,
  searchQuery,
  help,
  disabled,
  hideLabel,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (url: string) => void;
  aspect?: ImageAspect;
  /** SEO filename stem for uploads (the product, brand or page name). */
  slug?: string;
  /** Prefill for the web search tab. Defaults to `slug`. */
  searchQuery?: string;
  /** One plain line under the field (what this image is for). */
  help?: string;
  disabled?: boolean;
  /** Label is rendered by the caller (kept for screen readers). */
  hideLabel?: boolean;
}) {
  const id = useId();
  const cfg = aspectConfig(aspect);
  const url = value || '';
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>('library');
  const [dropped, setDropped] = useState<File[] | undefined>(undefined);
  const [over, setOver] = useState(false);
  const [justSet, setJustSet] = useState(false);
  const size = useNaturalSize(url);

  useEffect(() => {
    if (!justSet) return;
    const t = setTimeout(() => setJustSet(false), 1800);
    return () => clearTimeout(t);
  }, [justSet]);

  const openPicker = (initialTab: PickerTab = 'library', files?: File[]) => {
    if (disabled) return;
    setTab(initialTab);
    setDropped(files);
    setOpen(true);
  };

  const shape = typeof aspect === 'object' ? 'slot' : aspect;
  let warning: string | null = null;
  if (typeof aspect === 'object' && size) {
    const actual = size.w / size.h;
    const target = aspect.width / aspect.height;
    if (Math.abs(actual / target - 1) > 0.2)
      warning = `This image is ${size.w} × ${size.h} px. The space is ${ratioText(aspect)}, so the edges will be cut off.`;
    else if (size.w < aspect.width * 0.75) warning = `This image is ${size.w} px wide. Use at least ${aspect.width} px so it stays sharp.`;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className={cn('text-sm font-medium text-[var(--admin-text)]', hideLabel && 'sr-only')}>
        {label}
      </span>
      <div
        className="flex items-start gap-3"
        onDragOver={(e) => {
          if (!hasFiles(e) || disabled) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!hasFiles(e) || disabled) return;
          e.preventDefault();
          setOver(false);
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
          if (files.length) openPicker('upload', files.slice(0, 1));
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => openPicker()}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-action`}
          style={{ '--ar': cfg.previewRatio } as CSSProperties}
          className={cn(
            'relative aspect-[var(--ar)] max-h-40 shrink-0 overflow-hidden rounded-[var(--admin-radius)] border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] disabled:cursor-not-allowed disabled:opacity-50',
            PREVIEW_WIDTH[shape],
            url ? 'border-[var(--admin-border)] hover:border-[var(--admin-border-strong)]' : 'border-dashed border-[var(--admin-border-strong)] hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-hover)]',
            over && 'border-[var(--admin-primary)] bg-[var(--admin-primary-soft)] ring-2 ring-[var(--admin-primary)]',
            justSet && 'ring-2 ring-[var(--admin-success)]',
          )}
        >
          {url ? (
            <Thumb src={url} fit={shape === 'free' || shape === 'icon' ? 'contain' : 'cover'} />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 text-[var(--admin-text-muted)]">
              <ImagePlus className="size-5" aria-hidden />
              {shape !== 'icon' && <span className="text-xs font-medium">{over ? 'Drop' : 'Add'}</span>}
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span id={`${id}-action`} className="sr-only">
            {url ? 'Change image' : 'Choose image'}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => openPicker()}>
              {url ? 'Change' : 'Choose image'}
            </Button>
            {url && (
              <Button variant="plain" size="sm" disabled={disabled} onClick={() => onChange('')}>
                Remove
              </Button>
            )}
          </div>
          {justSet ? (
            <span role="status" className="flex items-center gap-1 text-xs font-medium text-[var(--admin-success)]">
              <Check className="size-3.5" aria-hidden /> Image set
            </span>
          ) : (
            <span className="text-xs text-[var(--admin-text-muted)]">
              {size && url ? `${size.w} × ${size.h} px · ` : ''}
              {cfg.hint}
            </span>
          )}
        </div>
      </div>
      {help && <p className="text-xs text-[var(--admin-text-muted)]">{help}</p>}
      {warning && <Banner tone="warning">{warning}</Banner>}
      <ImagePickerDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        aspect={aspect}
        slug={slug}
        searchQuery={searchQuery ?? slug}
        current={url || undefined}
        initialTab={tab}
        initialFiles={dropped}
        onPick={(urls) => {
          if (!urls[0]) return;
          onChange(urls[0]);
          setJustSet(true);
        }}
      />
    </div>
  );
}
