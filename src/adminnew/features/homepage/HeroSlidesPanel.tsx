import { useState } from 'react';
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Badge, Banner, Button, ConfirmDialog, EmptyState, ErrorBanner, Switch, toActionError, type ActionError } from '../../ui';

export interface HeroSlideRow {
  _id: Id<'heroSlides'>;
  title?: string;
  suptitle?: string;
  imageUrl?: string;
  buttonText?: string;
  isActive: boolean;
  sortOrder: number;
}

// Sheet body for the hero section: slides in the order the store shows them.
export function HeroSlidesPanel({
  slides,
  themeId,
  onAdd,
  onEdit,
  onMove,
  onToggle,
  onDelete,
}: {
  slides: HeroSlideRow[];
  themeId: string;
  onAdd: () => void;
  onEdit: (id: Id<'heroSlides'>) => void;
  onMove: (index: number, direction: -1 | 1) => Promise<void>;
  onToggle: (slide: HeroSlideRow, isActive: boolean) => Promise<void>;
  onDelete: (id: Id<'heroSlides'>) => Promise<void>;
}) {
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, setPending] = useState<HeroSlideRow | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(toActionError(err, fallback));
    }
  };

  const confirmDelete = async () => {
    if (!pending) return;
    setBusy(true);
    await run(() => onDelete(pending._id), 'Could not delete the slide.');
    setBusy(false);
    setPending(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {slides.filter((s) => s.isActive).length} of {slides.length} shown on the store.
        </p>
        <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={onAdd}>
          Add slide
        </Button>
      </div>

      {themeId === 'vivid' && (
        <Banner tone="info">
          Vivid shows the first 3 slides that are shown, in this order. Hidden slides and any beyond the third are kept but not displayed.
        </Banner>
      )}

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {slides.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-6 w-6" />}
          title="No slides yet"
          description="Add a banner image and headline. It appears at the top of the homepage."
          action={<Button variant="secondary" size="sm" onClick={onAdd}>Add the first slide</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {slides.map((slide, index) => (
            <li
              key={slide._id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-2"
            >
              <div className="flex flex-col">
                <Button
                  variant="plain"
                  size="icon"
                  aria-label={`Move ${slide.title || 'slide'} up`}
                  disabled={index === 0}
                  onClick={() => void run(() => onMove(index, -1), 'Could not change the order.')}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="plain"
                  size="icon"
                  aria-label={`Move ${slide.title || 'slide'} down`}
                  disabled={index === slides.length - 1}
                  onClick={() => void run(() => onMove(index, 1), 'Could not change the order.')}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>

              <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                {slide.imageUrl && <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{slide.title || 'Untitled slide'}</p>
                <Badge tone={slide.isActive ? 'success' : 'neutral'}>{slide.isActive ? 'Shown' : 'Hidden'}</Badge>
              </div>

              <Switch
                aria-label={`Show ${slide.title || 'slide'}`}
                checked={slide.isActive}
                onCheckedChange={(v) => void run(() => onToggle(slide, v), 'Could not update the slide.')}
              />
              <Button variant="secondary" size="sm" onClick={() => onEdit(slide._id)}>
                Edit
              </Button>
              <Button
                variant="plain"
                size="icon"
                aria-label={`Delete ${slide.title || 'slide'}`}
                onClick={() => setPending(slide)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !busy && setPending(null)}
        title="Delete this slide?"
        description={pending ? `"${pending.title || 'Untitled slide'}" is removed from the homepage. This cannot be undone.` : undefined}
        confirmLabel="Delete slide"
        critical
        onConfirm={confirmDelete}
      />
    </div>
  );
}
