-- Add discount column to orders table
ALTER TABLE public.orders ADD COLUMN discount INTEGER DEFAULT 0;

-- Add comment to explain discount is stored in paise (1/100 of rupee)
COMMENT ON COLUMN public.orders.discount IS 'Discount amount in paise (1/100 of rupee)';

