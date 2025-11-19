-- =====================================================
-- TRANSACTION PROCESSING FUNCTIONS
-- Migration: 043_transaction_functions.sql
-- Author: Senior Database Architect
-- Date: 2025-10-30
-- =====================================================
-- 
-- This migration creates secure server-side functions for:
-- 1. Processing order payments (with optional wallet)
-- 2. Verifying payments (called by webhook)
-- 3. Processing wallet loads
-- 4. Processing refunds
-- 5. Processing referral bonuses
-- 6. Processing payment retries
--
-- SECURITY: All functions use SECURITY DEFINER
-- CLIENT NEVER TOUCHES: All financial logic server-side only
--
-- =====================================================

-- =====================================================
-- DROP OLD FUNCTIONS (from migration 038)
-- =====================================================
DROP FUNCTION IF EXISTS verify_order_payment(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_order_payment(UUID, UUID, DECIMAL(12,2), TEXT, TEXT, BOOLEAN, DECIMAL(12,2), JSONB);
DROP FUNCTION IF EXISTS process_wallet_load(UUID, DECIMAL(12,2), TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS complete_wallet_load(TEXT, TEXT);
DROP FUNCTION IF EXISTS process_refund(UUID, DECIMAL(12,2), TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS process_referral_bonus(UUID, UUID, UUID, UUID, DECIMAL(12,2));
DROP FUNCTION IF EXISTS process_payment_retry(UUID, TEXT, TEXT, JSONB);

-- =====================================================
-- FUNCTION 1: PROCESS ORDER PAYMENT
-- Called when user initiates payment (creates pending transaction)
-- =====================================================
CREATE OR REPLACE FUNCTION process_order_payment(
    p_user_id UUID,
    p_order_id UUID,
    p_amount DECIMAL(12,2),
    p_payment_method TEXT,
    p_transaction_id TEXT,
    p_use_wallet BOOLEAN DEFAULT false,
    p_wallet_amount DECIMAL(12,2) DEFAULT 0.00,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_balance DECIMAL(12,2);
    v_wallet_txn_id UUID;
    v_gateway_txn_id UUID;
    v_order_total DECIMAL(12,2);
    v_order_number TEXT;
BEGIN
    -- Validate order belongs to user
    SELECT total, display_order_id INTO v_order_total, v_order_number
    FROM public.orders
    WHERE id = p_order_id AND user_id = p_user_id;
    
    IF v_order_total IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'order_not_found',
            'message', 'Order not found or does not belong to user'
        );
    END IF;
    
    -- Validate amount matches order total
    IF p_amount != v_order_total THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'amount_mismatch',
            'message', 'Payment amount does not match order total',
            'expected', v_order_total,
            'received', p_amount
        );
    END IF;
    
    -- Validate wallet amount if using wallet
    IF p_use_wallet AND p_wallet_amount > 0 THEN
        -- Check wallet balance
        v_wallet_balance := get_wallet_balance(p_user_id);
        
        IF v_wallet_balance < p_wallet_amount THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'insufficient_wallet_balance',
                'message', 'Insufficient wallet balance',
                'wallet_balance', v_wallet_balance,
                'requested_amount', p_wallet_amount
            );
        END IF;
        
        -- Validate wallet amount doesn't exceed order total
        IF p_wallet_amount > p_amount THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'invalid_wallet_amount',
                'message', 'Wallet amount cannot exceed order total'
            );
        END IF;
        
        -- Deduct from wallet
        PERFORM update_wallet_balance(p_user_id, p_wallet_amount, 'debit');
        
        -- Create wallet transaction
        INSERT INTO public.transactions (
            user_id, type, amount, direction, status,
            payment_method, internal_transaction_id,
            description, order_id,
            balance_before, balance_after, metadata,
            verified, completed_at
        ) VALUES (
            p_user_id,
            'order_partial_wallet',
            p_wallet_amount,
            'debit',
            'completed',
            'wallet',
            p_transaction_id || '_WALLET',
            'Partial payment from wallet for Order #' || v_order_number,
            p_order_id,
            v_wallet_balance,
            v_wallet_balance - p_wallet_amount,
            p_metadata || jsonb_build_object('wallet_deduction', true),
            true,
            NOW()
        ) RETURNING id INTO v_wallet_txn_id;
        
        RAISE NOTICE 'Wallet transaction created: %', v_wallet_txn_id;
    END IF;
    
    -- Create gateway transaction (if remaining amount)
    IF p_amount > COALESCE(p_wallet_amount, 0) THEN
        INSERT INTO public.transactions (
            user_id, type, amount, direction, status,
            payment_method, internal_transaction_id,
            description, order_id,
            parent_transaction_id, metadata
        ) VALUES (
            p_user_id,
            CASE 
                WHEN p_wallet_amount > 0 THEN 'order_partial_gateway' 
                ELSE 'order_payment' 
            END,
            p_amount - COALESCE(p_wallet_amount, 0),
            'debit',
            'pending',
            p_payment_method,
            p_transaction_id,
            'Payment for Order #' || v_order_number,
            p_order_id,
            v_wallet_txn_id,
            p_metadata || jsonb_build_object(
                'gateway_payment', true,
                'wallet_amount_used', COALESCE(p_wallet_amount, 0)
            )
        ) RETURNING id INTO v_gateway_txn_id;
        
        RAISE NOTICE 'Gateway transaction created: %', v_gateway_txn_id;
    ELSE
        -- Full wallet payment - update order immediately
        UPDATE public.orders
        SET payment_verified = 'YES',
            payment_confirmed = true,
            payment_confirmed_at = NOW(),
            payment_verified_at = NOW(),
            status = 'processing',
            updated_at = NOW()
        WHERE id = p_order_id;
        
        RAISE NOTICE 'Full wallet payment - Order % updated to processing', p_order_id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'wallet_transaction_id', v_wallet_txn_id,
        'gateway_transaction_id', v_gateway_txn_id,
        'wallet_amount_used', COALESCE(p_wallet_amount, 0),
        'gateway_amount', p_amount - COALESCE(p_wallet_amount, 0),
        'message', 'Payment processed successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'processing_error',
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_order_payment IS 'Process order payment with optional wallet usage - creates pending transaction';

