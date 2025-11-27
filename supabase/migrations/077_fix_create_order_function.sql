-- ============================================================================
-- Migration: 077_fix_create_order_function.sql
-- Description: Fix create_order function to work with new schema after migration 076
--              - Update references to dropped gallery_images column
--              - Update references to product_combos -> combos table
--              - Use variant.images instead of gallery_images
-- Date: 2024-11-28
-- ============================================================================

BEGIN;

-- Update create_order function to work with new schema
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
                -- Updated: Use combos table instead of product_combos
                SELECT name, combo_price, COALESCE(gallery_images[1], image)
                INTO v_combo_name, v_product_price, v_product_image
                FROM public.combos
                WHERE id = (v_item->>'combo_id')::UUID;
                v_product_name := v_combo_name;
                v_product_brand := 'Combo';
            ELSIF (v_item->>'variant_id') IS NOT NULL THEN
                -- Updated: Use variant.images instead of product.gallery_images
                SELECT p.name, b.name, pv.price, pv.variant_name, pv.images[1]
                INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image
                FROM public.product_variants pv
                JOIN public.products p ON p.id = pv.product_id
                LEFT JOIN public.brands b ON p.brand_id = b.id
                WHERE pv.id = (v_item->>'variant_id')::UUID;
            ELSE
                -- Fallback for legacy calls using product_id (maps to default variant)
                -- Updated: Use variant.images and brands table
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
            ELSE v_shipping_cost := 0.00; -- Standard/Free
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

        -- 5. Apply Lucky Discount (Random small discount)
        v_lucky_discount_actual := LEAST(p_lucky_discount, v_subtotal);
        v_discount_amount := v_coupon_discount + v_lucky_discount_actual;

        -- 6. Calculate Final Total
        v_total := v_subtotal + v_shipping_cost - v_discount_amount;
        IF v_total < 0 THEN v_total := 0; END IF;
    END IF;

    -- 7. Generate Order ID and Transaction ID (using original logic)
    v_order_id := gen_random_uuid();
    
    -- Generate Display Order ID (original random 5-digit logic)
    LOOP
        v_display_order_id := (floor(random() * 90000 + 10000))::text;
        IF NOT EXISTS (SELECT 1 FROM public.orders WHERE display_order_id = v_display_order_id) THEN
            EXIT;
        END IF;
    END LOOP;
    
    -- Generate Transaction ID
    v_transaction_id := 'TXN' || (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT::TEXT;

    -- 8. Generate UPI Deep Link
    v_upi_id := 'cigarro@paytm';
    v_upi_link := 'upi://pay?pa=' || v_upi_id || 
                  '&pn=Cigarro&am=' || v_total::TEXT || 
                  '&tr=' || v_transaction_id || 
                  '&tn=Order%20' || v_display_order_id;

    -- 9. Insert Order
    INSERT INTO public.orders (
        id, display_order_id, user_id, status, subtotal, tax, shipping, 
        discount, total, payment_method, transaction_id, 
        shipping_name, shipping_address, shipping_city, shipping_state, 
        shipping_zip_code, shipping_country, shipping_phone, shipping_method,
        discount_id, discount_amount, discount_code, created_at
    ) VALUES (
        v_order_id, v_display_order_id, p_user_id, 'pending', v_subtotal, 0, v_shipping_cost,
        v_discount_amount, v_total, 'upi', v_transaction_id,
        p_shipping_address->>'full_name', p_shipping_address->>'address', 
        p_shipping_address->>'city', p_shipping_address->>'state',
        p_shipping_address->>'pincode', COALESCE(p_shipping_address->>'country', 'India'), 
        p_shipping_address->>'phone', p_shipping_method,
        v_applied_discount_id, v_coupon_discount, v_applied_discount_code, NOW()
    );

    -- 10. Insert Order Items (only for standard orders)
    IF NOT p_is_wallet_load THEN
        FOR i IN 1..array_length(v_valid_items, 1)
        LOOP
            INSERT INTO public.order_items (
                order_id, product_id, product_name, product_brand, 
                product_price, product_image, quantity, 
                variant_id, variant_name, combo_id, combo_name
            ) VALUES (
                v_order_id,
                (v_valid_items[i]->>'product_id')::UUID,
                v_valid_items[i]->>'product_name',
                v_valid_items[i]->>'product_brand',
                (v_valid_items[i]->>'product_price')::DECIMAL,
                v_valid_items[i]->>'product_image',
                (v_valid_items[i]->>'quantity')::INT,
                (v_valid_items[i]->>'variant_id')::UUID,
                v_valid_items[i]->>'variant_name',
                (v_valid_items[i]->>'combo_id')::UUID,
                v_valid_items[i]->>'combo_name'
            );
        END LOOP;
    END IF;

    -- 11. Update Coupon Usage Count
    IF v_is_valid_coupon THEN
        UPDATE public.discounts 
        SET usage_count = COALESCE(usage_count, 0) + 1 
        WHERE id = v_applied_discount_id;
    END IF;

    -- 12. Return Success Response
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'display_order_id', v_display_order_id,
        'transaction_id', v_transaction_id,
        'upi_deep_link', v_upi_link,
        'subtotal', v_subtotal,
        'shipping', v_shipping_cost,
        'discount', v_discount_amount,
        'total', v_total,
        'order_type', v_order_type,
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

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.create_order TO authenticated;

COMMIT;

-- ============================================================================
-- SUMMARY OF CHANGES:
-- 1. Updated combo queries to use 'combos' table instead of 'product_combos'
-- 2. Removed references to dropped 'gallery_images' column from products
-- 3. Updated to use 'variant.images' column for product images
-- 4. Added proper brand lookup using 'brands' table via 'brand_id'
-- 5. Fixed all image references to use new schema structure
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 077_fix_create_order_function completed successfully';
END $$;
