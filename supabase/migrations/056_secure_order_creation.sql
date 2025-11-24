-- Migration: 056_secure_order_creation.sql
-- Description: Implements secure server-side order creation to prevent frontend manipulation
-- Date: 2025-11-24

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.create_order(JSONB, JSONB, TEXT, TEXT, DECIMAL, UUID);

-- Create secure order creation function
CREATE OR REPLACE FUNCTION public.create_order(
    p_items JSONB,                  -- Array of { product_id, variant_id, combo_id, quantity }
    p_shipping_address JSONB,       -- { full_name, address, city, state, pincode, country, phone }
    p_shipping_method TEXT,         -- 'standard', 'express', 'priority'
    p_coupon_code TEXT DEFAULT NULL,
    p_lucky_discount DECIMAL DEFAULT 0, -- max 1.0
    p_user_id UUID DEFAULT auth.uid()
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
    v_usage_count INT;
    v_item_total DECIMAL(12,2);
    v_is_valid_coupon BOOLEAN := FALSE;
    v_applied_discount_id UUID;
    v_applied_discount_code TEXT;
    v_lucky_discount_actual DECIMAL(12,2);
BEGIN
    -- 1. Validate User
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not authenticated');
    END IF;

    -- 2. Calculate Subtotal and Validate Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Initialize variables
        v_product_price := 0;
        v_product_name := NULL;
        
        -- Handle Combo
        IF (v_item->>'combo_id') IS NOT NULL THEN
            SELECT name, combo_price, gallery_images[1]
            INTO v_combo_name, v_product_price, v_product_image
            FROM public.product_combos
            WHERE id = (v_item->>'combo_id')::UUID;
            
            v_product_name := v_combo_name;
            v_product_brand := 'Combo';
            
        -- Handle Variant
        ELSIF (v_item->>'variant_id') IS NOT NULL THEN
            SELECT p.name, p.brand, pv.price, pv.variant_name, 
                   COALESCE(vi.image_url, p.gallery_images[1])
            INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            LEFT JOIN public.variant_images vi ON vi.variant_id = pv.id AND vi.is_primary = true
            WHERE pv.id = (v_item->>'variant_id')::UUID;
            
        -- Handle Standard Product
        ELSE
            SELECT name, brand, price, gallery_images[1]
            INTO v_product_name, v_product_brand, v_product_price, v_product_image
            FROM public.products
            WHERE id = (v_item->>'product_id')::UUID;
        END IF;

        -- Check if item exists
        IF v_product_name IS NOT NULL THEN
            v_item_total := v_product_price * (v_item->>'quantity')::INT;
            v_subtotal := v_subtotal + v_item_total;
            
            -- Store enriched item for insertion
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

    -- 3. Calculate Shipping
    IF p_shipping_method = 'express' THEN
        v_shipping_cost := 99.00;
    ELSIF p_shipping_method = 'priority' THEN
        v_shipping_cost := 199.00;
    ELSE
        v_shipping_cost := 0.00; -- Standard
    END IF;

    -- 4. Validate and Apply Coupon
    IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
        SELECT * INTO v_discount_record
        FROM public.discounts
        WHERE code = lower(trim(p_coupon_code))
        AND is_active = true
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
        AND (usage_limit IS NULL OR usage_count < usage_limit);

        IF v_discount_record.id IS NOT NULL THEN
            -- Check minimum cart value
            IF v_discount_record.min_cart_value IS NULL OR v_subtotal >= v_discount_record.min_cart_value THEN
                -- Calculate discount amount
                IF v_discount_record.type = 'percentage' THEN
                    v_coupon_discount := (v_subtotal * v_discount_record.value) / 100;
                ELSIF v_discount_record.type = 'fixed_amount' THEN
                    v_coupon_discount := v_discount_record.value;
                ELSIF v_discount_record.type = 'cart_value' THEN
                    v_coupon_discount := v_discount_record.value;
                END IF;

                -- Apply max discount cap
                IF v_discount_record.max_discount_amount IS NOT NULL THEN
                    v_coupon_discount := LEAST(v_coupon_discount, v_discount_record.max_discount_amount);
                END IF;

                -- Ensure discount doesn't exceed subtotal
                v_coupon_discount := LEAST(v_coupon_discount, v_subtotal);
                
                v_is_valid_coupon := TRUE;
                v_applied_discount_id := v_discount_record.id;
                v_applied_discount_code := v_discount_record.code;
            END IF;
        END IF;
    END IF;

    -- 5. Apply Lucky Discount (Server-side clamped)
    v_lucky_discount_actual := LEAST(GREATEST(p_lucky_discount, 0.01), 0.99);
    v_discount_amount := v_coupon_discount + v_lucky_discount_actual;

    -- 6. Calculate Final Total
    v_total := v_subtotal + v_shipping_cost - v_discount_amount;
    v_total := GREATEST(v_total, 0); -- Ensure non-negative

    -- 7. Generate Unique 5-Digit Order ID (e.g. 12345)
    LOOP
        -- Generate random 5-digit number (10000 to 99999)
        v_display_order_id := (floor(random() * 90000 + 10000))::text;
        
        -- Check if it exists
        IF NOT EXISTS (SELECT 1 FROM public.orders WHERE display_order_id = v_display_order_id) THEN
            EXIT; -- Unique ID found
        END IF;
    END LOOP;

    -- 8. Insert Order
    INSERT INTO public.orders (
        user_id,
        display_order_id,
        status,
        subtotal,
        shipping,
        discount,
        discount_id,
        discount_code,
        discount_amount,
        tax,
        total,
        payment_method,
        shipping_name,
        shipping_address,
        shipping_city,
        shipping_state,
        shipping_zip_code,
        shipping_country,
        shipping_phone,
        shipping_method,
        estimated_delivery
    ) VALUES (
        p_user_id,
        v_display_order_id,
        'pending',
        v_subtotal,
        v_shipping_cost,
        v_discount_amount,
        v_applied_discount_id,
        v_applied_discount_code,
        v_coupon_discount,
        0, -- Tax handled in price usually
        v_total,
        'upi', -- Default, updated on payment
        p_shipping_address->>'full_name',
        p_shipping_address->>'address',
        p_shipping_address->>'city',
        p_shipping_address->>'state',
        p_shipping_address->>'pincode',
        COALESCE(p_shipping_address->>'country', 'India'),
        p_shipping_address->>'phone',
        p_shipping_method,
        NOW() + INTERVAL '7 days'
    ) RETURNING id INTO v_order_id;

    -- 9. Insert Order Items
    FOREACH v_item IN ARRAY v_valid_items
    LOOP
        INSERT INTO public.order_items (
            order_id,
            product_id,
            product_name,
            product_brand,
            product_price,
            product_image,
            quantity,
            variant_id,
            variant_name,
            combo_id,
            combo_name
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::UUID,
            v_item->>'product_name',
            v_item->>'product_brand',
            (v_item->>'product_price')::DECIMAL,
            v_item->>'product_image',
            (v_item->>'quantity')::INT,
            (v_item->>'variant_id')::UUID,
            v_item->>'variant_name',
            (v_item->>'combo_id')::UUID,
            v_item->>'combo_name'
        );
    END LOOP;

    -- 10. Increment Coupon Usage
    IF v_is_valid_coupon THEN
        UPDATE public.discounts 
        SET usage_count = usage_count + 1 
        WHERE id = v_applied_discount_id;
    END IF;

    -- 11. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'display_order_id', v_display_order_id,
        'total', v_total,
        'subtotal', v_subtotal,
        'discount', v_discount_amount,
        'message', 'Order created successfully'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_order TO authenticated;