-- =====================================================
-- FUNCTION 2: VERIFY ORDER PAYMENT
-- Called by webhook after payment confirmation
-- =====================================================
CREATE OR REPLACE FUNCTION verify_order_payment(
    p_transaction_id TEXT,
    p_amount DECIMAL(12,2),
    p_bank_name TEXT DEFAULT NULL,
    p_upi_reference TEXT DEFAULT NULL,
    p_verification_method TEXT DEFAULT 'email_parse',
    p_email_verification_id UUID DEFAULT NULL
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

COMMENT ON FUNCTION verify_order_payment IS 'Verify and complete a pending payment transaction - called by webhook';

-- =====================================================
-- FUNCTION 3: PROCESS WALLET LOAD
-- Load money into user wallet
-- =====================================================
CREATE OR REPLACE FUNCTION process_wallet_load(
    p_user_id UUID,
    p_amount DECIMAL(12,2),
    p_payment_method TEXT,
    p_transaction_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_balance DECIMAL(12,2);
    v_new_balance DECIMAL(12,2);
    v_transaction_id UUID;
    v_load_type TEXT;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_amount',
            'message', 'Amount must be greater than 0'
        );
    END IF;
    
    -- Determine load type based on payment method
    v_load_type := CASE p_payment_method
        WHEN 'upi' THEN 'wallet_load_upi'
        WHEN 'card' THEN 'wallet_load_card'
        WHEN 'netbanking' THEN 'wallet_load_netbanking'
        WHEN 'giftcard' THEN 'wallet_load_giftcard'
        ELSE 'wallet_load_upi'
    END;
    
    -- Get current balance
    v_wallet_balance := get_wallet_balance(p_user_id);
    v_new_balance := v_wallet_balance + p_amount;
    
    -- Create pending transaction
    INSERT INTO public.transactions (
        user_id, type, amount, direction, status,
        payment_method, internal_transaction_id,
        description,
        balance_before, balance_after, metadata
    ) VALUES (
        p_user_id,
        v_load_type,
        p_amount,
        'credit',
        'pending',
        p_payment_method,
        p_transaction_id,
        'Wallet load via ' || UPPER(p_payment_method),
        v_wallet_balance,
        v_new_balance,
        p_metadata
    ) RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'amount', p_amount,
        'balance_before', v_wallet_balance,
        'balance_after', v_new_balance,
        'message', 'Wallet load initiated - pending payment verification'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'processing_error',
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_wallet_load IS 'Initiate wallet load - creates pending transaction';

-- =====================================================
-- FUNCTION 4: COMPLETE WALLET LOAD
-- Called by webhook after payment verification
-- =====================================================
CREATE OR REPLACE FUNCTION complete_wallet_load(
    p_transaction_id TEXT,
    p_verification_method TEXT DEFAULT 'email_parse'
)
RETURNS JSONB AS $$
DECLARE
    v_transaction RECORD;
    v_update_result JSONB;
BEGIN
    -- Find pending wallet load transaction
    SELECT * INTO v_transaction
    FROM public.transactions
    WHERE internal_transaction_id = p_transaction_id
    AND type LIKE 'wallet_load%'
    AND status = 'pending';
    
    IF v_transaction.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'transaction_not_found',
            'message', 'No pending wallet load found'
        );
    END IF;
    
    -- Credit wallet
    v_update_result := update_wallet_balance(
        v_transaction.user_id,
        v_transaction.amount,
        'credit'
    );
    
    IF (v_update_result->>'success')::boolean = false THEN
        RETURN v_update_result;
    END IF;
    
    -- Update transaction to completed
    UPDATE public.transactions
    SET status = 'completed',
        verified = true,
        verified_at = NOW(),
        verification_method = p_verification_method,
        completed_at = NOW(),
        balance_after = (v_update_result->>'balance_after')::decimal
    WHERE id = v_transaction.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction.id,
        'amount', v_transaction.amount,
        'new_balance', v_update_result->>'balance_after',
        'message', 'Wallet loaded successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'completion_error',
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_wallet_load IS 'Complete wallet load after payment verification - credits wallet';

