import type { ButtonState } from '../../ui';
import { Button } from '../../ui';

/**
 * Sticky save bar for one settings section. Shows while there are unsaved
 * edits, and stays visible for a moment after a save so the button can
 * confirm the result.
 */
export function SaveBar({
  dirty,
  state,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  state: ButtonState;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!dirty && state === 'idle') return null;
  return (
    <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm backdrop-blur-md">
      <span className="text-sm text-muted-foreground">{dirty ? 'Unsaved changes' : ' '}</span>
      <div className="flex items-center gap-2">
        {dirty && (
          <Button variant="plain" size="sm" onClick={onDiscard} disabled={state === 'loading'}>
            Discard
          </Button>
        )}
        <Button variant="primary" size="sm" state={state} onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
