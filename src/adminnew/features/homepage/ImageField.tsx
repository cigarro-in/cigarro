import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Banner, Button, Label } from '../../ui';
import { MediaLibraryDialog } from '../products/MediaLibraryDialog';
import { sizeText, ratioLabel, type ImageSpec } from './imageSpecs';

// Natural pixel size of an image URL, or null until it has loaded.
function useNaturalSize(url: string): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setSize(null);
    if (!url) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive) setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return size;
}

// One image chosen from the store's media library. Empty string = no image.
// With `spec`, the field shows the recommended size and warns when the chosen
// image's shape or width is far from the slot.
export function ImageField({
  label,
  value,
  onChange,
  uploadSlug,
  spec,
  note,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** SEO filename stem for an upload (usually the slide headline). */
  uploadSlug?: string;
  spec?: ImageSpec;
  /** Extra plain-language line under the size (for example, what overrides this image). */
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const size = useNaturalSize(value);

  let warning: string | null = null;
  if (spec && size) {
    const actual = size.w / size.h;
    const target = spec.width / spec.height;
    if (Math.abs(actual / target - 1) > 0.2) {
      warning = `This image is ${size.w} × ${size.h} px. The slot is ${ratioLabel(spec)}, so parts of it will be cropped.`;
    } else if (size.w < spec.width * 0.75) {
      warning = `This image is ${size.w} px wide. Use at least ${spec.width} px so it stays sharp.`;
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon aria-hidden className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col items-start gap-1">
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {value ? 'Replace image' : 'Choose image'}
          </Button>
          {value && (
            <Button variant="plain" size="sm" onClick={() => onChange('')}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {spec && <p className="text-xs text-muted-foreground">Recommended {sizeText(spec)}.</p>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {warning && <Banner tone="warning">{warning}</Banner>}
      <MediaLibraryDialog
        open={open}
        onOpenChange={setOpen}
        multiple={false}
        title={label}
        defaultFolder="homepage"
        uploadSlug={uploadSlug}
        onConfirm={(urls) => {
          if (urls[0]) onChange(urls[0]);
          setOpen(false);
        }}
      />
    </div>
  );
}
