-- ============================================================================
-- Migration: 076_product_schema_cleanup.sql
-- Description: Clean up and simplify product-related tables
--              - Simplify products table (remove legacy/redundant columns)
--              - Simplify product_variants table (add unit column, remove bloat)
--              - Simplify brands table (remove is_featured, tier)
--              - Merge product_combos + combo_items into combos table
--              - Drop unused tables and views
-- Date: 2024-11-27
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: DROP DEPENDENT VIEWS AND MATERIALIZED VIEWS
-- ============================================================================

-- Drop materialized view that depends on products.brand
DROP MATERIALIZED VIEW IF EXISTS public.searchable_products CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS public.get_searchable_products(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.refresh_searchable_products() CASCADE;

-- Drop unused views
DROP VIEW IF EXISTS public.products_with_discounts CASCADE;
DROP VIEW IF EXISTS public.variants_with_discounts CASCADE;

-- Drop unused tables
DROP TABLE IF EXISTS public.product_seo_analytics CASCADE;
DROP TABLE IF EXISTS public.product_reviews CASCADE;
DROP TABLE IF EXISTS public.payment_verification_logs CASCADE;
DROP TABLE IF EXISTS public.payment_verifications CASCADE;

-- ============================================================================
-- SECTION 2: CLEAN UP PRODUCTS TABLE
-- ============================================================================

-- Drop redundant/legacy columns from products
-- Final columns: id, name, slug, brand_id, description, short_description,
--                origin, specifications, is_active, meta_title, meta_description,
--                canonical_url, created_at, updated_at
ALTER TABLE public.products 
    DROP COLUMN IF EXISTS brand,
    DROP COLUMN IF EXISTS gallery_images,
    DROP COLUMN IF EXISTS image_url,
    DROP COLUMN IF EXISTS image_alt_text,
    DROP COLUMN IF EXISTS rating,
    DROP COLUMN IF EXISTS review_count,
    DROP COLUMN IF EXISTS is_featured,
    DROP COLUMN IF EXISTS is_showcase,
    DROP COLUMN IF EXISTS featured_order,
    DROP COLUMN IF EXISTS showcase_order,
    DROP COLUMN IF EXISTS continue_selling_when_out_of_stock,
    DROP COLUMN IF EXISTS meta_keywords,
    DROP COLUMN IF EXISTS og_title,
    DROP COLUMN IF EXISTS og_description,
    DROP COLUMN IF EXISTS og_image,
    DROP COLUMN IF EXISTS twitter_title,
    DROP COLUMN IF EXISTS twitter_description,
    DROP COLUMN IF EXISTS twitter_image,
    DROP COLUMN IF EXISTS structured_data,
    DROP COLUMN IF EXISTS seo_score;

-- Drop indexes that reference removed columns
DROP INDEX IF EXISTS idx_products_brand;
DROP INDEX IF EXISTS idx_products_featured;
DROP INDEX IF EXISTS idx_products_showcase_order;
DROP INDEX IF EXISTS idx_products_featured_order;

-- ============================================================================
-- SECTION 3: CLEAN UP PRODUCT_VARIANTS TABLE
-- ============================================================================

-- Add new columns
ALTER TABLE public.product_variants 
    ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'sticks',
    ADD COLUMN IF NOT EXISTS image_alt_text TEXT;

-- Drop redundant columns from product_variants
-- Final columns: id, product_id, variant_name, variant_slug, variant_type,
--                units_contained, unit, images, image_alt_text, price,
--                compare_at_price, cost_price, stock, track_inventory,
--                is_default, is_active, created_at, updated_at
ALTER TABLE public.product_variants
    DROP COLUMN IF EXISTS packaging,
    DROP COLUMN IF EXISTS weight,
    DROP COLUMN IF EXISTS dimensions,
    DROP COLUMN IF EXISTS sort_order,
    DROP COLUMN IF EXISTS meta_title,
    DROP COLUMN IF EXISTS meta_description,
    DROP COLUMN IF EXISTS meta_keywords,
    DROP COLUMN IF EXISTS og_title,
    DROP COLUMN IF EXISTS og_description,
    DROP COLUMN IF EXISTS structured_data,
    DROP COLUMN IF EXISTS attributes;

-- ============================================================================
-- SECTION 4: CLEAN UP BRANDS TABLE
-- ============================================================================

-- Drop redundant columns from brands
-- Final columns: id, name, slug, description, logo_url, website_url,
--                country_of_origin, heritage, is_active, sort_order,
--                meta_title, meta_description, created_at, updated_at
ALTER TABLE public.brands
    DROP COLUMN IF EXISTS is_featured,
    DROP COLUMN IF EXISTS tier,
    DROP COLUMN IF EXISTS meta_keywords;

-- ============================================================================
-- SECTION 5: STANDARDIZE COMBOS (proper normalized structure)
-- ============================================================================

-- Rename product_combos to combos (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_combos') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'combos') THEN
        ALTER TABLE public.product_combos RENAME TO combos;
        -- Rename the image column for consistency
        ALTER TABLE public.combos RENAME COLUMN combo_image TO image;
    END IF;
END $$;

-- Create combos table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.combos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    combo_price NUMERIC(10,2) NOT NULL,
    original_price NUMERIC(10,2),
    discount_percentage NUMERIC(5,2),
    image TEXT,
    gallery_images TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create combo_items join table (proper normalized approach)
CREATE TABLE IF NOT EXISTS public.combo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_id UUID NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(combo_id, variant_id)
);

-- Update cart_items constraint
ALTER TABLE public.cart_items 
    DROP CONSTRAINT IF EXISTS cart_items_combo_id_fkey;

ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS order_items_combo_id_fkey;

-- Add foreign key constraints for combos
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'combo_id') THEN
        ALTER TABLE public.cart_items
            ADD CONSTRAINT cart_items_combo_id_fkey 
            FOREIGN KEY (combo_id) REFERENCES public.combos(id) ON DELETE SET NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'combo_id') THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT order_items_combo_id_fkey 
            FOREIGN KEY (combo_id) REFERENCES public.combos(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- SECTION 6: CREATE INDEXES
-- ============================================================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- Variants indexes
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_is_default ON public.product_variants(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_variants_active ON public.product_variants(is_active);

-- Combos indexes
CREATE INDEX IF NOT EXISTS idx_combos_slug ON public.combos(slug);
CREATE INDEX IF NOT EXISTS idx_combos_active ON public.combos(is_active);

-- Combo items indexes
CREATE INDEX IF NOT EXISTS idx_combo_items_combo_id ON public.combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_variant_id ON public.combo_items(variant_id);

-- ============================================================================
-- SECTION 7: ROW LEVEL SECURITY FOR COMBOS
-- ============================================================================

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active combos" ON public.combos;
CREATE POLICY "Public can view active combos" ON public.combos 
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage combos" ON public.combos;
CREATE POLICY "Admins can manage combos" ON public.combos 
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true));

