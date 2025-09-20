-- Migration: Change price column from INTEGER to DECIMAL
-- Version: 007
-- Description: Store prices as decimal numbers (e.g., 100.35) instead of paise/cents

-- Change products table price column to DECIMAL
ALTER TABLE public.products 
ALTER COLUMN price TYPE DECIMAL(10,2);

-- Update the comment to reflect the change
COMMENT ON COLUMN public.products.price IS 'Price in INR rupees (e.g., 100.35)';

-- Change orders table price columns to DECIMAL
ALTER TABLE public.orders 
ALTER COLUMN subtotal TYPE DECIMAL(10,2),
ALTER COLUMN tax TYPE DECIMAL(10,2),
ALTER COLUMN shipping TYPE DECIMAL(10,2),
ALTER COLUMN total TYPE DECIMAL(10,2),
ALTER COLUMN discount TYPE DECIMAL(10,2);

-- Change order_items table price column to DECIMAL
ALTER TABLE public.order_items 
ALTER COLUMN product_price TYPE DECIMAL(10,2);

-- Update comments for orders table
COMMENT ON COLUMN public.orders.subtotal IS 'Subtotal in INR rupees (e.g., 100.35)';
COMMENT ON COLUMN public.orders.tax IS 'Tax in INR rupees (e.g., 10.50)';
COMMENT ON COLUMN public.orders.shipping IS 'Shipping cost in INR rupees (e.g., 25.00)';
COMMENT ON COLUMN public.orders.discount IS 'Discount amount in INR rupees (e.g., 10.50)';
COMMENT ON COLUMN public.orders.total IS 'Total amount in INR rupees (e.g., 135.85)';
COMMENT ON COLUMN public.order_items.product_price IS 'Product price in INR rupees (e.g., 100.35)';
