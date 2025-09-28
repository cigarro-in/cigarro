-- Add brand column to products table
-- This migration adds back the brand column that was removed in migration 030

-- Add brand column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS brand TEXT;

-- Add brand column to product_variants table as well
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS brand TEXT;

-- Update existing products to have brand data (if any exists)
-- This will set brand to 'Premium' for existing products as a default
UPDATE public.products
SET brand = 'Premium'
WHERE brand IS NULL;

-- Update existing variants to have brand data
UPDATE public.product_variants
SET brand = 'Premium'
WHERE brand IS NULL;

-- Add index for brand filtering performance
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_product_variants_brand ON public.product_variants(brand);

-- Add comments
COMMENT ON COLUMN public.products.brand IS 'Brand name for the product (e.g., Marlboro, Camel, etc.)';
COMMENT ON COLUMN public.product_variants.brand IS 'Brand name for the variant (inherited from product)';
