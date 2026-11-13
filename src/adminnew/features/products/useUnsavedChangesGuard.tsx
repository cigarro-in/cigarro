import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../../ui';

/**
 * Guards a dirty form against leaving the page.
 * - Reload / tab close: the browser's own "Leave site?" prompt.
 * - In-app links (sidebar, back arrow, any <a>): intercepted and confirmed in
 *   a ConfirmDialog; confirming replays the click so the router navigates.
 * - Programmatic exits: wrap them in `confirmLeave(fn)`.
 * The app uses <BrowserRouter> (no data router), so useBlocker is unavailable;
 * the browser back button is not intercepted.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const bypass = useRef(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bypass.current || !dirtyRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(() => () => {
        bypass.current = true;
        a.click();
        bypass.current = false;
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const confirmLeave = useCallback((leave: () => void) => {
    if (!dirtyRef.current) leave();
    else setPending(() => leave);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(o) => !o && setPending(null)}
      title="Leave without saving?"
      description="Your unsaved changes will be lost."
      confirmLabel="Leave page"
      cancelLabel="Keep editing"
      critical
      onConfirm={() => {
        const go = pending;
        setPending(null);
        go?.();
      }}
    />
  );

  return { confirmLeave, dialog };
}