-- =====================================================
-- FUNCTION 5: PROCESS REFUND
-- Process refund to wallet or original source
-- =====================================================
CREATE OR REPLACE FUNCTION process_refund(
    p_order_id UUID,
    p_amount DECIMAL(12,2),
    p_refund_destination TEXT, -- 'wallet' or 'source'
    p_refund_reason TEXT,
    p_refunded_by UUID,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_original_txn UUID;
    v_refund_txn_id UUID;
    v_wallet_balance DECIMAL(12,2);
    v_new_balance DECIMAL(12,2);
    v_transaction_id TEXT;
BEGIN
    -- Get order details
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'order_not_found'
        );
    END IF;
    
    -- Validate refund amount
    IF p_amount <= 0 OR p_amount > v_order.total THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_refund_amount',
            'message', 'Refund amount must be between 0 and order total'
        );
    END IF;
    
    -- Find original payment transaction
    SELECT id INTO v_original_txn
    FROM public.transactions
    WHERE order_id = p_order_id
    AND type IN ('order_payment', 'order_partial_gateway')
    AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Generate refund transaction ID
    v_transaction_id := 'REFUND' || FLOOR(RANDOM() * 100000000)::TEXT;
    
    -- Process refund based on destination
    IF p_refund_destination = 'wallet' THEN
        -- Get current wallet balance
        v_wallet_balance := get_wallet_balance(v_order.user_id);
        v_new_balance := v_wallet_balance + p_amount;
        
        -- Credit wallet
        PERFORM update_wallet_balance(v_order.user_id, p_amount, 'credit');
        
        -- Create refund transaction
        INSERT INTO public.transactions (
            user_id, type, amount, direction, status,
            payment_method, internal_transaction_id,
            description, order_id,
            parent_transaction_id,
            refund_destination, refund_reason, refunded_by,
            balance_before, balance_after,
            metadata, verified, completed_at
        ) VALUES (
            v_order.user_id,
            'refund_to_wallet',
            p_amount,
            'credit',
            'completed',
            'wallet',
            v_transaction_id,
            'Refund to wallet for Order #' || v_order.display_order_id,
            p_order_id,
            v_original_txn,
            'wallet',
            p_refund_reason,
            p_refunded_by,
            v_wallet_balance,
            v_new_balance,
            p_metadata,
            true,
            NOW()
        ) RETURNING id INTO v_refund_txn_id;
        
    ELSE
        -- Refund to source (manual process)
        INSERT INTO public.transactions (
            user_id, type, amount, direction, status,
            payment_method, internal_transaction_id,
            description, order_id,
            parent_transaction_id,
            refund_destination, refund_reason, refunded_by,
            metadata
        ) VALUES (
            v_order.user_id,
            'refund_to_source',
            p_amount,
            'credit',
            'processing',
            v_order.payment_method,
            v_transaction_id,
            'Refund to ' || v_order.payment_method || ' for Order #' || v_order.display_order_id,
            p_order_id,
            v_original_txn,
            'source',
            p_refund_reason,
            p_refunded_by,
            p_metadata || jsonb_build_object('requires_manual_processing', true)
        ) RETURNING id INTO v_refund_txn_id;
    END IF;
    
    -- Update order status
    UPDATE public.orders
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'refund_transaction_id', v_refund_txn_id,
        'amount', p_amount,
        'destination', p_refund_destination,
        'message', 'Refund processed successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'refund_error',
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_refund IS 'Process refund to wallet or original payment source';

