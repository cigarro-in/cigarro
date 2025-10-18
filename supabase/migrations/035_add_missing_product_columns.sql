-- ============================================================================
-- Migration 035: Add Missing Product & Variant Columns
-- ============================================================================
-- Purpose: Add columns that ProductForm sends but database doesn't have
-- Date: October 17, 2025
-- ============================================================================

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO PRODUCTS TABLE
-- ============================================================================

-- Add short_description for product listings
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS short_description TEXT;

-- Add pricing columns for discount/profit tracking
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC;

-- Add inventory management flags
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS continue_selling_when_out_of_stock BOOLEAN DEFAULT false;

-- Add brand_id FK for proper brand relationships
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Add ordering columns for featured/showcase sections
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS showcase_order INTEGER,
  ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT 0;

COMMENT ON COLUMN public.products.short_description IS 'Brief description for product listings';
COMMENT ON COLUMN public.products.compare_at_price IS 'Original price before discount (for showing savings)';
COMMENT ON COLUMN public.products.cost_price IS 'Cost price for profit margin calculations';
COMMENT ON COLUMN public.products.track_inventory IS 'Whether to track inventory for this product';
COMMENT ON COLUMN public.products.continue_selling_when_out_of_stock IS 'Allow sales when stock is 0';
COMMENT ON COLUMN public.products.brand_id IS 'Foreign key to brands table';
COMMENT ON COLUMN public.products.showcase_order IS 'Display order in showcase section';
COMMENT ON COLUMN public.products.featured_order IS 'Display order in featured section';

-- ============================================================================
-- 2. ADD MISSING COLUMNS TO PRODUCT_VARIANTS TABLE
-- ============================================================================

-- Add pricing columns for variant-level discounts/costs
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC;

-- Add inventory management flag
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.product_variants.compare_at_price IS 'Original price before discount (variant-level)';
COMMENT ON COLUMN public.product_variants.cost_price IS 'Cost price for profit margin calculations (variant-level)';
COMMENT ON COLUMN public.product_variants.track_inventory IS 'Whether to track inventory for this variant';

-- ============================================================================
-- 3. REMOVE REDUNDANT BRAND COLUMN FROM VARIANTS
-- ============================================================================

-- Variants should inherit brand from parent product
ALTER TABLE public.product_variants
  DROP COLUMN IF EXISTS brand;

-- ============================================================================
-- 4. CREATE INDEXES FOR NEW COLUMNS
-- ============================================================================

-- Index for brand_id FK lookups
CREATE INDEX IF NOT EXISTS idx_products_brand_id 
  ON public.products(brand_id) 
  WHERE brand_id IS NOT NULL;

-- Index for compare_at_price (for discount filtering)
CREATE INDEX IF NOT EXISTS idx_products_compare_at_price 
  ON public.products(compare_at_price) 
  WHERE compare_at_price IS NOT NULL;

-- Index for showcase_order
CREATE INDEX IF NOT EXISTS idx_products_showcase_order 
  ON public.products(showcase_order) 
  WHERE is_showcase = true AND showcase_order IS NOT NULL;

-- Index for featured_order
CREATE INDEX IF NOT EXISTS idx_products_featured_order 
  ON public.products(featured_order) 
  WHERE is_featured = true;

-- ============================================================================
-- 5. BACKFILL BRAND_ID FROM BRAND TEXT
-- ============================================================================

-- Match existing products to brands table by name
UPDATE public.products p
SET brand_id = b.id
FROM public.brands b
WHERE p.brand_id IS NULL 
  AND lower(trim(p.brand)) = lower(trim(b.name));

-- ============================================================================
-- 6. ADD VALIDATION CONSTRAINTS
-- ============================================================================

-- Note: We don't add strict constraints on compare_at_price vs price
-- because the application handles this logic (compare_at_price can be 0 or NULL)
-- The helper functions will calculate discounts correctly

-- Drop ALL existing constraints (including old compare_at_price ones)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS check_products_compare_at_price,
  DROP CONSTRAINT IF EXISTS check_products_cost_price;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS check_variants_compare_at_price,
  DROP CONSTRAINT IF EXISTS check_variants_cost_price;

