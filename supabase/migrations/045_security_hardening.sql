-- =====================================================
-- SECURITY HARDENING MIGRATION
-- Migration: 045_security_hardening.sql
-- Purpose: Add secure backend functions and strengthen RLS
-- =====================================================

-- =====================================================
-- FUNCTION 1: Admin Payment Verification
-- Only admins can verify payments through this function
-- =====================================================
CREATE OR REPLACE FUNCTION admin_verify_payment(
    p_order_id UUID,
    p_verified TEXT,  -- 'YES', 'NO', 'REJECTED'
    p_admin_id UUID,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_order RECORD;
BEGIN
    -- Check if user is admin
    SELECT is_admin INTO v_is_admin
    FROM public.profiles
    WHERE id = p_admin_id;
    
    IF NOT v_is_admin THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'unauthorized',
            'message', 'Only admins can verify payments'
        );
    END IF;
    
    -- Validate verification status
    IF p_verified NOT IN ('YES', 'NO', 'REJECTED') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_status',
            'message', 'Invalid verification status'
        );
    END IF;
    
    -- Get order details
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'order_not_found',
            'message', 'Order not found'
        );
    END IF;
    
    -- Update order with verification
    UPDATE public.orders
    SET payment_verified = p_verified,
        payment_verified_at = NOW(),
        payment_verified_by = p_admin_id,
        payment_rejection_reason = CASE 
            WHEN p_verified = 'REJECTED' THEN p_rejection_reason 
            ELSE NULL 
        END,
        status = CASE 
            WHEN p_verified = 'YES' THEN 'processing'
            WHEN p_verified = 'REJECTED' THEN 'cancelled'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Log audit trail
    INSERT INTO public.audit_logs (
        action, resource, resource_id, user_id, metadata
    ) VALUES (
        'payment_verification',
        'order',
        p_order_id,
        p_admin_id,
        jsonb_build_object(
            'verification_status', p_verified,
            'rejection_reason', p_rejection_reason,
            'order_number', v_order.display_order_id
        )
    );
    
    RAISE NOTICE 'Admin % verified payment for order %: %', p_admin_id, p_order_id, p_verified;
    
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'verification_status', p_verified,
        'message', 'Payment verification updated successfully'
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

COMMENT ON FUNCTION admin_verify_payment IS 'Admin-only function to verify or reject order payments';

-- =====================================================
-- FUNCTION 2: Retry Payment (User)
-- Allows users to retry failed payments securely
-- =====================================================
CREATE OR REPLACE FUNCTION retry_order_payment(
    p_order_id UUID,
    p_user_id UUID,
    p_new_transaction_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- Validate order belongs to user
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id AND user_id = p_user_id;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'order_not_found',
            'message', 'Order not found or does not belong to user'
        );
    END IF;
    
    -- Only allow retry for pending/failed payments
    IF v_order.payment_verified = 'YES' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'already_paid',
            'message', 'Order is already paid'
        );
    END IF;
    
    -- Update order with new transaction ID
    UPDATE public.orders
    SET transaction_id = p_new_transaction_id,
        payment_verified = 'NO',
        payment_confirmed = false,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RAISE NOTICE 'User % retrying payment for order % with new transaction %', 
                 p_user_id, p_order_id, p_new_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'transaction_id', p_new_transaction_id,
        'message', 'Payment retry initiated'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'retry_error',
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION retry_order_payment IS 'Allows users to retry failed payments with a new transaction ID';

-- =====================================================
-- STRENGTHEN RLS POLICIES
-- =====================================================

-- Drop existing policies that might be too permissive
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update order payment status" ON public.orders;

-- Create strict RLS policy for orders
CREATE POLICY "Users can only read their own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users CANNOT update orders directly (must use functions)
-- No UPDATE policy = no direct updates allowed

-- Admin policy for orders (full access)
CREATE POLICY "Admins have full access to orders"
    ON public.orders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- STRENGTHEN TRANSACTIONS TABLE RLS
-- =====================================================

-- Drop permissive policies
DROP POLICY IF EXISTS "Users can update their transactions" ON public.transactions;

-- Users can only read their own transactions
CREATE POLICY "Users can read their own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Users CANNOT insert/update/delete transactions directly
-- Only backend functions can do this

-- Admin policy for transactions
CREATE POLICY "Admins have full access to transactions"
    ON public.transactions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION retry_order_payment TO authenticated;

-- Grant execute to service role (for admin functions)
GRANT EXECUTE ON FUNCTION admin_verify_payment TO service_role;

-- Also grant to authenticated (RLS will check admin status)
GRANT EXECUTE ON FUNCTION admin_verify_payment TO authenticated;

-- =====================================================
-- CLEANUP: Remove unused/dangerous functions
-- =====================================================

-- Drop the unused manual verification function if it exists
DROP FUNCTION IF EXISTS manually_verify_payment(UUID, JSONB);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Security hardening complete!';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Functions created:';
    RAISE NOTICE '   1. admin_verify_payment() - Admin payment verification';
    RAISE NOTICE '   2. retry_order_payment() - User payment retry';
    RAISE NOTICE '';
    RAISE NOTICE '🛡️  RLS policies strengthened:';
    RAISE NOTICE '   - Users can only READ their orders';
    RAISE NOTICE '   - Users can only INSERT their orders';
    RAISE NOTICE '   - Users CANNOT UPDATE orders directly';
    RAISE NOTICE '   - Users CANNOT modify transactions';
    RAISE NOTICE '   - All updates must go through backend functions';
    RAISE NOTICE '';
    RAISE NOTICE '👮 Admin access:';
    RAISE NOTICE '   - Admins have full access to orders';
    RAISE NOTICE '   - Admins have full access to transactions';
    RAISE NOTICE '   - Admin actions are logged in audit_logs';
    RAISE NOTICE '';
END $$;
