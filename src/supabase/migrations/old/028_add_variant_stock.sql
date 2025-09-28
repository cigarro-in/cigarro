-- Add stock field to product_variants table
-- This migration adds stock management to product variants

-- Add stock column to product_variants
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- Add attributes column for flexible variant properties
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';

-- Add index for stock queries
CREATE INDEX IF NOT EXISTS idx_product_variants_stock ON public.product_variants(stock);

-- Add index for attributes queries
CREATE INDEX IF NOT EXISTS idx_product_variants_attributes ON public.product_variants USING GIN(attributes);

-- Update existing variants to have default stock
UPDATE public.product_variants 
SET stock = 0 
WHERE stock IS NULL;

-- Add constraint to ensure stock is non-negative
ALTER TABLE public.product_variants 
ADD CONSTRAINT check_variant_stock_non_negative 
CHECK (stock >= 0);

COMMENT ON COLUMN public.product_variants.stock IS 'Stock quantity for this specific variant';
COMMENT ON COLUMN public.product_variants.attributes IS 'Flexible key-value attributes for variant properties (color, size, etc.)';
