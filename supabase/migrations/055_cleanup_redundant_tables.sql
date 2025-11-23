-- Migration: Cleanup redundant tables
-- Description: Drops tables that have been replaced or are no longer used.

-- 1. Drop product_images (images are now stored in arrays on products/variants)
DROP TABLE IF EXISTS public.product_images;

-- 2. Drop featured_products if it exists (featured status is now a column on products)
DROP TABLE IF EXISTS public.featured_products;

-- 3. Drop product_specifications if it exists (specifications are now a JSONB column)
DROP TABLE IF EXISTS public.product_specifications;
