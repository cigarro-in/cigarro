import type { ReactNode } from 'react';
import { Dialog } from '../../ui';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS: { label: string; keys: ReactNode }[] = [
  {
    label: 'Search the admin',
    keys: (
      <>
        <Kbd>{MOD}</Kbd>
        <Kbd>K</Kbd>
      </>
    ),
  },
  { label: 'Move through results', keys: (<><Kbd>↑</Kbd><Kbd>↓</Kbd></>) },
  { label: 'Open the selected result', keys: <Kbd>Enter</Kbd> },
  { label: 'Close search or a dialog', keys: <Kbd>Esc</Kbd> },
];

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-[5px] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-1.5 font-sans text-xs font-medium text-[var(--admin-text)] shadow-[inset_0_-1px_0_var(--admin-border)]">
      {children}
    </kbd>
  );
}

/** Small reference list of the keys the admin responds to. */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts" size="sm">
      <ul className="divide-y divide-[var(--admin-border)] text-sm">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex min-h-10 items-center justify-between gap-3 py-2">
            <span>{s.label}</span>
            <span className="flex shrink-0 items-center gap-1">{s.keys}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
