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
          <div className="font-medium text-foreground">{name}</div>
          <div className="text-sm text-muted-foreground">{discount.description}</div>
          {discount.code && (
            <div className="text-xs text-muted-foreground font-mono">{discount.code}</div>
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
          <div className="text-sm font-medium text-foreground mt-1">
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
            <div className="text-muted-foreground">of {discount.usage_limit}</div>
          )}
        </div>
      )
    },
    {
      key: 'dates',
      label: 'Duration',
      render: (_: any, discount: Discount) => (
        <div className="text-sm text-muted-foreground">
          {discount.start_date && (
            <div>From: {new Date(discount.start_date).toLocaleDateString()}</div>
          )}
          {discount.end_date && (
            <div>To: {new Date(discount.end_date).toLocaleDateString()}</div>
          )}
          {!discount.start_date && !discount.end_date && (
            <div className="text-muted-foreground">No limits</div>
          )}
        </div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (_: any, discount: Discount) => {
        const status = getStatusText(discount.is_active, discount.start_date, discount.end_date);
        return <Badge variant={status === 'Expired' ? 'destructive' : status === 'Active' ? 'default' : 'secondary'}>{status}</Badge>;
      }
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
    <div className="min-h-screen bg-background">
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
        <Button onClick={handleAddDiscount} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" />
          Add Discount
        </Button>
      </PageHeader>

      <div className="p-4 sm:p-6 max-w-400 mx-auto space-y-4 sm:space-y-6">
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
