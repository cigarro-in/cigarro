-- ============================================================================
-- Migration 037: Add Heritage Column to Brands Table
-- ============================================================================
-- Purpose: Add heritage JSONB column to store brand history and story
-- Date: October 18, 2025
-- ============================================================================

-- Add heritage column as JSONB for flexible brand history data
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS heritage JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.brands.heritage IS 'Brand heritage information (founded_year, origin_country, founder, story)';

-- Create index for heritage queries
CREATE INDEX IF NOT EXISTS idx_brands_heritage 
  ON public.brands USING gin(heritage);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 037 completed successfully';
  RAISE NOTICE '📊 Added heritage JSONB column to brands table';
  RAISE NOTICE '🔍 Created GIN index for heritage queries';
END $$;