-- RLS for combo_items
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view combo items" ON public.combo_items;
CREATE POLICY "Public can view combo items" ON public.combo_items 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage combo items" ON public.combo_items;
CREATE POLICY "Admins can manage combo items" ON public.combo_items 
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true));

-- ============================================================================
-- SECTION 8: UPDATE TRIGGERS
-- ============================================================================

-- Updated_at trigger for combos
DROP TRIGGER IF EXISTS update_combos_updated_at ON public.combos;
CREATE TRIGGER update_combos_updated_at 
    BEFORE UPDATE ON public.combos 
    FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ============================================================================
-- SECTION 9: GRANTS
-- ============================================================================

GRANT SELECT ON public.combos TO authenticated;
GRANT SELECT ON public.combo_items TO authenticated;
GRANT ALL ON public.combos TO service_role;
GRANT ALL ON public.combo_items TO service_role;

-- ============================================================================
-- SECTION 10: DROP OBSOLETE FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Drop combo pricing functions (no longer needed with JSONB items)
DROP FUNCTION IF EXISTS public.calculate_combo_original_price(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_combo_pricing() CASCADE;
DROP TRIGGER IF EXISTS trigger_update_combo_pricing ON public.combo_items;

-- Drop SEO-related triggers that may reference removed columns
DROP TRIGGER IF EXISTS trigger_auto_fill_product_seo ON public.products;
DROP TRIGGER IF EXISTS trigger_update_product_seo_score ON public.products;

-- Recreate simplified auto_fill_product_seo function
CREATE OR REPLACE FUNCTION public.auto_fill_product_seo()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-generate slug if empty
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.generate_slug(NEW.name);
    END IF;
    
    -- Auto-fill meta_title if empty
    IF NEW.meta_title IS NULL OR NEW.meta_title = '' THEN
        NEW.meta_title := NEW.name;
    END IF;
    
    -- Auto-fill meta_description if empty
    IF NEW.meta_description IS NULL OR NEW.meta_description = '' THEN
        NEW.meta_description := COALESCE(NEW.short_description, LEFT(NEW.description, 160));
    END IF;
    
    -- Auto-fill canonical_url if empty
    IF NEW.canonical_url IS NULL OR NEW.canonical_url = '' THEN
        NEW.canonical_url := 'https://cigarro.in/product/' || NEW.slug;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_auto_fill_product_seo
    BEFORE INSERT OR UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.auto_fill_product_seo();

-- ============================================================================
-- SECTION 11: RECREATE SEARCHABLE_PRODUCTS MATERIALIZED VIEW
-- ============================================================================

-- Recreate searchable_products with updated schema (using brand_id -> brands.name)
CREATE MATERIALIZED VIEW public.searchable_products AS
-- Products with default variant
SELECT 
    p.id,
    p.name,
    p.slug,
    b.name AS brand,
    p.description,
    dv.price AS base_price,
    dv.images AS gallery_images,
    p.is_active,
    p.created_at,
    'product'::text AS item_type,
    dv.variant_name,
    dv.id AS variant_id,
    COALESCE(p.name, '') || ' ' || COALESCE(b.name, '') || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(dv.variant_name, '') AS searchable_text
FROM public.products p
LEFT JOIN public.product_variants dv ON p.id = dv.product_id AND dv.is_default = true
LEFT JOIN public.brands b ON p.brand_id = b.id
WHERE p.is_active = true

UNION ALL

-- Combos
SELECT 
    c.id,
    c.name,
    c.slug,
    NULL AS brand,
    c.description,
    c.combo_price AS base_price,
    c.gallery_images,
    c.is_active,
    c.created_at,
    'combo'::text AS item_type,
    NULL AS variant_name,
    NULL AS variant_id,
    COALESCE(c.name, '') || ' ' || COALESCE(c.description, '') AS searchable_text
FROM public.combos c
WHERE c.is_active = true;

-- Create indexes on materialized view
CREATE INDEX IF NOT EXISTS idx_searchable_products_text ON public.searchable_products USING gin(to_tsvector('english', searchable_text));
CREATE INDEX IF NOT EXISTS idx_searchable_products_type ON public.searchable_products(item_type);
CREATE INDEX IF NOT EXISTS idx_searchable_products_id ON public.searchable_products(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_searchable_products_unique ON public.searchable_products(id, item_type, variant_id);

-- Recreate refresh function
CREATE OR REPLACE FUNCTION public.refresh_searchable_products()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.searchable_products;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate search function
CREATE OR REPLACE FUNCTION public.get_searchable_products(search_query TEXT DEFAULT '')
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    brand TEXT,
    description TEXT,
    base_price NUMERIC,
    gallery_images TEXT[],
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    item_type TEXT,
    variant_name TEXT,
    variant_id UUID,
    searchable_text TEXT
) AS $$
BEGIN
    IF search_query = '' OR search_query IS NULL THEN
        RETURN QUERY
        SELECT * FROM public.searchable_products 
        WHERE searchable_products.is_active = true;
    ELSE
        RETURN QUERY
        SELECT * FROM public.searchable_products 
        WHERE searchable_products.is_active = true 
        AND searchable_products.searchable_text ILIKE '%' || search_query || '%';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.refresh_searchable_products() TO service_role;

-- Revoke direct access to materialized view (access via function only)
REVOKE ALL ON public.searchable_products FROM authenticated;
REVOKE ALL ON public.searchable_products FROM anon;
REVOKE ALL ON public.searchable_products FROM public;

-- Initial refresh
REFRESH MATERIALIZED VIEW public.searchable_products;

COMMIT;

-- ============================================================================
-- FINAL SCHEMA SUMMARY
-- ============================================================================
-- 
-- products (14 columns):
--   id, name, slug, brand_id, description, short_description, origin,
--   specifications, is_active, meta_title, meta_description, canonical_url,
--   created_at, updated_at
--
-- product_variants (16 columns):
--   id, product_id, variant_name, variant_slug, variant_type, units_contained,
--   unit, images, image_alt_text, price, compare_at_price, cost_price, stock,
--   track_inventory, is_default, is_active, created_at, updated_at
--
-- brands (12 columns):
--   id, name, slug, description, logo_url, website_url, country_of_origin,
--   heritage, is_active, sort_order, meta_title, meta_description,
--   created_at, updated_at
--
-- combos (12 columns):
--   id, name, slug, description, combo_price, original_price, discount_percentage,
--   image, gallery_images, is_active, created_at, updated_at
--
-- combo_items (6 columns):
--   id, combo_id, variant_id, quantity, sort_order, created_at
--
-- DROPPED TABLES:
--   - product_seo_analytics
--   - product_reviews
--   - payment_verification_logs
--   - payment_verifications
--   - product_combos (renamed to combos)
--
-- DROPPED VIEWS:
--   - products_with_discounts
--   - variants_with_discounts
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 076_product_schema_cleanup completed successfully';
END $$;
