-- Add showcase columns to products table
-- This migration adds columns to manage product showcase functionality

-- Add is_showcase column to products table if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_showcase') THEN
        ALTER TABLE public.products ADD COLUMN is_showcase BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add showcase_order column to products table if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='showcase_order') THEN
        ALTER TABLE public.products ADD COLUMN showcase_order INTEGER;
    END IF;
END $$;

-- Create index for showcase_order for better performance
CREATE INDEX IF NOT EXISTS idx_products_showcase_order ON public.products(showcase_order) WHERE is_showcase = TRUE;

-- Create index for is_showcase for better performance
CREATE INDEX IF NOT EXISTS idx_products_is_showcase ON public.products(is_showcase) WHERE is_showcase = TRUE;
