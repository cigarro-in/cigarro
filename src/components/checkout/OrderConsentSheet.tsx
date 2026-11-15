import { useState } from 'react';
import { Ban } from 'lucide-react';
import { Button } from '../ui/button';
import { DialogContent, DialogDescription, DialogTitle, Dialog } from '../ui/dialog';
import { cn } from '../ui/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Records the declaration, then continues the order. Rejects on failure.
  onConfirm: () => Promise<void>;
}

const ROWS = [
  "You're of legal age and not buying for anyone underage.",
  "You're not near a school or college.",
];

// Shown once, before a customer's first order. Bottom sheet on phones, small
// centered dialog from sm up. Colours come from the store theme (accent token).
export function OrderConsentSheet({ open, onOpenChange, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      const code = err?.data?.code;
      setError(
        code === 'NOT_A_MEMBER'
          ? 'Your account is not set up for this store yet. Sign in again and retry.'
          : 'Could not save your confirmation. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent
        className={cn(
          'gap-0 border-0 p-0 shadow-2xl duration-150',
          'top-auto bottom-0 left-0 right-0 max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none',
          'slide-in-from-bottom-4 motion-reduce:animate-none motion-reduce:transition-none',
          'sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:right-auto sm:w-full sm:max-w-sm sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl',
          'md:max-w-sm lg:max-w-sm',
        )}
      >
        <div className="px-5 pt-6 pb-5 sm:px-6">
          <DialogTitle className="text-lg font-bold text-gray-900">Please make sure…</DialogTitle>
          <DialogDescription className="sr-only">Confirm before your first order.</DialogDescription>

          <ul className="mt-5 space-y-4">
            {ROWS.map((text) => (
              <li key={text} className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100" aria-hidden="true">
                  <Ban className="h-5 w-5 text-red-600" strokeWidth={2} />
                </span>
                <p className="text-sm leading-snug text-gray-800">{text}</p>
              </li>
            ))}
          </ul>

          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-medium text-accent underline underline-offset-2"
          >
            Read Terms and Conditions
          </a>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <Button
              onClick={handleConfirm}
              disabled={busy}
              className="h-11 w-full rounded-lg bg-accent font-semibold text-accent-foreground hover:bg-accent/90"
            >
              {busy ? 'Placing order…' : 'Yes, I confirm'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="h-11 w-full rounded-lg border-gray-300 font-semibold text-gray-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
