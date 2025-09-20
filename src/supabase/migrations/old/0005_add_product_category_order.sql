-- Migration: Add order column to product_categories
-- Version: 0005
-- Description: Adds an 'order' column to the product_categories table for custom sorting.

ALTER TABLE public.product_categories
ADD COLUMN "order" INT DEFAULT 0;

-- Optional: Add a unique constraint if you want to ensure order is unique per category
-- ALTER TABLE public.product_categories
-- ADD CONSTRAINT unique_category_product_order UNIQUE (category_id, "order");
