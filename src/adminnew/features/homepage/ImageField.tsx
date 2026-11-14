import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Button, Label } from '../../ui';
import { MediaLibraryDialog } from '../products/MediaLibraryDialog';

// One image chosen from the store's media library. Empty string = no image.
export function ImageField({
  label,
  value,
  onChange,
  uploadSlug,
  hint,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** SEO filename stem for an upload (usually the slide headline). */
  uploadSlug?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
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
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