-- =====================================================
-- FUNCTION 6: PROCESS REFERRAL BONUS
-- Award referral bonus to wallet
-- =====================================================
CREATE OR REPLACE FUNCTION process_referral_bonus(
    p_referrer_id UUID,
    p_referred_id UUID,
    p_referral_id UUID,
    p_order_id UUID,
    p_bonus_amount DECIMAL(12,2) DEFAULT 100.00
)
RETURNS JSONB AS $$
DECLARE
    v_referrer_balance DECIMAL(12,2);
    v_referred_balance DECIMAL(12,2);
    v_referrer_txn_id UUID;
    v_referred_txn_id UUID;
    v_referrer_name TEXT;
    v_referred_name TEXT;
BEGIN
    -- Get user names
    SELECT COALESCE(name, email) INTO v_referrer_name
    FROM auth.users WHERE id = p_referrer_id;
    
    SELECT COALESCE(name, email) INTO v_referred_name
    FROM auth.users WHERE id = p_referred_id;
    
    -- Get current balances
    v_referrer_balance := get_wallet_balance(p_referrer_id);
    v_referred_balance := get_wallet_balance(p_referred_id);
    
    -- Credit referrer wallet
    PERFORM update_wallet_balance(p_referrer_id, p_bonus_amount, 'credit');
    
    -- Create referrer transaction
    INSERT INTO public.transactions (
        user_id, type, amount, direction, status,
        payment_method, internal_transaction_id,
        description, order_id, referral_id, related_user_id,
        balance_before, balance_after,
        verified, completed_at
    ) VALUES (
        p_referrer_id,
        'referral_bonus_earned',
        p_bonus_amount,
        'credit',
        'completed',
        'system',
        'REFBONUS' || FLOOR(RANDOM() * 100000000)::TEXT,
        'Referral bonus for referring ' || v_referred_name,
        p_order_id,
        p_referral_id,
        p_referred_id,
        v_referrer_balance,
        v_referrer_balance + p_bonus_amount,
        true,
        NOW()
    ) RETURNING id INTO v_referrer_txn_id;
    
    -- Credit referred user wallet
    PERFORM update_wallet_balance(p_referred_id, p_bonus_amount, 'credit');
    
    -- Create referred user transaction
    INSERT INTO public.transactions (
        user_id, type, amount, direction, status,
        payment_method, internal_transaction_id,
        description, order_id, referral_id, related_user_id,
        balance_before, balance_after,
        verified, completed_at
    ) VALUES (
        p_referred_id,
        'referral_bonus_received',
        p_bonus_amount,
        'credit',
        'completed',
        'system',
        'REFBONUS' || FLOOR(RANDOM() * 100000000)::TEXT,
        'Welcome bonus for joining via referral',
        p_order_id,
        p_referral_id,
        p_referrer_id,
        v_referred_balance,
        v_referred_balance + p_bonus_amount,
        true,
        NOW()
    ) RETURNING id INTO v_referred_txn_id;
    
    -- Update referrals table
    UPDATE public.referrals
    SET own_reward_paid = true,
        own_reward_paid_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_referred_id;
    
    UPDATE public.referrals
    SET successful_referrals = successful_referrals + 1,
        total_rewards_earned = total_rewards_earned + p_bonus_amount,
        updated_at = NOW()
    WHERE user_id = p_referrer_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'referrer_transaction_id', v_referrer_txn_id,
        'referred_transaction_id', v_referred_txn_id,
        'bonus_amount', p_bonus_amount,
        'message', 'Referral bonuses credited successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'bonus_error',
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_referral_bonus IS 'Award referral bonus to both referrer and referred user wallets';

