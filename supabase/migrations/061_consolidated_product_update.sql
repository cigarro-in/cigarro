-- ============================================================================
-- Migration: 061_consolidated_product_update.sql
-- Description: Consolidated migration for Product Management System Update & Wallet Flow
--              Merges migrations 061-075 into a single coherent update.
--              Includes:
--              1. Wallet Flow Improvements (Orders schema update)
--              2. Implicit Variant Model (Schema changes, column drops)
--              3. Variant Images System (Array-based images)
--              4. Function & Trigger Cleanups (Removing price column dependencies)
-- Date: 2024-11-27
-- ============================================================================

-- ============================================================================
-- SECTION 1: PRE-CLEANUP (Remove obsolete triggers/functions/views)
-- ============================================================================

-- Drop triggers that might reference columns we are about to drop
DROP TRIGGER IF EXISTS trigger_sync_product_price ON public.product_variants;
DROP TRIGGER IF EXISTS trigger_update_product_seo_score ON public.products;
DROP TRIGGER IF EXISTS trigger_auto_fill_product_seo ON public.products;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;

-- Drop functions that referenced removed columns
DROP FUNCTION IF EXISTS public.sync_product_price_from_variant();

-- Drop views that depend on products.price or other columns to be removed
DROP MATERIALIZED VIEW IF EXISTS searchable_products CASCADE;
DROP VIEW IF EXISTS products_with_discounts CASCADE;
DROP VIEW IF EXISTS variants_with_discounts CASCADE;

-- ============================================================================
-- SECTION 2: SCHEMA UPDATES (Tables)
-- ============================================================================

-- 2.1 Update Orders Table (Wallet Flow Support)
ALTER TABLE public.orders
    ALTER COLUMN shipping_address DROP NOT NULL,
    ALTER COLUMN shipping_city DROP NOT NULL,
    ALTER COLUMN shipping_state DROP NOT NULL,
    ALTER COLUMN shipping_zip_code DROP NOT NULL,
    ALTER COLUMN shipping_name DROP NOT NULL,
    ALTER COLUMN shipping_phone DROP NOT NULL;

ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'standard' CHECK (order_type IN ('standard', 'wallet_load'));

-- 2.2 Update Product Variants Table (Implicit Variant Model)
ALTER TABLE public.product_variants 
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.product_variants.is_default IS 'Marks the default/primary variant for a product.';
COMMENT ON COLUMN public.product_variants.images IS 'Array of image URLs. Default variant images serve as main product images.';

CREATE INDEX IF NOT EXISTS idx_product_variants_default 
    ON public.product_variants(product_id, is_default) 
    WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_product_variants_has_images 
    ON public.product_variants(id) 
    WHERE images IS NOT NULL AND array_length(images, 1) > 0;

-- 2.3 Migrate Data (Set Defaults & Move Images)
-- Set default variants
WITH first_variants AS (
    SELECT DISTINCT ON (product_id) id
    FROM product_variants
    ORDER BY product_id, sort_order ASC, created_at ASC
)
UPDATE product_variants 
SET is_default = true 
WHERE id IN (SELECT id FROM first_variants);

-- Migrate images from variant_images table (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'variant_images') THEN
        -- Migrate variant-specific images
        UPDATE product_variants pv
        SET images = COALESCE(
            (
                SELECT ARRAY_AGG(vi.image_url ORDER BY vi.sort_order ASC, vi.created_at ASC)
                FROM variant_images vi
                WHERE vi.variant_id = pv.id
            ),
            pv.images,
            '{}'
        )
        WHERE EXISTS (SELECT 1 FROM variant_images vi WHERE vi.variant_id = pv.id);

        -- For product-level images, add them to the default variant
        UPDATE product_variants pv
        SET images = COALESCE(
            (
                SELECT ARRAY_AGG(vi.image_url ORDER BY vi.sort_order ASC, vi.created_at ASC)
                FROM variant_images vi
                WHERE vi.product_id = pv.product_id AND vi.variant_id IS NULL
            ),
            pv.images,
            '{}'
        )
        WHERE pv.is_default = true
        AND EXISTS (
            SELECT 1 FROM variant_images vi 
            WHERE vi.product_id = pv.product_id AND vi.variant_id IS NULL
        )
        AND (pv.images IS NULL OR array_length(pv.images, 1) IS NULL);
    END IF;
END $$;

-- 2.4 Drop Redundant Tables & Columns
DROP TABLE IF EXISTS public.variant_images;

