import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2, Percent, Tag, Calendar, Plus } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { formatINR } from '../../utils/currency';
import { DataTable } from '../components/shared/DataTable';
import { BulkActionsMenu } from '../components/shared/BulkActionsMenu';
import { PageHeader } from '../components/shared/PageHeader';

// Database-aligned Discount interface
interface Discount {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  type: 'percentage' | 'fixed_amount' | 'cart_value';
  value: number;
  min_cart_value: number | null;
  max_discount_amount: number | null;
  applicable_to: 'all' | 'products' | 'combos' | 'variants';
  product_ids: string[] | null;
  combo_ids: string[] | null;
  variant_ids: string[] | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function DiscountsPage() {
  const navigate = useNavigate();
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();

  const rows = useQuery(api.discounts.listDiscountsForAdmin, { orgSlug: ORG_SLUG });
  const removeDiscount = useMutation(api.discounts.deleteDiscount);
  const setStatus = useMutation(api.discounts.setDiscountsStatus);

  // Boundary: Convex ms dates → ISO strings the table already renders.
  const toISO = (ms?: number | null) => (ms ? new Date(ms).toISOString() : null);
  const discounts: Discount[] = (rows || []).map((d: any) => ({
    id: d._id,
    name: d.name,
    code: d.code ?? null,
    description: d.description ?? null,
    type: d.type,
    value: d.value,
    min_cart_value: d.min_cart_value ?? null,
    max_discount_amount: d.max_discount_amount ?? null,
    applicable_to: d.applicable_to,
    product_ids: d.product_ids ?? null,
    combo_ids: d.combo_ids ?? null,
    variant_ids: d.variant_ids ?? null,
    start_date: toISO(d.start_date),
    end_date: toISO(d.end_date),
    usage_limit: d.usage_limit ?? null,
    usage_count: d.usage_count ?? 0,
    is_active: d.is_active,
    created_at: d.createdAt ? new Date(d.createdAt).toISOString() : '',
    updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : '',
  }));
  const loading = rows === undefined;

  const handleAddDiscount = () => {
    navigate('/admin/discounts/new');
  };

  const handleEditDiscount = (discount: Discount) => {
    navigate(`/admin/discounts/${discount.id}`);
  };

  const handleBulkDelete = async (discountIds: string[]) => {
    if (!confirm(`Delete ${discountIds.length} discounts?`)) return;
    try {
      for (const id of discountIds) {
        await removeDiscount({ id: id as any, orgSlug: ORG_SLUG });
      }
      setOpOk(`${discountIds.length} discounts deleted`);
      setSelectedDiscounts([]);
    } catch (error: any) {
      setOpError(
        error?.data?.code === 'NOT_DISCOUNT_ADMIN'
          ? 'Admin access required'
          : 'Failed to delete discounts'
      );
    }
  };

  const handleBulkStatusChange = async (discountIds: string[], isActive: boolean) => {
    try {
      await setStatus({ ids: discountIds as any, isActive, orgSlug: ORG_SLUG });
      setOpOk(`${discountIds.length} discounts ${isActive ? 'activated' : 'deactivated'}`);
      setSelectedDiscounts([]);
    } catch (error: any) {
      setOpError(
        error?.data?.code === 'NOT_DISCOUNT_ADMIN'
          ? 'Admin access required'
          : 'Failed to update status'
      );
    }
  };

  const formatDiscountValue = (discount: Discount) => {
    switch (discount.type) {
      case 'percentage':
        return `${discount.value}%`;
      case 'fixed_amount':
        return formatINR(discount.value);
      case 'cart_value':
        return `Cart value: ${formatINR(discount.value)}`;
      default:
        return formatINR(discount.value);
    }
  };

  const getStatusColor = (isActive: boolean, startDate?: string | null, endDate?: string | null) => {
    if (!isActive) return 'bg-gray-100 text-gray-800';
    
    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start && start > now) return 'bg-yellow-100 text-yellow-800';
    if (end && end < now) return 'bg-red-100 text-red-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (isActive: boolean, startDate?: string | null, endDate?: string | null) => {
    if (!isActive) return 'Inactive';
    
    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start && start > now) return 'Scheduled';
    if (end && end < now) return 'Expired';
    return 'Active';
  };

  const columns = [
    {
      key: 'name',
      label: 'Discount Name',
      render: (name: string, discount: Discount) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-500">{discount.description}</div>
          {discount.code && (
            <div className="text-xs text-gray-400 font-mono">{discount.code}</div>
          )}
        </div>
      )
    },
    {
      key: 'type',
      label: 'Type',
      render: (type: string, discount: Discount) => (
        <div>
          <Badge variant="outline" className="capitalize">
            {type.replace('_', ' ')}
          </Badge>
          <div className="text-sm font-medium text-gray-900 mt-1">
            {formatDiscountValue(discount)}
          </div>
        </div>
      )
    },
    {
      key: 'applicable_to',
      label: 'Applies To',
      render: (applicableTo: string) => (
        <Badge variant="outline" className="capitalize">
          {applicableTo}
        </Badge>
      )
    },
    {
      key: 'usage_count',
      label: 'Usage',
      render: (count: number, discount: Discount) => (
        <div className="text-sm">
          <div className="font-medium">{count}</div>
          {discount.usage_limit && (
            <div className="text-gray-500">of {discount.usage_limit}</div>
          )}
        </div>
      )
    },
    {
      key: 'dates',
      label: 'Duration',
      render: (_: any, discount: Discount) => (
        <div className="text-sm text-gray-600">
          {discount.start_date && (
            <div>From: {new Date(discount.start_date).toLocaleDateString()}</div>
          )}
          {discount.end_date && (
            <div>To: {new Date(discount.end_date).toLocaleDateString()}</div>
          )}
          {!discount.start_date && !discount.end_date && (
            <div className="text-gray-400">No limits</div>
          )}
        </div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (_: any, discount: Discount) => (
        <Badge className={getStatusColor(discount.is_active, discount.start_date, discount.end_date)}>
          {getStatusText(discount.is_active, discount.start_date, discount.end_date)}
        </Badge>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (date: string) => new Date(date).toLocaleDateString()
    }
  ];

  const bulkActions = [
    {
      label: 'Activate Selected',
      icon: Eye,
      onClick: (discountIds: string[]) => handleBulkStatusChange(discountIds, true)
    },
    {
      label: 'Deactivate Selected',
      icon: EyeOff,
      onClick: (discountIds: string[]) => handleBulkStatusChange(discountIds, false)
    },
    {
      label: 'Delete Selected',
      icon: Trash2,
      onClick: handleBulkDelete,
      variant: 'destructive' as const
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--color-creme)]">
      <PageHeader 
        title="Discounts" 
        description="Manage discount codes and promotions"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search discounts..."
        }}
      >
        <BulkActionsMenu selectedIds={selectedDiscounts} actions={bulkActions} />
        <Button onClick={handleAddDiscount} className="bg-[var(--color-canyon)] hover:bg-[var(--color-canyon)]/90 text-[var(--color-creme)]">
          <Plus className="mr-2 h-4 w-4" />
          Add Discount
        </Button>
      </PageHeader>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <InlineStatus status={opStatus} />
        <DataTable
          data={discounts}
          columns={columns}
          loading={loading}
          selectedItems={selectedDiscounts}
          onSelectionChange={setSelectedDiscounts}
          onRowClick={handleEditDiscount}
          searchTerm={searchTerm}
        />
      </div>
    </div>
  );
}
