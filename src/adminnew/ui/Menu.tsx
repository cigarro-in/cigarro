import type { ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { cn } from '../../components/ui/utils';

export interface MenuItem {
  label: ReactNode;
  onSelect?: () => void;
  /** Renders the item as a link (router-relative paths are fine with react-router hrefs). */
  href?: string;
  external?: boolean;
  icon?: ReactNode;
  tone?: 'default' | 'critical';
  disabled?: boolean;
  /** Small text on the right (shortcut, count, "Current"). */
  suffix?: ReactNode;
}

export interface MenuSection {
  title?: ReactNode;
  items: MenuItem[];
}

/**
 * Dropdown menu. `trigger` must be a single focusable element (usually a Button).
 * Pass `items` for one flat list or `sections` for grouped lists with separators.
 * `header` renders arbitrary content at the top (e.g. account details).
 */
export function Menu({
  trigger,
  items,
  sections,
  header,
  footer,
  align = 'end',
  side = 'bottom',
  width = 'w-56',
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  items?: MenuItem[];
  sections?: MenuSection[];
  header?: ReactNode;
  footer?: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  width?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const groups: MenuSection[] = sections ?? (items ? [{ items }] : []);
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className={cn(width, 'p-1')}>
        {header}
        {groups.map((group, gi) => (
          <div key={gi}>
            {(gi > 0 || header) && <DropdownMenuSeparator />}
            {group.title && <DropdownMenuLabel className="text-xs font-medium text-[var(--admin-text-muted)]">{group.title}</DropdownMenuLabel>}
            <DropdownMenuGroup>
              {group.items.map((item, ii) => {
                const content = (
                  <>
                    {item.icon}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.suffix && <span className="ml-auto text-xs text-[var(--admin-text-subtle)]">{item.suffix}</span>}
                  </>
                );
                const cls = cn(
                  'cursor-pointer gap-2 rounded-[var(--admin-radius-sm)] text-sm',
                  item.tone === 'critical' && 'text-[var(--admin-critical)] focus:text-[var(--admin-critical)] [&_svg]:text-[var(--admin-critical)]',
                );
                if (item.href) {
                  return (
                    <DropdownMenuItem key={ii} asChild disabled={item.disabled} className={cls}>
                      <a
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noopener noreferrer' : undefined}
                        onClick={item.onSelect}
                      >
                        {content}
                      </a>
                    </DropdownMenuItem>
                  );
                }
                return (
                  <DropdownMenuItem key={ii} disabled={item.disabled} onSelect={() => item.onSelect?.()} className={cls}>
                    {content}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </div>
        ))}
        {footer}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
