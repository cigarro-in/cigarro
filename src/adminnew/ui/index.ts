// Admin UI primitives. Page authors import from here only:
//   import { Page, Card, Button, DataTable, ... } from '../ui';
// See ./README.md for usage rules (standard width, no eyebrows, no toasts).

export { Page, PageLayout, type PageAction } from './Page';
export { Card, CardSection } from './Card';
export {
  Button,
  useButtonFeedback,
  toActionError,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
  type ButtonState,
  type ActionError,
} from './Button';
export { Badge, StatusBadge, type BadgeTone } from './Badge';
export { Banner, ErrorBanner, type BannerTone } from './Banner';
export { EmptyState, Skeleton, SkeletonText, SkeletonTable } from './Feedback';
export { Tabs, type TabItem } from './Tabs';
export { FilterBar, FilterChip, FilterSelect, type FilterOption } from './FilterBar';
export {
  DateRangePresets,
  getDateRange,
  inDateRange,
  DATE_RANGE_LABEL,
  DATE_RANGE_PRESETS,
  type DateRange,
  type DateRangePreset,
} from './DateRangePresets';
export { BulkActionBar } from './BulkActionBar';
export { DataTable, Pagination, paginate, Checkbox, useRowSelection, type Column } from './DataTable';
export { Menu, type MenuItem, type MenuSection } from './Menu';
export { Dialog, ConfirmDialog, Sheet } from './Overlay';
export { OtpInput } from './OtpInput';

// Form controls: the shared shadcn inputs already follow the admin tokens.
export { Input } from '../../components/ui/input';
export { Textarea } from '../../components/ui/textarea';
export { Label } from '../../components/ui/label';
export { Switch } from '../../components/ui/switch';
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

// Shared order display model (single stage instead of payment + shipping).
export {
  deriveOrderStage,
  nextOrderActions,
  STAGE_LABEL,
  STAGE_TONE,
  STAGE_ACTIONS,
  ORDER_ACTION_LABEL,
  ORDER_STAGES,
  type OrderStage,
  type OrderAction,
} from '../../lib/orders/orderStage';
export { formatOrderNumber, formatOrderDate } from '../../lib/orders/format';
