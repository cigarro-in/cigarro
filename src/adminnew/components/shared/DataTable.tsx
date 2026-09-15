import { Loader2 } from 'lucide-react';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { AdminCard, AdminCardContent } from './AdminCard';

interface Column<T> {
  key: string;
  label: string;
  render?: (value: any, item: T) => React.ReactNode;
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
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading = false,
  selectedItems = [],
  onSelectionChange,
  onRowClick,
  searchTerm,
}: DataTableProps<T>) {
  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    return columns.some(col => {
      const value = (item as any)[col.key];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(searchTerm.toLowerCase());
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
