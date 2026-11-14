import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';

/** Store logo, or the store initial + name when no logo is set. */
export function VividBrandMark({ storeName, logoUrl, className = '' }: { storeName: string; logoUrl: string; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      {logoUrl ? (
        <img src={logoUrl} alt="" width={36} height={36} className="h-9 w-9 flex-shrink-0 object-contain" />
      ) : (
        <span className="w-9 h-9 flex-shrink-0 rounded-full bg-[var(--color-foreground)] text-[var(--color-surface)] grid place-items-center text-sm font-black">
          {storeName.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="font-bold text-[var(--color-foreground)] tracking-tight truncate">{storeName}</span>
    </span>
  );
}

/** Cart icon with item count. The count bumps on every change. */
export function VividCartButton({
  count,
  onClick,
  expanded,
  controls,
}: {
  count: number;
  onClick: () => void;
  expanded?: boolean;
  controls?: string;
}) {
  const label = count > 0 ? `Open cart, ${count} item${count === 1 ? '' : 's'}` : 'Open cart';
  return (
    <button
      type="button"
      onClick={onClick}
      data-cart-target
      className="vv-icon-btn"
      aria-label={label}
      aria-haspopup={controls ? 'dialog' : undefined}
      aria-expanded={expanded}
      aria-controls={controls}
    >
      <ShoppingCart className="w-5 h-5" strokeWidth={1.75} />
      {count > 0 && (
        <span
          key={count}
          className="vv-bump absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold leading-[18px] text-center"
          aria-hidden="true"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

/** Shared frame so the mobile and desktop headers keep the same surface and border. */
export function VividHeaderFrame({ className, children }: { className: string; children: ReactNode }) {
  return (
    <header className={`bg-[var(--color-surface)] border-b border-[var(--color-border)] ${className}`}>{children}</header>
  );
}

/** Brand link to the storefront home. */
export function VividHomeLink({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Link to="/" className={`min-w-0 flex ${className}`}>
      {children}
    </Link>
  );
}