-- =====================================================
-- FUNCTION 7: PROCESS PAYMENT RETRY
-- Handle payment retry with new transaction ID
-- =====================================================
CREATE OR REPLACE FUNCTION process_payment_retry(
    p_order_id UUID,
    p_new_transaction_id TEXT,
    p_payment_method TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_original_txn UUID;
    v_retry_txn_id UUID;
    v_retry_count INTEGER;
BEGIN
    -- Get order details
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id;
    
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'order_not_found'
        );
    END IF;
    
    -- Find original failed transaction
    SELECT id, retry_count INTO v_original_txn, v_retry_count
    FROM public.transactions
    WHERE order_id = p_order_id
    AND status IN ('failed', 'pending', 'expired')
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Mark old transaction as failed if still pending
    UPDATE public.transactions
    SET status = 'failed',
        failure_reason = 'Payment retry initiated',
        updated_at = NOW()
    WHERE id = v_original_txn
    AND status = 'pending';
    
    -- Create new retry transaction
    INSERT INTO public.transactions (
        user_id, type, amount, direction, status,
        payment_method, internal_transaction_id,
        description, order_id,
        parent_transaction_id,
        retry_count, metadata
    ) VALUES (
        v_order.user_id,
        'order_payment_retry',
        v_order.total,
        'debit',
        'pending',
        p_payment_method,
        p_new_transaction_id,
        'Retry payment for Order #' || v_order.display_order_id,
        p_order_id,
        v_original_txn,
        COALESCE(v_retry_count, 0) + 1,
        p_metadata || jsonb_build_object('retry_attempt', COALESCE(v_retry_count, 0) + 1)
    ) RETURNING id INTO v_retry_txn_id;
    
    -- Update order with new transaction ID
    UPDATE public.orders
    SET transaction_id = p_new_transaction_id,
        payment_verified = 'NO',
        payment_confirmed = false,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'retry_transaction_id', v_retry_txn_id,
        'original_transaction_id', v_original_txn,
        'retry_count', COALESCE(v_retry_count, 0) + 1,
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

COMMENT ON FUNCTION process_payment_retry IS 'Process payment retry with new transaction ID - links to original failed attempt';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute to authenticated users (they can call via RPC)
GRANT EXECUTE ON FUNCTION process_order_payment TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION verify_order_payment TO service_role; -- Only webhook
GRANT EXECUTE ON FUNCTION process_wallet_load TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION complete_wallet_load TO service_role; -- Only webhook
GRANT EXECUTE ON FUNCTION process_refund TO service_role; -- Only admins via service role
GRANT EXECUTE ON FUNCTION process_referral_bonus TO service_role; -- Only triggers
GRANT EXECUTE ON FUNCTION process_payment_retry TO authenticated, service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 043_transaction_functions.sql completed successfully';
    RAISE NOTICE '⚙️  Created 7 secure transaction processing functions';
    RAISE NOTICE '🔒 All functions use SECURITY DEFINER';
    RAISE NOTICE '🛡️  Proper permissions granted';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Functions created:';
    RAISE NOTICE '   1. process_order_payment() - Process order payments';
    RAISE NOTICE '   2. verify_order_payment() - Verify payments (webhook)';
    RAISE NOTICE '   3. process_wallet_load() - Initiate wallet load';
    RAISE NOTICE '   4. complete_wallet_load() - Complete wallet load (webhook)';
    RAISE NOTICE '   5. process_refund() - Process refunds';
    RAISE NOTICE '   6. process_referral_bonus() - Award referral bonuses';
    RAISE NOTICE '   7. process_payment_retry() - Handle payment retries';
END $$;
