-- Migration: Add featured_order column to products table
-- Version: 0024
-- Description: Add featured_order column for proper ordering of featured products

-- Add featured_order column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT 0;

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_products_featured_order ON public.products(featured_order);

-- Set default featured_order for existing featured products using a cursor approach
DO $$
DECLARE
    product_record RECORD;
    order_counter INTEGER := 1;
BEGIN
    -- Update existing featured products with sequential ordering
    FOR product_record IN
        SELECT id
        FROM public.products
        WHERE is_featured = true
        ORDER BY created_at
    LOOP
        UPDATE public.products
        SET featured_order = order_counter
        WHERE id = product_record.id;

        order_counter := order_counter + 1;
    END LOOP;

    -- Ensure featured_order is not null for all products
    UPDATE public.products
    SET featured_order = 0
    WHERE featured_order IS NULL;
END $$;
