-- ============================================================================
-- Migration: 078_fix_variant_triggers.sql
-- Description: Drop obsolete triggers on product_variants that reference dropped columns
--              Fixes "record new has no field meta_title" error
-- Date: 2024-11-28
-- ============================================================================

BEGIN;

-- Drop potential rogue triggers on product_variants
DROP TRIGGER IF EXISTS trigger_auto_fill_variant_seo ON public.product_variants;
DROP TRIGGER IF EXISTS trigger_update_variant_seo ON public.product_variants;
DROP TRIGGER IF EXISTS trigger_update_variant_meta ON public.product_variants;
DROP TRIGGER IF EXISTS update_variant_seo ON public.product_variants;
DROP TRIGGER IF EXISTS set_variant_defaults ON public.product_variants;

-- Drop the underlying functions if they exist
DROP FUNCTION IF EXISTS public.auto_fill_variant_seo() CASCADE;
DROP FUNCTION IF EXISTS public.update_variant_seo() CASCADE;
DROP FUNCTION IF EXISTS public.update_variant_meta() CASCADE;
DROP FUNCTION IF EXISTS public.set_variant_defaults() CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 078_fix_variant_triggers completed successfully';
END $$;

COMMIT;
