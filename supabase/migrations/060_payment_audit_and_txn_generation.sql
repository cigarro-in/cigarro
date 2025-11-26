-- Migration: 060_payment_audit_and_txn_generation.sql
-- Description: Updates site_settings to UUID, adds UPI ID, payment audit trail, 
--              and secure server-side transaction ID/UPI generation
-- Date: 2025-11-26

-- =====================================================
-- PART 1: UPDATE SITE_SETTINGS TABLE
-- Convert ID to UUID and add UPI ID column
-- =====================================================

-- Drop the single_row constraint if it exists
ALTER TABLE public.site_settings DROP CONSTRAINT IF EXISTS single_row;

-- Convert id from INT to UUID (preserve existing data)
DO $$
BEGIN
    -- Check if id is already UUID type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'site_settings' 
        AND column_name = 'id' 
        AND data_type = 'integer'
    ) THEN
        -- Add a temporary UUID column
        ALTER TABLE public.site_settings ADD COLUMN id_new UUID DEFAULT gen_random_uuid();
        
        -- Update the new column with a UUID for existing row
        UPDATE public.site_settings SET id_new = gen_random_uuid() WHERE id_new IS NULL;
        
        -- Drop the old id column and rename the new one
        ALTER TABLE public.site_settings DROP COLUMN id CASCADE;
        ALTER TABLE public.site_settings RENAME COLUMN id_new TO id;
        
        -- Set the new id as primary key
        ALTER TABLE public.site_settings ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Add new columns if they don't exist
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS upi_id TEXT DEFAULT 'hrejuh@upi';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Update existing row to have upi_id if null
UPDATE public.site_settings SET upi_id = 'hrejuh@upi' WHERE upi_id IS NULL OR upi_id = '';

-- Enable RLS if not already enabled
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Allow authenticated users to read site settings" ON public.site_settings;
CREATE POLICY "Allow authenticated users to read site settings" 
    ON public.site_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow service_role to read site settings" ON public.site_settings;
CREATE POLICY "Allow service_role to read site settings" 
    ON public.site_settings FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Allow admins to update site settings" ON public.site_settings;
CREATE POLICY "Allow admins to update site settings" 
    ON public.site_settings FOR UPDATE TO authenticated 
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
    );

-- =====================================================
-- PART 2: CREATE WALLET CREDIT VIRTUAL PRODUCT
-- Used for wallet load orders
-- =====================================================

-- Insert virtual product for wallet loads
INSERT INTO public.products (
    id, 
    name, 
    brand, 
    price, 
    description, 
    is_active,
    is_featured,
    stock,
    slug,
    created_at
)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'Wallet Credit',
    'Cigarro',
    0.00, -- Price is dynamic based on load amount
    'Add money to your Cigarro wallet for faster checkout',
    true,
    false,
    999999, -- Always in stock
    'wallet-credit',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- =====================================================
-- PART 3: PAYMENT AUDIT TRAIL
-- =====================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS raw_payment_message text;

-- =====================================================
-- PART 4: UPDATE VERIFICATION FUNCTION
-- Accepts raw email message for audit trail
-- =====================================================

-- Drop existing function to avoid ambiguity
DROP FUNCTION IF EXISTS public.verify_order_payment(TEXT, DECIMAL, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION verify_order_payment(
    p_transaction_id TEXT,
    p_amount DECIMAL(12,2),
    p_bank_name TEXT DEFAULT NULL,
    p_upi_reference TEXT DEFAULT NULL,
    p_verification_method TEXT DEFAULT 'email_parse',
    p_email_verification_id UUID DEFAULT NULL,
    p_raw_message TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_transaction RECORD;
    v_order_id UUID;
    v_user_id UUID;
BEGIN
    -- Find transaction by internal_transaction_id
    SELECT * INTO v_transaction
    FROM public.transactions
    WHERE internal_transaction_id = p_transaction_id
    AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_transaction.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'transaction_not_found',
            'message', 'No pending transaction found with ID: ' || p_transaction_id
        );
    END IF;
    
    -- Validate amount matches
    IF v_transaction.amount != p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'amount_mismatch',
            'message', 'Payment amount does not match transaction',
            'expected', v_transaction.amount,
            'received', p_amount
        );
    END IF;
    
    v_order_id := v_transaction.order_id;
    v_user_id := v_transaction.user_id;
    
    -- Update transaction to completed
    UPDATE public.transactions
    SET status = 'completed',
        verified = true,
        verified_at = NOW(),
        verification_method = p_verification_method,
        bank_name = p_bank_name,
        upi_reference = p_upi_reference,
        email_verification_id = p_email_verification_id,
        raw_payment_message = p_raw_message,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_transaction.id;
    
    -- Update order status
    UPDATE public.orders
    SET payment_verified = 'YES',
        payment_confirmed = true,
        payment_confirmed_at = NOW(),
        payment_verified_at = NOW(),
        status = 'processing',
        updated_at = NOW()
    WHERE id = v_order_id;
    
    RAISE NOTICE 'Payment verified for transaction: % order: %', p_transaction_id, v_order_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction.id,
        'order_id', v_order_id,
        'user_id', v_user_id,
        'amount', p_amount,
        'message', 'Payment verified successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'verification_error',
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 4: SECURE ORDER CREATION
-- Generates TXN ID and UPI Link on server using Settings
-- =====================================================

-- Drop existing function to avoid ambiguity
DROP FUNCTION IF EXISTS public.create_order(JSONB, JSONB, TEXT, TEXT, DECIMAL, UUID);