ALTER TABLE public.products 
    DROP COLUMN IF EXISTS price,
    DROP COLUMN IF EXISTS stock,
    DROP COLUMN IF EXISTS compare_at_price,
    DROP COLUMN IF EXISTS cost_price,
    DROP COLUMN IF EXISTS track_inventory,
    DROP COLUMN IF EXISTS pack_size;

-- ============================================================================
-- SECTION 3: FUNCTIONS RECREATION
-- ============================================================================

-- 3.1 Create Order Function (Wallet Support)
CREATE OR REPLACE FUNCTION public.create_order(
    p_items JSONB,                  
    p_shipping_address JSONB,       
    p_shipping_method TEXT,         
    p_coupon_code TEXT DEFAULT NULL,
    p_lucky_discount DECIMAL DEFAULT 0, 
    p_user_id UUID DEFAULT auth.uid(),
    p_is_wallet_load BOOLEAN DEFAULT FALSE,
    p_custom_amount DECIMAL DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_display_order_id TEXT;
    v_subtotal DECIMAL(12,2) := 0;
    v_shipping_cost DECIMAL(12,2) := 0;
    v_discount_amount DECIMAL(12,2) := 0;
    v_coupon_discount DECIMAL(12,2) := 0;
    v_total DECIMAL(12,2);
    v_item JSONB;
    v_product_price DECIMAL(12,2);
    v_product_name TEXT;
    v_product_brand TEXT;
    v_product_image TEXT;
    v_variant_name TEXT;
    v_combo_name TEXT;
    v_valid_items JSONB[] := ARRAY[]::JSONB[];
    v_discount_record RECORD;
    v_item_total DECIMAL(12,2);
    v_is_valid_coupon BOOLEAN := FALSE;
    v_applied_discount_id UUID;
    v_applied_discount_code TEXT;
    v_lucky_discount_actual DECIMAL(12,2);
    v_transaction_id TEXT;
    v_upi_link TEXT;
    v_upi_id TEXT;
    v_order_type TEXT := 'standard';
BEGIN
    -- 1. Validate User
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not authenticated');
    END IF;

    -- 2. Handle Wallet Load vs Standard Order
    IF p_is_wallet_load THEN
        v_order_type := 'wallet_load';
        
        IF p_custom_amount IS NULL OR p_custom_amount < 1 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Invalid wallet load amount');
        END IF;
        
        v_subtotal := p_custom_amount;
        v_total := p_custom_amount;
        v_shipping_cost := 0;
        v_discount_amount := 0;
    ELSE
        -- STANDARD ORDER LOGIC
        IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
             RETURN jsonb_build_object('success', false, 'message', 'No items provided');
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_product_price := 0;
            v_product_name := NULL;
            
            IF (v_item->>'combo_id') IS NOT NULL THEN
                SELECT name, combo_price, gallery_images[1]
                INTO v_combo_name, v_product_price, v_product_image
                FROM public.product_combos
                WHERE id = (v_item->>'combo_id')::UUID;
                v_product_name := v_combo_name;
                v_product_brand := 'Combo';
            ELSIF (v_item->>'variant_id') IS NOT NULL THEN
                SELECT p.name, p.brand, pv.price, pv.variant_name, COALESCE(pv.images[1], p.gallery_images[1])
                INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image
                FROM public.product_variants pv
                JOIN public.products p ON p.id = pv.product_id
                WHERE pv.id = (v_item->>'variant_id')::UUID;
            ELSE
                -- Fallback for legacy calls using product_id (maps to default variant)
                SELECT p.name, p.brand, pv.price, p.gallery_images[1], p.id
                INTO v_product_name, v_product_brand, v_product_price, v_product_image
                FROM public.products p
                JOIN public.product_variants pv ON p.id = pv.product_id AND pv.is_default = true
                WHERE p.id = (v_item->>'product_id')::UUID;
            END IF;

            IF v_product_name IS NOT NULL THEN
                v_item_total := v_product_price * (v_item->>'quantity')::INT;
                v_subtotal := v_subtotal + v_item_total;
                v_valid_items := array_append(v_valid_items, jsonb_build_object(
                    'product_id', (v_item->>'product_id')::UUID,
                    'product_name', v_product_name,
                    'product_brand', COALESCE(v_product_brand, 'Premium'),
                    'product_price', v_product_price,
                    'product_image', COALESCE(v_product_image, ''),
                    'quantity', (v_item->>'quantity')::INT,
                    'variant_id', (v_item->>'variant_id')::UUID,
                    'variant_name', v_variant_name,
                    'combo_id', (v_item->>'combo_id')::UUID,
                    'combo_name', v_combo_name
                ));
            END IF;
        END LOOP;

        IF array_length(v_valid_items, 1) IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'No valid items found');
        END IF;

        -- Calculate Shipping
        IF p_shipping_method = 'express' THEN
            v_shipping_cost := 99.00;
        ELSIF p_shipping_method = 'priority' THEN
            v_shipping_cost := 199.00;
        ELSE
            v_shipping_cost := 0.00;
        END IF;

        -- Validate and Apply Coupon
        IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
            SELECT * INTO v_discount_record
            FROM public.discounts
            WHERE code = lower(trim(p_coupon_code))
            AND is_active = true
            AND (start_date IS NULL OR start_date <= NOW())
            AND (end_date IS NULL OR end_date >= NOW())
            AND (usage_limit IS NULL OR usage_count < usage_limit);

            IF v_discount_record.id IS NOT NULL THEN
                IF v_discount_record.min_cart_value IS NULL OR v_subtotal >= v_discount_record.min_cart_value THEN
                    IF v_discount_record.type = 'percentage' THEN
                        v_coupon_discount := (v_subtotal * v_discount_record.value) / 100;
                    ELSIF v_discount_record.type = 'fixed_amount' THEN
                        v_coupon_discount := v_discount_record.value;
                    ELSIF v_discount_record.type = 'cart_value' THEN
                        v_coupon_discount := v_discount_record.value;
                    END IF;

                    IF v_discount_record.max_discount_amount IS NOT NULL THEN
                        v_coupon_discount := LEAST(v_coupon_discount, v_discount_record.max_discount_amount);
                    END IF;
                    v_coupon_discount := LEAST(v_coupon_discount, v_subtotal);
                    v_is_valid_coupon := TRUE;
                    v_applied_discount_id := v_discount_record.id;
                    v_applied_discount_code := v_discount_record.code;
                END IF;
            END IF;
        END IF;

        -- Apply Lucky Discount
        v_lucky_discount_actual := LEAST(GREATEST(p_lucky_discount, 0.01), 0.99);
        v_discount_amount := v_coupon_discount + v_lucky_discount_actual;

        -- Calculate Final Total
        v_total := v_subtotal + v_shipping_cost - v_discount_amount;
        v_total := GREATEST(v_total, 0);
    END IF;

    -- Generate Display Order ID
    LOOP
        v_display_order_id := (floor(random() * 90000 + 10000))::text;
        IF NOT EXISTS (SELECT 1 FROM public.orders WHERE display_order_id = v_display_order_id) THEN
            EXIT;
        END IF;
    END LOOP;

    -- Generate Transaction ID
    v_transaction_id := 'TXN' || to_char(now(), 'YYYYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- Insert Order
    INSERT INTO public.orders (
        user_id, display_order_id, status, subtotal, shipping, discount,
        discount_id, discount_code, discount_amount, tax, total,
        payment_method, shipping_name, shipping_address, shipping_city,
        shipping_state, shipping_zip_code, shipping_country, shipping_phone,
        shipping_method, estimated_delivery, transaction_id, order_type
    ) VALUES (
        p_user_id, v_display_order_id, 'pending', v_subtotal, v_shipping_cost, v_discount_amount,
        v_applied_discount_id, v_applied_discount_code, v_coupon_discount, 0, v_total,
        'upi', 
        CASE WHEN p_is_wallet_load THEN NULL ELSE p_shipping_address->>'full_name' END,
        CASE WHEN p_is_wallet_load THEN NULL ELSE p_shipping_address->>'address' END,
        CASE WHEN p_is_wallet_load THEN NULL ELSE p_shipping_address->>'city' END,
        CASE WHEN p_is_wallet_load THEN NULL ELSE p_shipping_address->>'state' END,
        CASE WHEN p_is_wallet_load THEN NULL ELSE p_shipping_address->>'pincode' END,
        CASE WHEN p_is_wallet_load THEN NULL ELSE COALESCE(p_shipping_address->>'country', 'India') END,
        CASE WHEN p_is_wallet_load THEN NULL ELSE p_shipping_address->>'phone' END,
        CASE WHEN p_is_wallet_load THEN NULL ELSE p_shipping_method END,
        CASE WHEN p_is_wallet_load THEN NULL ELSE NOW() + INTERVAL '7 days' END,
        v_transaction_id,
        v_order_type
    ) RETURNING id INTO v_order_id;

    -- Insert Order Items
    IF NOT p_is_wallet_load THEN
        FOREACH v_item IN ARRAY v_valid_items
        LOOP
            INSERT INTO public.order_items (
                order_id, product_id, product_name, product_brand, product_price,
                product_image, quantity, variant_id, variant_name, combo_id, combo_name
            ) VALUES (
                v_order_id, (v_item->>'product_id')::UUID, v_item->>'product_name', v_item->>'product_brand',
                (v_item->>'product_price')::DECIMAL, v_item->>'product_image', (v_item->>'quantity')::INT,
                (v_item->>'variant_id')::UUID, v_item->>'variant_name', (v_item->>'combo_id')::UUID, v_item->>'combo_name'
            );
        END LOOP;

        IF v_is_valid_coupon THEN
            UPDATE public.discounts SET usage_count = usage_count + 1 WHERE id = v_applied_discount_id;
        END IF;
    END IF;

    -- Insert Pending Transaction
    INSERT INTO public.transactions (
        user_id, order_id, amount, type, direction, status, internal_transaction_id, description, created_at
    ) VALUES (
        p_user_id, v_order_id, v_total,
        CASE WHEN p_is_wallet_load THEN 'wallet_load_upi' ELSE 'wallet_payment' END,
        CASE WHEN p_is_wallet_load THEN 'credit' ELSE 'debit' END,
        'pending', v_transaction_id,
        CASE WHEN p_is_wallet_load THEN 'Wallet Load via UPI' ELSE 'Order Payment via UPI' END,
        NOW()
    );

    -- Generate UPI Link
    SELECT upi_id INTO v_upi_id FROM public.site_settings LIMIT 1;
    IF v_upi_id IS NULL OR length(v_upi_id) = 0 THEN
        v_upi_id := 'hrejuh@upi'; 
    END IF;
    v_upi_link := 'upi://pay?pa=' || v_upi_id || '&pn=Cigarro&am=' || v_total || '&cu=INR&tn=Order-' || v_transaction_id;

    RETURN jsonb_build_object(
        'success', true, 'order_id', v_order_id, 'display_order_id', v_display_order_id,
        'total', v_total, 'subtotal', v_subtotal, 'discount', v_discount_amount,
        'transaction_id', v_transaction_id, 'upi_deep_link', v_upi_link,
        'message', 'Order created successfully'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_order TO authenticated;

-- 3.2 Validate Cart Items Function
CREATE OR REPLACE FUNCTION public.validate_cart_items(p_items JSONB)
RETURNS TABLE(
    item JSONB, product_name TEXT, product_brand TEXT, product_price NUMERIC,
    variant_name TEXT, product_image TEXT, is_valid BOOLEAN, error_message TEXT
) AS $$
DECLARE
    v_item JSONB;
    v_product_name TEXT; v_product_brand TEXT; v_product_price NUMERIC;
    v_variant_name TEXT; v_product_image TEXT; v_stock INTEGER; v_is_active BOOLEAN;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        IF (v_item->>'variant_id') IS NOT NULL THEN
            SELECT p.name, p.brand, pv.price, pv.variant_name, COALESCE(pv.images[1], p.gallery_images[1]), pv.stock, pv.is_active
            INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image, v_stock, v_is_active
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = (v_item->>'variant_id')::UUID;
            
            IF v_product_name IS NULL THEN
                RETURN QUERY SELECT v_item, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::TEXT, false, 'Variant not found';
                CONTINUE;
            END IF;
        ELSIF (v_item->>'combo_id') IS NOT NULL THEN
            SELECT pc.name, 'Combo', pc.combo_price, NULL, pc.gallery_images[1], 999999, pc.is_active
            INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image, v_stock, v_is_active
            FROM public.product_combos pc
            WHERE pc.id = (v_item->>'combo_id')::UUID;
            
            IF v_product_name IS NULL THEN
                RETURN QUERY SELECT v_item, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::TEXT, false, 'Combo not found';
                CONTINUE;
            END IF;
        ELSE
            -- Product only (default variant)
            SELECT p.name, p.brand, dv.price, dv.variant_name, COALESCE(dv.images[1], p.gallery_images[1]), dv.stock, p.is_active
            INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image, v_stock, v_is_active
            FROM public.products p
            LEFT JOIN public.product_variants dv ON dv.product_id = p.id AND dv.is_default = true
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

-- 3.3 Helper Functions
CREATE OR REPLACE FUNCTION calculate_discount_percentage(price numeric, compare_at_price numeric)
RETURNS integer AS $$
BEGIN
    IF compare_at_price IS NULL OR compare_at_price <= price OR price <= 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND(((compare_at_price - price) / compare_at_price) * 100)::integer;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_profit_margin(price numeric, cost_price numeric)
RETURNS numeric AS $$
BEGIN
    IF cost_price IS NULL OR cost_price <= 0 OR price <= 0 THEN
        RETURN NULL;
    END IF;
    RETURN ROUND(((price - cost_price) / price) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3.4 Updated SEO Functions (Removed price dependency)
CREATE OR REPLACE FUNCTION public.auto_fill_product_seo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN NEW.slug := public.generate_slug(NEW.name); END IF;
  IF NEW.meta_title IS NULL OR NEW.meta_title = '' THEN NEW.meta_title := NEW.name || ' | ' || COALESCE(NEW.brand,''); END IF;
  IF NEW.meta_description IS NULL OR NEW.meta_description = '' THEN NEW.meta_description := 'Buy ' || NEW.name || COALESCE(' from ' || NEW.brand, '') || '.'; END IF;
  IF NEW.canonical_url IS NULL OR NEW.canonical_url = '' THEN NEW.canonical_url := 'https://cigarro.in/product/' || NEW.slug; END IF;
  IF NEW.og_title IS NULL OR NEW.og_title = '' THEN NEW.og_title := NEW.meta_title; END IF;
  IF NEW.og_description IS NULL OR NEW.og_description = '' THEN NEW.og_description := NEW.meta_description; END IF;
  IF NEW.twitter_title IS NULL OR NEW.twitter_title = '' THEN NEW.twitter_title := NEW.meta_title; END IF;
  IF NEW.twitter_description IS NULL OR NEW.twitter_description = '' THEN NEW.twitter_description := NEW.meta_description; END IF;
  RETURN NEW;
END; 
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_product_seo_score()
RETURNS TRIGGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  score := 10; -- Base score
  IF length(NEW.name) >= 5 THEN score := score + 15; END IF;
  IF NEW.description IS NOT NULL AND length(NEW.description) > 20 THEN score := score + 15; END IF;
  IF NEW.gallery_images IS NOT NULL AND array_length(NEW.gallery_images, 1) > 0 THEN score := score + 20; END IF;
  IF NEW.meta_title IS NOT NULL AND length(NEW.meta_title) > 0 THEN score := score + 10; END IF;
  IF NEW.meta_description IS NOT NULL AND length(NEW.meta_description) > 0 THEN score := score + 10; END IF;
  IF NEW.brand IS NOT NULL OR NEW.brand_id IS NOT NULL THEN score := score + 10; END IF;
  IF NEW.meta_keywords IS NOT NULL AND length(NEW.meta_keywords) > 0 THEN score := score + 10; END IF;
  IF score > 100 THEN score := 100; END IF;
  NEW.seo_score := score;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 4: TRIGGERS RECREATION
-- ============================================================================

CREATE TRIGGER trigger_auto_fill_product_seo
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_product_seo();

CREATE TRIGGER trigger_update_product_seo_score
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_product_seo_score();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 5: VIEWS RECREATION
-- ============================================================================

CREATE OR REPLACE VIEW variants_with_discounts AS
SELECT 
    v.id, v.product_id, v.variant_name, v.variant_type, v.price, v.weight, v.dimensions,
    v.is_active, v.sort_order, v.created_at, v.updated_at, v.variant_slug,
    v.meta_title, v.meta_description, v.meta_keywords, v.og_title, v.og_description,
    v.structured_data, v.stock, v.attributes, v.compare_at_price, v.cost_price,
    v.track_inventory, v.packaging, v.units_contained, v.images, v.is_default,
    calculate_discount_percentage(v.price, v.compare_at_price) AS discount_percentage,
    calculate_profit_margin(v.price, v.cost_price) AS profit_margin,
    CASE WHEN v.compare_at_price IS NOT NULL AND v.compare_at_price > v.price THEN v.compare_at_price - v.price ELSE 0 END AS savings_amount,
    p.name AS product_name, p.brand AS product_brand, p.brand_id AS product_brand_id
FROM product_variants v
JOIN products p ON v.product_id = p.id;

CREATE OR REPLACE VIEW products_with_discounts AS
SELECT 
    p.id, p.name, p.slug, p.brand, p.description, p.is_active, p.rating, p.review_count,
    p.origin, p.specifications, p.gallery_images, p.image_alt_text, p.meta_title,
    p.meta_description, p.created_at, p.updated_at, p.image_url, p.is_featured,
    p.is_showcase, p.showcase_order, p.featured_order, p.meta_keywords, p.canonical_url,
    p.og_title, p.og_description, p.og_image, p.twitter_title, p.twitter_description,
    p.twitter_image, p.structured_data, p.seo_score, p.brand_id, p.short_description,
    p.continue_selling_when_out_of_stock,
    dv.id AS default_variant_id, dv.variant_name AS default_variant_name, dv.price,
    dv.stock, dv.compare_at_price, dv.cost_price, dv.track_inventory, dv.packaging,
    dv.units_contained,
    calculate_discount_percentage(dv.price, dv.compare_at_price) AS discount_percentage,
    calculate_profit_margin(dv.price, dv.cost_price) AS profit_margin,
    CASE WHEN dv.compare_at_price IS NOT NULL AND dv.compare_at_price > dv.price THEN dv.compare_at_price - dv.price ELSE 0 END AS savings_amount,
    b.name AS brand_name, b.logo_url AS brand_logo
FROM products p
LEFT JOIN product_variants dv ON p.id = dv.product_id AND dv.is_default = true
LEFT JOIN brands b ON p.brand_id = b.id;

CREATE MATERIALIZED VIEW searchable_products AS
SELECT 
    p.id, p.name, p.slug, p.brand, p.description, dv.price AS base_price, p.gallery_images,
    p.rating, p.review_count, p.is_active, p.created_at, 'product'::text AS item_type,
    dv.id AS variant_id, dv.variant_name, dv.price AS variant_price,
    NULL::uuid AS combo_id, NULL::character varying AS combo_name, NULL::numeric AS combo_price,
    concat_ws(' ', p.name, p.brand, COALESCE(p.description, '')) AS searchable_text
FROM products p
LEFT JOIN product_variants dv ON p.id = dv.product_id AND dv.is_default = true
WHERE p.is_active = true
UNION ALL
SELECT 
    p.id, p.name, p.slug, p.brand, p.description, dv.price AS base_price, p.gallery_images,
    p.rating, p.review_count, p.is_active, p.created_at, 'variant'::text AS item_type,
    pv.id AS variant_id, pv.variant_name, pv.price AS variant_price,
    NULL::uuid AS combo_id, NULL::character varying AS combo_name, NULL::numeric AS combo_price,
    concat_ws(' ', p.name, p.brand, COALESCE(p.description, ''), pv.variant_name) AS searchable_text
FROM products p
JOIN product_variants pv ON p.id = pv.product_id
LEFT JOIN product_variants dv ON p.id = dv.product_id AND dv.is_default = true
WHERE p.is_active = true AND pv.is_active = true AND pv.is_default = false
UNION ALL
SELECT 
    pc.id, pc.name, pc.slug, 'Combo'::text AS brand, pc.description, pc.combo_price AS base_price,
    pc.gallery_images, 0 AS rating, 0 AS review_count, pc.is_active, pc.created_at,
    'combo'::text AS item_type, NULL::uuid AS variant_id, NULL::character varying AS variant_name,
    NULL::numeric AS variant_price, pc.id AS combo_id, pc.name AS combo_name, pc.combo_price,
    concat_ws(' ', pc.name, COALESCE(pc.description, ''), 'combo pack bundle special offer deal') AS searchable_text
FROM product_combos pc
WHERE pc.is_active = true;

CREATE INDEX IF NOT EXISTS idx_searchable_products_text ON searchable_products USING gin(to_tsvector('english', searchable_text));
CREATE INDEX IF NOT EXISTS idx_searchable_products_type ON searchable_products(item_type);
CREATE INDEX IF NOT EXISTS idx_searchable_products_id ON searchable_products(id);

CREATE OR REPLACE FUNCTION refresh_searchable_products()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY searchable_products;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 6: PERMISSIONS
-- ============================================================================

GRANT SELECT ON products_with_discounts TO authenticated, anon;
GRANT SELECT ON variants_with_discounts TO authenticated, anon;
GRANT SELECT ON searchable_products TO authenticated, anon;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 061_consolidated_product_update completed successfully';
END $$;
