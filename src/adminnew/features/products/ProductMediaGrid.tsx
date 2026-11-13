import { useState, type DragEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import { Button } from '../../ui';
import { MediaLibraryDialog } from './MediaLibraryDialog';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

/**
 * Product media editor: the first image is the featured one (large tile).
 * Drag tiles to reorder (arrow buttons do the same on touch and keyboard),
 * drop files on the card to upload, "Add" opens the media library dialog.
 */
export function ProductMediaGrid({
  images,
  onChange,
  uploadSlug,
  extraActions,
  compact = false,
  label = 'Media',
}: {
  images: string[];
  onChange: (images: string[]) => void;
  uploadSlug?: string;
  /** Extra buttons next to "Add" (e.g. web image search). */
  extraActions?: ReactNode;
  /** Smaller tiles, no featured tile (variant images). */
  compact?: boolean;
  label?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | undefined>(undefined);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);

  const openLibrary = (files?: File[]) => {
    setDroppedFiles(files);
    setDialogOpen(true);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const onCardDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setFileOver(true);
  };
  const onCardDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setFileOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length) openLibrary(files);
  };

  return (
    <div
      onDragOver={onCardDragOver}
      onDragLeave={() => setFileOver(false)}
      onDrop={onCardDrop}
      className={cn('relative rounded-[var(--admin-radius)]', fileOver && 'ring-2 ring-[var(--admin-primary)]')}
      aria-label={label}
      role="group"
    >
      {images.length === 0 ? (
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border-strong)] px-4 text-center',
            compact ? 'py-5' : 'py-10',
          )}
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" size="sm" icon={<ImagePlus aria-hidden />} onClick={() => openLibrary()}>
              Add images
            </Button>
            {extraActions}
          </div>
          <p className="text-xs text-[var(--admin-text-muted)]">Pick from the library, upload, or drop files here.</p>
        </div>
      ) : (
        <>
          <ul className={cn('grid gap-2', compact ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4')}>
            {images.map((url, i) => {
              const featured = !compact && i === 0;
              return (
                <li
                  key={`${url}-${i}`}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', url);
                  }}
                  onDragOver={(e) => {
                    if (dragIndex === null || hasFiles(e)) return;
                    e.preventDefault();
                    if (dragIndex !== i) {
                      move(dragIndex, i);
                      setDragIndex(i);
                    }
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  onDrop={(e) => {
                    if (dragIndex !== null) e.preventDefault();
                    setDragIndex(null);
                  }}
                  className={cn(
                    'group relative aspect-square cursor-grab overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] active:cursor-grabbing',
                    featured && 'col-span-2 row-span-2',
                    dragIndex === i && 'opacity-40',
                  )}
                >
                  <img src={url} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
                  {featured && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[var(--admin-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-text-muted)]">
                      Featured
                    </span>
                  )}
                  <div className="absolute inset-x-1 top-1 flex justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    <div className="flex gap-1">
                      <TileButton label="Move earlier" disabled={i === 0} onClick={() => move(i, i - 1)}>
                        <ChevronLeft className="size-3.5" aria-hidden />
                      </TileButton>
                      <TileButton label="Move later" disabled={i === images.length - 1} onClick={() => move(i, i + 1)}>
                        <ChevronRight className="size-3.5" aria-hidden />
                      </TileButton>
                    </div>
                    <TileButton label="Remove image" onClick={() => onChange(images.filter((_, j) => j !== i))}>
                      <X className="size-3.5" aria-hidden />
                    </TileButton>
                  </div>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => openLibrary()}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border-strong)] text-xs font-medium text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]"
              >
                <ImagePlus className="size-5" aria-hidden />
                Add
              </button>
            </li>
          </ul>
          {extraActions && <div className="mt-2 flex flex-wrap gap-2">{extraActions}</div>}
        </>
      )}
      {fileOver && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-primary-soft)]/90 text-sm font-medium text-[var(--admin-primary)]">
          Drop images to upload
        </div>
      )}
      <MediaLibraryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={images}
        uploadSlug={uploadSlug}
        initialFiles={droppedFiles}
        onConfirm={(urls) => onChange([...images, ...urls])}
      />
    </div>
  );
}

function TileButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)]/95 text-[var(--admin-text)] shadow-sm hover:bg-[var(--admin-surface-hover)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}
