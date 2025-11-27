-- ============================================================================
-- Migration: 077_fix_create_order_schema_only.sql
-- Description: MINIMAL fix for create_order function - ONLY schema changes
--              - Fix product_combos -> combos table reference
--              - Fix p.gallery_images -> pv.images (dropped column)
--              - Fix p.brand -> b.name via brands table join
-- Date: 2024-11-28
-- ============================================================================

BEGIN;

-- Copy the EXACT original function and ONLY change schema references
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
                -- SCHEMA FIX: product_combos -> combos
                SELECT name, combo_price, gallery_images[1]
                INTO v_combo_name, v_product_price, v_product_image
                FROM public.combos
                WHERE id = (v_item->>'combo_id')::UUID;
                v_product_name := v_combo_name;
                v_product_brand := 'Combo';
            ELSIF (v_item->>'variant_id') IS NOT NULL THEN
                -- SCHEMA FIX: p.gallery_images -> pv.images, p.brand -> b.name
                SELECT p.name, b.name, pv.price, pv.variant_name, COALESCE(pv.images[1], '')
                INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image
                FROM public.product_variants pv
                JOIN public.products p ON p.id = pv.product_id
                LEFT JOIN public.brands b ON p.brand_id = b.id
                WHERE pv.id = (v_item->>'variant_id')::UUID;
            ELSE
                -- SCHEMA FIX: p.gallery_images -> pv.images, p.brand -> b.name
                SELECT p.name, b.name, pv.price, pv.images[1], p.id
                INTO v_product_name, v_product_brand, v_product_price, v_product_image
                FROM public.products p
                JOIN public.product_variants pv ON p.id = pv.product_id AND pv.is_default = true
                LEFT JOIN public.brands b ON p.brand_id = b.id
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

        IF array_length(v_valid_items, 1) = 0 THEN
            RETURN jsonb_build_object('success', false, 'message', 'No valid items found');
        END IF;

        -- 3. Calculate Shipping
        CASE p_shipping_method
            WHEN 'express' THEN v_shipping_cost := 99.00;
            WHEN 'priority' THEN v_shipping_cost := 199.00;
            ELSE v_shipping_cost := 0.00;
        END CASE;

        -- 4. Apply Coupon Discount
        IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
            SELECT * INTO v_discount_record 
            FROM public.discounts 
            WHERE code = p_coupon_code 
            AND is_active = true 
            AND (start_date IS NULL OR start_date <= NOW())
            AND (end_date IS NULL OR end_date >= NOW())
            AND (usage_limit IS NULL OR usage_count < usage_limit)
            AND (min_cart_value IS NULL OR v_subtotal >= min_cart_value);

            IF FOUND THEN
                v_is_valid_coupon := TRUE;
                v_applied_discount_id := v_discount_record.id;
                v_applied_discount_code := v_discount_record.code;
                
                IF v_discount_record.type = 'percentage' THEN
                    v_coupon_discount := LEAST(
                        (v_subtotal * v_discount_record.value / 100),
                        COALESCE(v_discount_record.max_discount_amount, v_subtotal)
                    );
                ELSIF v_discount_record.type = 'fixed' THEN
                    v_coupon_discount := LEAST(v_discount_record.value, v_subtotal);
                END IF;
            END IF;
        END IF;

        -- 5. Apply Lucky Discount
        v_lucky_discount_actual := LEAST(p_lucky_discount, v_subtotal);
        v_discount_amount := v_coupon_discount + v_lucky_discount_actual;

        -- 6. Calculate Final Total
        v_total := v_subtotal + v_shipping_cost - v_discount_amount;
        IF v_total < 0 THEN v_total := 0; END IF;
    END IF;

    -- 7. Generate Display Order ID (ORIGINAL LOGIC)
    LOOP
        v_display_order_id := (floor(random() * 90000 + 10000))::text;
        IF NOT EXISTS (SELECT 1 FROM public.orders WHERE display_order_id = v_display_order_id) THEN
            EXIT;
        END IF;
    END LOOP;

    -- 8. Generate Transaction ID (ORIGINAL LOGIC)
    v_transaction_id := 'TXN' || to_char(now(), 'YYYYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- 9. Insert Order (ORIGINAL LOGIC)
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

    -- 10. Insert Order Items (ORIGINAL LOGIC)
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

    -- 11. Generate UPI Deep Link
    v_upi_id := 'cigarro@paytm';
    v_upi_link := 'upi://pay?pa=' || v_upi_id || '&pn=Cigarro&am=' || v_total || '&cu=INR&tn=Order-' || v_transaction_id;

    RETURN jsonb_build_object(
        'success', true, 'order_id', v_order_id, 'display_order_id', v_display_order_id,
        'total', v_total, 'subtotal', v_subtotal, 'discount', v_discount_amount,
        'transaction_id', v_transaction_id, 'upi_deep_link', v_upi_link,
        'message', 'Order created successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Error creating order: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_order TO authenticated;

COMMIT;

-- ============================================================================
-- ONLY 3 SCHEMA CHANGES MADE:
-- 1. Line 66: product_combos -> combos
-- 2. Line 72: p.gallery_images -> pv.images, p.brand -> b.name + brands join  
-- 3. Line 79: p.gallery_images -> pv.images, p.brand -> b.name + brands join
-- Everything else is IDENTICAL to original migration 061
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 077 - MINIMAL schema fixes only';
END $$;