CREATE OR REPLACE FUNCTION public.create_order(
    p_items JSONB,                  
    p_shipping_address JSONB,       
    p_shipping_method TEXT,         
    p_coupon_code TEXT DEFAULT NULL,
    p_lucky_discount DECIMAL DEFAULT 0, 
    p_user_id UUID DEFAULT auth.uid(),
    p_is_wallet_load BOOLEAN DEFAULT FALSE
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
    v_is_wallet_credit BOOLEAN := FALSE;
BEGIN
    -- 1. Validate User
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not authenticated');
    END IF;

    -- 2. Calculate Subtotal and Validate Items
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
            SELECT p.name, p.brand, pv.price, pv.variant_name, COALESCE(vi.image_url, p.gallery_images[1])
            INTO v_product_name, v_product_brand, v_product_price, v_variant_name, v_product_image
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            LEFT JOIN public.variant_images vi ON vi.variant_id = pv.id AND vi.is_primary = true
            WHERE pv.id = (v_item->>'variant_id')::UUID;
        ELSE
            SELECT name, brand, price, gallery_images[1], id
            INTO v_product_name, v_product_brand, v_product_price, v_product_image
            FROM public.products
            WHERE id = (v_item->>'product_id')::UUID;
            
            -- Check if this is the wallet credit product
            IF (v_item->>'product_id')::UUID = '00000000-0000-0000-0000-000000000001'::UUID THEN
                v_is_wallet_credit := TRUE;
                -- For wallet credit, use the custom amount from the item
                IF (v_item->>'custom_amount') IS NOT NULL THEN
                    v_product_price := (v_item->>'custom_amount')::DECIMAL(12,2);
                END IF;
            END IF;
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

    -- 3. Calculate Shipping (Skip for wallet loads)
    IF v_is_wallet_credit THEN
        v_shipping_cost := 0.00;
    ELSIF p_shipping_method = 'express' THEN
        v_shipping_cost := 99.00;
    ELSIF p_shipping_method = 'priority' THEN
        v_shipping_cost := 199.00;
    ELSE
        v_shipping_cost := 0.00;
    END IF;

    -- 4. Validate and Apply Coupon (Skip for wallet loads)
    IF NOT v_is_wallet_credit AND p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
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

    -- 5. Apply Lucky Discount
    v_lucky_discount_actual := LEAST(GREATEST(p_lucky_discount, 0.01), 0.99);
    v_discount_amount := v_coupon_discount + v_lucky_discount_actual;

    -- 6. Calculate Final Total
    v_total := v_subtotal + v_shipping_cost - v_discount_amount;
    v_total := GREATEST(v_total, 0);

    -- 7. Generate Unique 5-Digit Order ID
    LOOP
        v_display_order_id := (floor(random() * 90000 + 10000))::text;
        IF NOT EXISTS (SELECT 1 FROM public.orders WHERE display_order_id = v_display_order_id) THEN
            EXIT;
        END IF;
    END LOOP;

    -- 8. Generate Transaction ID (TXN + Timestamp + Random)
    -- Format: TXN20231025123045999
    v_transaction_id := 'TXN' || to_char(now(), 'YYYYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- 9. Insert Order
    INSERT INTO public.orders (
        user_id, display_order_id, status, subtotal, shipping, discount,
        discount_id, discount_code, discount_amount, tax, total,
        payment_method, shipping_name, shipping_address, shipping_city,
        shipping_state, shipping_zip_code, shipping_country, shipping_phone,
        shipping_method, estimated_delivery, transaction_id
    ) VALUES (
        p_user_id, v_display_order_id, 'pending', v_subtotal, v_shipping_cost, v_discount_amount,
        v_applied_discount_id, v_applied_discount_code, v_coupon_discount, 0, v_total,
        'upi', 
        CASE WHEN v_is_wallet_credit THEN 'Wallet Load' ELSE p_shipping_address->>'full_name' END,
        CASE WHEN v_is_wallet_credit THEN NULL ELSE p_shipping_address->>'address' END,
        CASE WHEN v_is_wallet_credit THEN NULL ELSE p_shipping_address->>'city' END,
        CASE WHEN v_is_wallet_credit THEN NULL ELSE p_shipping_address->>'state' END,
        CASE WHEN v_is_wallet_credit THEN NULL ELSE p_shipping_address->>'pincode' END,
        CASE WHEN v_is_wallet_credit THEN 'India' ELSE COALESCE(p_shipping_address->>'country', 'India') END,
        CASE WHEN v_is_wallet_credit THEN NULL ELSE p_shipping_address->>'phone' END,
        CASE WHEN v_is_wallet_credit THEN NULL ELSE p_shipping_method END,
        CASE WHEN v_is_wallet_credit THEN NULL ELSE NOW() + INTERVAL '7 days' END,
        v_transaction_id
    ) RETURNING id INTO v_order_id;

    -- 10. Insert Order Items
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

    -- 11. Increment Coupon Usage
    IF v_is_valid_coupon THEN
        UPDATE public.discounts SET usage_count = usage_count + 1 WHERE id = v_applied_discount_id;
    END IF;

    -- 12. Generate UPI Link
    -- Fetch UPI ID from site_settings
    SELECT upi_id INTO v_upi_id FROM public.site_settings LIMIT 1;
    
    -- Fallback if setting missing
    IF v_upi_id IS NULL OR length(v_upi_id) = 0 THEN
        v_upi_id := 'hrejuh@upi'; 
    END IF;

    v_upi_link := 'upi://pay?pa=' || v_upi_id || '&pn=Cigarro&am=' || v_total || '&cu=INR&tn=Order-' || v_transaction_id;

    -- 13. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'display_order_id', v_display_order_id,
        'total', v_total,
        'subtotal', v_subtotal,
        'discount', v_discount_amount,
        'transaction_id', v_transaction_id,
        'upi_deep_link', v_upi_link,
        'message', 'Order created successfully'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_order_payment TO service_role;
