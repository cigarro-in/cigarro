-- Migration: Fix discounts table - add missing description column
-- Version: 034
-- Description: Add description column to discounts table if it doesn't exist

-- Add description column to discounts table if it doesn't exist
DO $$
BEGIN
    -- Check if discounts table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'discounts') THEN
        -- Add description column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'discounts' AND column_name = 'description') THEN
            ALTER TABLE public.discounts 
            ADD COLUMN description TEXT;
        END IF;
    END IF;
END
$$;
