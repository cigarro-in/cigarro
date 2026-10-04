import { ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import type { BulkAction } from './DataTable';

interface BulkActionsMenuProps {
  selectedIds: string[];
  actions: BulkAction[];
}

/**
 * Shared "Actions (N)" dropdown for list pages. DataTable's toolbar is hidden
 * (search lives in PageHeader), so pages render this in the header instead of
 * each owning a copy of the same menu.
 */
export function BulkActionsMenu({ selectedIds, actions }: BulkActionsMenuProps) {
  if (selectedIds.length === 0 || actions.length === 0) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Actions ({selectedIds.length})
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onClick={() => action.onClick(selectedIds)}
            variant={action.variant ?? 'default'}
          >
            {action.icon && <action.icon className="mr-2 h-4 w-4" />}
            {action.label}
          </DropdownMenuItem>
        ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
