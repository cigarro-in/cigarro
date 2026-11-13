import type { ReactNode } from 'react';
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Sheet as SheetRoot, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Button, useButtonFeedback } from './Button';
import { ErrorBanner } from './Banner';

/**
 * Modal dialog with title, body and a footer of buttons. Styling comes from
 * the admin tokens (the shared shadcn dialog underneath).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Screen-reader description; visible only if you pass it. */
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const width = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${width} gap-4 rounded-[var(--admin-radius)] border-[var(--admin-border)] bg-[var(--admin-surface)] p-5`}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-sm text-[var(--admin-text-muted)]">{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</DialogDescription>
          )}
        </DialogHeader>
        {children}
        {footer && <DialogFooter className="gap-2 sm:gap-2">{footer}</DialogFooter>}
      </DialogContent>
    </DialogRoot>
  );
}

/**
 * Confirmation for destructive or irreversible actions. `onConfirm` may be
 * async: the confirm button shows loading, closes on success, and shows the
 * error inline (with Convex code) on failure. No toasts.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  critical,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  critical?: boolean;
  onConfirm: () => unknown | Promise<unknown>;
  children?: ReactNode;
}) {
  const fb = useButtonFeedback();
  const confirm = async () => {
    let ok = false;
    await fb.run(async () => {
      await onConfirm();
      ok = true;
    });
    if (ok) onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) fb.reset();
        onOpenChange(o);
      }}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={fb.busy}>
            {cancelLabel}
          </Button>
          <Button variant={critical ? 'critical' : 'primary'} loading={fb.busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      <ErrorBanner error={fb.error} />
    </Dialog>
  );
}

/** Side panel (right on desktop, bottom on phones by default). */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  side = 'right',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children?: ReactNode;
  side?: 'right' | 'left' | 'bottom';
}) {
  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="gap-0 border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 sm:max-w-md">
        <SheetHeader className="border-b border-[var(--admin-border)] px-4 py-3">
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          <SheetDescription className="sr-only">{typeof title === 'string' ? title : 'Panel'}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </SheetContent>
    </SheetRoot>
  );
}