-- Only ensure cost_price is non-negative (if set)
ALTER TABLE public.products
  ADD CONSTRAINT check_products_cost_price 
  CHECK (cost_price IS NULL OR cost_price >= 0);

ALTER TABLE public.product_variants
  ADD CONSTRAINT check_variants_cost_price 
  CHECK (cost_price IS NULL OR cost_price >= 0);

-- ============================================================================
-- 7. UPDATE RLS POLICIES (if needed)
-- ============================================================================

-- RLS policies should already cover new columns since they use SELECT *
-- No changes needed

-- ============================================================================
-- 8. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate discount percentage
CREATE OR REPLACE FUNCTION public.calculate_discount_percentage(
  price NUMERIC,
  compare_at_price NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF compare_at_price IS NULL OR compare_at_price <= price THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(((compare_at_price - price) / compare_at_price * 100)::NUMERIC);
END;
$$;

COMMENT ON FUNCTION public.calculate_discount_percentage IS 'Calculate discount percentage from price and compare_at_price';

-- Function to calculate profit margin
CREATE OR REPLACE FUNCTION public.calculate_profit_margin(
  price NUMERIC,
  cost_price NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF cost_price IS NULL OR cost_price = 0 THEN
    RETURN NULL;
  END IF;
  
  RETURN ROUND(((price - cost_price) / price * 100)::NUMERIC, 2);
END;
$$;

COMMENT ON FUNCTION public.calculate_profit_margin IS 'Calculate profit margin percentage from price and cost_price';

-- ============================================================================
-- 9. CREATE VIEWS FOR PRODUCT ANALYTICS
-- ============================================================================

-- View for products with discount information
CREATE OR REPLACE VIEW public.products_with_discounts AS
SELECT 
  p.*,
  calculate_discount_percentage(p.price, p.compare_at_price) as discount_percentage,
  calculate_profit_margin(p.price, p.cost_price) as profit_margin,
  CASE 
    WHEN p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price 
    THEN p.compare_at_price - p.price 
    ELSE 0 
  END as savings_amount,
  b.name as brand_name,
  b.logo_url as brand_logo
FROM public.products p
LEFT JOIN public.brands b ON p.brand_id = b.id;

COMMENT ON VIEW public.products_with_discounts IS 'Products with calculated discount and profit margin information';

-- View for variants with discount information
CREATE OR REPLACE VIEW public.variants_with_discounts AS
SELECT 
  v.*,
  calculate_discount_percentage(v.price, v.compare_at_price) as discount_percentage,
  calculate_profit_margin(v.price, v.cost_price) as profit_margin,
  CASE 
    WHEN v.compare_at_price IS NOT NULL AND v.compare_at_price > v.price 
    THEN v.compare_at_price - v.price 
    ELSE 0 
  END as savings_amount,
  p.name as product_name,
  p.brand as product_brand,
  p.brand_id as product_brand_id
FROM public.product_variants v
JOIN public.products p ON v.product_id = p.id;

COMMENT ON VIEW public.variants_with_discounts IS 'Variants with calculated discount and profit margin information';

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant SELECT on views to authenticated users
GRANT SELECT ON public.products_with_discounts TO authenticated;
GRANT SELECT ON public.variants_with_discounts TO authenticated;

-- Grant EXECUTE on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.calculate_discount_percentage TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_profit_margin TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify changes
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 035 completed successfully';
  RAISE NOTICE '📊 Added columns to products: short_description, compare_at_price, cost_price, track_inventory, continue_selling_when_out_of_stock, brand_id';
  RAISE NOTICE '📊 Added columns to product_variants: compare_at_price, cost_price, track_inventory';
  RAISE NOTICE '🗑️  Removed redundant brand column from product_variants';
  RAISE NOTICE '🔗 Created indexes for new columns';
  RAISE NOTICE '🔄 Backfilled brand_id from brand text';
  RAISE NOTICE '✅ Created helper functions and views';
END $$;
