-- ============================================================================
-- Migration: 077_fix_brand_references.sql
-- Description: Fix database functions that reference dropped products.brand column
--              Update to use brands.name via join instead
-- Date: 2024-11-28
-- ============================================================================

-- RUN THIS MIGRATION IN YOUR SUPABASE SQL EDITOR TO FIX THE "column brand does not exist" ERROR

BEGIN;

-- ============================================================================
-- SECTION 1: DROP FUNCTIONS THAT REFERENCE products.brand
-- ============================================================================

-- Drop the functions that reference the old brand column
DROP FUNCTION IF EXISTS public.validate_cart_items(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.process_order_items(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.get_product_details_for_order(UUID) CASCADE;

-- ============================================================================
-- SECTION 2: RECREATE validate_cart_items FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_cart_items(p_items JSONB)
RETURNS TABLE (
    item JSONB,
    product_name TEXT,
    product_brand TEXT,
    product_price NUMERIC,
    variant_name TEXT,
    product_image TEXT,
    is_valid BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_item JSONB;
    v_product_name TEXT;
    v_product_brand TEXT;
    v_product_price NUMERIC;
    v_variant_name TEXT;
    v_product_image TEXT;
    v_stock INTEGER;
    v_is_active BOOLEAN;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        IF (v_item->>'variant_id') IS NOT NULL THEN
            -- Get variant details with brand from brands table
            SELECT p.name, b.name, pv.price, pv.variant_name, COALESCE(pv.images[1], NULL), pv.stock, pv.is_active
            INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image, v_stock, v_is_active
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            LEFT JOIN public.brands b ON p.brand_id = b.id
            WHERE pv.id = (v_item->>'variant_id')::UUID;
            
            IF v_product_name IS NULL THEN
                RETURN QUERY SELECT v_item, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::TEXT, false, 'Variant not found';
                CONTINUE;
            END IF;
        ELSIF (v_item->>'combo_id') IS NOT NULL THEN
            -- Get combo details
            SELECT c.name, 'Combo', c.combo_price, NULL, c.image, 999999, c.is_active
            INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image, v_stock, v_is_active
            FROM public.combos c
            WHERE c.id = (v_item->>'combo_id')::UUID;
            
            IF v_product_name IS NULL THEN
                RETURN QUERY SELECT v_item, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::TEXT, false, 'Combo not found';
                CONTINUE;
            END IF;
        ELSE
            -- Product only (default variant) with brand from brands table
            SELECT p.name, b.name, dv.price, dv.variant_name, COALESCE(dv.images[1], NULL), dv.stock, p.is_active
            INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image, v_stock, v_is_active
            FROM public.products p
            LEFT JOIN public.product_variants dv ON dv.product_id = p.id AND dv.is_default = true
            LEFT JOIN public.brands b ON p.brand_id = b.id
            WHERE p.id = (v_item->>'product_id')::UUID;
            
            IF v_product_name IS NULL THEN
                RETURN QUERY SELECT v_item, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::TEXT, false, 'Product not found';
                CONTINUE;
            END IF;
        END IF;
        
        IF NOT v_is_active THEN
            RETURN QUERY SELECT v_item, v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image, false, 'Item is not active';
        ELSE
            RETURN QUERY SELECT v_item, v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image, true, NULL::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 3: DROP VIEWS THAT REFERENCE products.brand
-- ============================================================================

-- Drop views that reference the old brand column
DROP VIEW IF EXISTS public.products_with_discounts CASCADE;
DROP VIEW IF EXISTS public.variants_with_discounts CASCADE;

-- ============================================================================
-- SECTION 4: UPDATE searchable_products MATERIALIZED VIEW
-- ============================================================================

-- Drop and recreate the materialized view with correct brand reference
DROP MATERIALIZED VIEW IF EXISTS public.searchable_products CASCADE;

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
GRANT EXECUTE ON FUNCTION public.validate_cart_items(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_searchable_products(TEXT) TO anon;

-- Initial refresh
REFRESH MATERIALIZED VIEW public.searchable_products;

COMMIT;

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 077_fix_brand_references completed successfully';
END $$;
