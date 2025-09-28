-- Add stock column to product_variants table
-- This migration adds the missing stock column that's referenced in the application code

-- Add stock column to product_variants table
ALTER TABLE public.product_variants 
ADD COLUMN stock INTEGER DEFAULT 0 NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.product_variants.stock IS 'Stock quantity for this variant';

-- Update existing records to have a default stock value of 0
UPDATE public.product_variants 
SET stock = 0 
WHERE stock IS NULL;
