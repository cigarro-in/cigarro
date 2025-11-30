// ============================================================================
// CENTRALIZED TYPE EXPORTS
// Import types from here: import { Product, Brand, ... } from '@/types'
// ============================================================================

// Core product types
export type {
  Product,
  ProductVariant,
  Brand,
  Category,
  Collection,
  VariantImage,
  ProductFormData,
  VariantFormData,
  PriceBreakdown,
  InventoryStatus,
  ProductFilters,
} from './product';

// Helper functions
export {
  calculateDiscount,
  getInventoryStatus,
  generateSlug,
  calculateProfitMargin,
} from './product';

// Variant, Combo, and Discount types
export type {
  Combo,
  ProductCombo,
  ComboItem,
  Discount,
  SearchResult,
  CartItemWithVariant,
  OrderItemWithVariant,
  ProductWithVariants,
  DiscountResult,
  CartWithDiscount,
  VariantSelection,
  ComboDisplay,
  SearchQueryParse,
  ComboFormData,
  DiscountFormData,
} from './variants';

// Homepage types
export type {
  HeroSlide,
  Category as HomeCategory,
  Brand as HomeBrand,
  SectionConfig,
  ShowcaseConfig,
  BlogSectionConfig,
  BlogPostAuthor,
  BlogPostCategory,
  BlogPost,
  HomepageProductVariant,
  HomepageProduct,
  CategoryWithProducts,
  HomepageData,
} from './home';

// Blog types
export type {
  BlogPost as BlogPostFull,
  BlogCategory,
  BlogTag,
  BlogComment,
} from './blog';

// Referral types
export type {
  Referral,
  ReferralStats,
  ReferredUser,
  ReferralLeaderboard,
} from './referral';

// Admin types
export type {
  AdminUser,
  AdminRole,
  AdminPermission,
  AdminSession,
  AuditLog,
} from './admin';
