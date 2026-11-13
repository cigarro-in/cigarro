import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../../ui';

const GUARD_KEY = '__cigarroUnsavedGuard';

/**
 * Guards a dirty form against leaving the page.
 * - Reload / tab close: the browser's own "Leave site?" prompt.
 * - In-app links (sidebar, back arrow, any <a>): intercepted and confirmed in
 *   a ConfirmDialog; confirming replays the click so the router navigates.
 * - Browser back button: while dirty, a sentinel history entry (same URL) is
 *   pushed. Back consumes it and lands on the same page, where we ask again.
 *   Stay re-pushes the sentinel; leave calls history.back() past the page.
 *   The sentinel is popped on save/clean and on unmount.
 * - Programmatic exits: wrap them in `confirmLeave(fn)`.
 * The app uses <BrowserRouter> (no data router), so useBlocker is unavailable.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [backPrompt, setBackPrompt] = useState(false);
  const bypass = useRef(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const sentinelOn = useRef(false);
  const backPromptOpen = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Back button: push a sentinel entry while dirty, pop it when clean.
  useEffect(() => {
    if (dirty) {
      if (!sentinelOn.current) {
        try {
          window.history.pushState({ ...(window.history.state ?? {}), [GUARD_KEY]: true }, '');
          sentinelOn.current = true;
        } catch {
          // History unavailable (e.g. sandboxed frame): the guard degrades to the other checks.
        }
      }
    } else if (sentinelOn.current) {
      sentinelOn.current = false;
      if (window.history.state?.[GUARD_KEY]) window.history.back();
    }
  }, [dirty]);

  // Unmount (save-and-navigate, programmatic leave): drop a sentinel that is still on top.
  useEffect(() => {
    return () => {
      if (!sentinelOn.current) return;
      sentinelOn.current = false;
      if (window.history.state?.[GUARD_KEY]) window.history.back();
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      // Only a back press consumes the sentinel; anything else leaves it alone.
      if (!sentinelOn.current) return;
      sentinelOn.current = false;
      backPromptOpen.current = true;
      setBackPrompt(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /** Resolves the back-button prompt once: leave = history.back(), stay = re-push the sentinel. */
  const resolveBackPrompt = useCallback((leave: boolean) => {
    if (!backPromptOpen.current) return;
    backPromptOpen.current = false;
    setBackPrompt(false);
    if (leave) {
      window.history.back();
    } else if (dirtyRef.current && !sentinelOn.current) {
      try {
        window.history.pushState({ ...(window.history.state ?? {}), [GUARD_KEY]: true }, '');
        sentinelOn.current = true;
      } catch {
        // see above
      }
    }
  }, []);

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
    <>
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
      <ConfirmDialog
        open={backPrompt}
        onOpenChange={(o) => {
          if (!o) resolveBackPrompt(false);
        }}
        title="Leave without saving?"
        description="Your unsaved changes will be lost."
        confirmLabel="Leave page"
        cancelLabel="Keep editing"
        critical
        onConfirm={() => resolveBackPrompt(true)}
      />
    </>
  );

  return { confirmLeave, dialog };
}
