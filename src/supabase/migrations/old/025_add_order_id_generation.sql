-- Migration: Add automatic display_order_id generation
-- This fixes the missing order ID generation that was referenced but never implemented

-- Create a sequence for order numbering starting from 100001 (6 digits)
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 100001;

-- Function to generate display order ID
CREATE OR REPLACE FUNCTION generate_display_order_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if display_order_id is not already set
  IF NEW.display_order_id IS NULL THEN
    NEW.display_order_id := nextval('order_number_seq')::TEXT;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate display_order_id on insert
DROP TRIGGER IF EXISTS trigger_generate_display_order_id ON public.orders;
CREATE TRIGGER trigger_generate_display_order_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_display_order_id();

-- Update existing orders that have NULL display_order_id
-- Using a CTE to avoid window function issues in UPDATE
WITH numbered_orders AS (
  SELECT id, (100001 + ROW_NUMBER() OVER (ORDER BY created_at) - 1) AS new_order_id
  FROM public.orders 
  WHERE display_order_id IS NULL
)
UPDATE public.orders 
SET display_order_id = numbered_orders.new_order_id::TEXT
FROM numbered_orders 
WHERE public.orders.id = numbered_orders.id;

-- Reset sequence to continue from the highest existing number
SELECT setval('order_number_seq', 
  COALESCE((SELECT MAX(display_order_id::INTEGER) FROM public.orders WHERE display_order_id ~ '^\d+$'), 100000) + 1,
  false
);
