import { useState } from 'react';
import { Search, Plus, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { AdminCard, AdminCardContent, AdminCardHeader } from './AdminCard';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
}

interface BulkAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (selectedIds: string[]) => void;
  variant?: 'default' | 'destructive';
}

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  onAdd?: () => void;
  addButtonLabel?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (ids: string[]) => void;
  bulkActions?: BulkAction[];
  onRowClick?: (item: T) => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  hideToolbar?: boolean;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onAdd,
  addButtonLabel = 'Add New',
  searchPlaceholder = 'Search...',
  loading = false,
  selectedItems = [],
  onSelectionChange,
  bulkActions = [],
  onRowClick,
  searchTerm,
  onSearchChange,
  hideToolbar = false,
}: DataTableProps<T>) {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  
  const activeSearchQuery = searchTerm !== undefined ? searchTerm : internalSearchQuery;

  const filteredData = data.filter(item => {
    if (!activeSearchQuery) return true;
    return columns.some(col => {
      const value = (item as any)[col.key];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(activeSearchQuery.toLowerCase());
      }
      return false;
    });
  });

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedItems.length === filteredData.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredData.map(item => item.id));
    }
  };

  const handleSelectItem = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedItems.includes(id)) {
      onSelectionChange(selectedItems.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedItems, id]);
    }
  };

  return (
    <AdminCard>
      {!hideToolbar && (
        <AdminCardHeader className="border-b bg-muted/40 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-9 bg-background"
                value={activeSearchQuery}
                onChange={(e) => {
                  if (onSearchChange) {
                    onSearchChange(e.target.value);
                  } else {
                    setInternalSearchQuery(e.target.value);
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              {selectedItems.length > 0 && bulkActions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Actions ({selectedItems.length})
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {bulkActions.map((action, idx) => (
                      <DropdownMenuItem
                        key={idx}
                        onClick={() => action.onClick(selectedItems)}
                        className={action.variant === 'destructive' ? 'text-red-600' : ''}
                      >
                        {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {onAdd && (
                <Button onClick={onAdd} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {addButtonLabel}
                </Button>
              )}
            </div>
          </div>
        </AdminCardHeader>
      )}
      <AdminCardContent className="p-0">
        <Table>
          <TableHeader className="bg-[var(--color-creme-light)] border-b border-[var(--color-coyote)]/20">
            <TableRow className="hover:bg-transparent">
              {onSelectionChange && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedItems.length === filteredData.length && filteredData.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map(col => (
                <TableHead key={col.key} className="font-bold text-[var(--color-dark)]">{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (onSelectionChange ? 1 : 0)} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (onSelectionChange ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                  No items found.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map(item => (
                <TableRow
                  key={item.id}
                  className={`${onRowClick ? 'cursor-pointer' : ''} hover:bg-muted/50`}
                  onClick={() => onRowClick?.(item)}
                >
                  {onSelectionChange && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => handleSelectItem(item.id)}
                      />
                    </TableCell>
                  )}
                  {columns.map(col => (
                    <TableCell key={col.key}>
                      {col.render
                        ? col.render((item as any)[col.key], item)
                        : (item as any)[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminCardContent>
    </AdminCard>
  );
}
