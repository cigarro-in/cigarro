import type { KeyboardEvent, ReactNode } from 'react';
import { Checkbox } from '../../../components/ui/checkbox';
import { Empty, EmptyHeader, EmptyTitle } from '../../../components/ui/empty';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { cn } from '../../../components/ui/utils';
import { AdminCard, AdminCardContent } from './AdminCard';

interface Column<T> {
  key: string;
  label: string;
  render?: (value: any, item: T) => ReactNode;
  align?: 'left' | 'right';
}

export interface BulkAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (selectedIds: string[]) => void;
  variant?: 'default' | 'destructive';
}

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onRowClick?: (item: T) => void;
  searchTerm?: string;
  searchText?: (item: T) => string;
  emptyLabel?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading = false,
  selectedItems = [],
  onSelectionChange,
  onRowClick,
  searchTerm,
  searchText,
  emptyLabel = 'No results',
}: DataTableProps<T>) {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  const filteredData = normalizedSearch
    ? data.filter((item) => {
        const haystack = searchText
          ? searchText(item)
          : Object.values(item)
              .filter((value) => typeof value === 'string' || typeof value === 'number')
              .join(' ');
        return haystack.toLowerCase().includes(normalizedSearch);
      })
    : data;

  const visibleIds = filteredData.map((item) => item.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedItems.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedItems.includes(id));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allVisibleSelected) {
      onSelectionChange(selectedItems.filter((id) => !visibleIds.includes(id)));
      return;
    }
    onSelectionChange(Array.from(new Set([...selectedItems, ...visibleIds])));
  };

  const handleSelectItem = (id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(
      selectedItems.includes(id)
        ? selectedItems.filter((selectedId) => selectedId !== id)
        : [...selectedItems, id],
    );
  };

  const activateRow = (event: KeyboardEvent<HTMLTableRowElement>, item: T) => {
    if (event.target !== event.currentTarget) return;
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onRowClick(item);
  };

  const columnCount = columns.length + (onSelectionChange ? 1 : 0);

  return (
    <AdminCard>
      <AdminCardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {onSelectionChange && (
                <TableHead className="w-12">
                  <Checkbox
                    aria-label="Select visible rows"
                    checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={column.key} className={cn(column.align === 'right' && 'text-right')}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [0, 1, 2, 3, 4].map((row) => (
                <TableRow key={row}>
                  <TableCell colSpan={columnCount}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount}>
                  <Empty className="min-h-40">
                    <EmptyHeader>
                      <EmptyTitle>{emptyLabel}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow
                  key={item.id}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(onRowClick && 'cursor-pointer')}
                  onClick={() => onRowClick?.(item)}
                  onKeyDown={(event) => activateRow(event, item)}
                >
                  {onSelectionChange && (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        aria-label={`Select row ${item.id}`}
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => handleSelectItem(item.id)}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.key} className={cn(column.align === 'right' && 'text-right')}>
                      {column.render
                        ? column.render((item as any)[column.key], item)
                        : (item as any)[column.key]}
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
