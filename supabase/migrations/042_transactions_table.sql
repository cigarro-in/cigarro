-- =====================================================
-- UNIFIED TRANSACTIONS SYSTEM
-- Migration: 042_unified_transactions_system.sql
-- Author: Senior Database Architect
-- Date: 2025-10-30
-- =====================================================
-- 
-- This migration creates a unified financial infrastructure:
-- 1. transactions table - Single source of truth for all financial movements
-- 2. wallet_balances table - Current wallet state with lifetime statistics
-- 3. Helper functions - For wallet operations and transaction processing
-- 4. Triggers - Auto-update wallet balances and audit trails
-- 5. Indexes - Performance optimization for common queries
--
-- IDEMPOTENT: Safe to run multiple times
-- NON-BREAKING: Existing tables remain untouched
-- REVERSIBLE: Can be rolled back if needed
--
-- =====================================================

-- =====================================================
-- PART 1: CREATE TRANSACTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.transactions (
    -- ============================================
    -- IDENTITY & CLASSIFICATION
    -- ============================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL CHECK (type IN (
        -- Order Payments
        'order_payment',              -- Full payment for order
        'order_payment_retry',        -- Retry after failed payment
        'order_partial_wallet',       -- Partial payment from wallet
        'order_partial_gateway',      -- Remaining amount via UPI/card
        
        -- Wallet Operations
        'wallet_load_upi',            -- Load wallet via UPI
        'wallet_load_card',           -- Load wallet via card
        'wallet_load_netbanking',     -- Load wallet via netbanking
        'wallet_load_giftcard',       -- Redeem gift card to wallet
        'wallet_payment',             -- Full payment from wallet
        
        -- Referral & Rewards
        'referral_bonus_earned',      -- Earned ₹100 for referring
        'referral_bonus_received',    -- Received ₹100 for being referred
        'cashback',                   -- Cashback credited
        'loyalty_points',             -- Loyalty points → wallet
        'promotional_credit',         -- Marketing promotions
        
        -- Refunds
        'refund_to_wallet',           -- Refund credited to wallet
        'refund_to_source',           -- Refund to original payment method
        'refund_partial',             -- Partial refund
        
        -- Gift Cards
        'giftcard_purchase',          -- Buy gift card
        'giftcard_redeem',            -- Redeem gift card
        
        -- Admin Operations
        'admin_adjustment_credit',    -- Manual credit
        'admin_adjustment_debit',     -- Manual debit
        'admin_correction',           -- Correction entry
        'withdrawal'                  -- Withdraw from wallet
    )),
    
    -- ============================================
    -- FINANCIAL DETAILS
    -- ============================================
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    -- credit: Money IN (wallet_load, refund, bonus)
    -- debit: Money OUT (order_payment, withdrawal)
    
    -- Wallet Balance Snapshots (for wallet transactions only)
    balance_before DECIMAL(12, 2),
    balance_after DECIMAL(12, 2),
    
    -- ============================================
    -- STATUS & LIFECYCLE
    -- ============================================
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Initiated, awaiting confirmation
        'processing',   -- Being processed by gateway/system
        'completed',    -- Successfully completed
        'failed',       -- Failed
        'cancelled',    -- User cancelled
        'refunded',     -- Refunded
        'expired'       -- Expired (e.g., pending too long)
    )),
    
    failure_reason TEXT,
    failure_code TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- ============================================
    -- PAYMENT GATEWAY DETAILS
    -- ============================================
    payment_method TEXT CHECK (payment_method IN (
        'upi', 'card', 'netbanking', 'wallet', 
        'giftcard', 'cod', 'admin', 'system'
    )),
    
    payment_gateway TEXT,  -- 'razorpay', 'phonepe', 'paytm', 'internal'
    gateway_transaction_id TEXT,  -- External gateway's ID
    internal_transaction_id TEXT UNIQUE,  -- Our TXN12345678
    
    -- UPI Specific
    upi_id TEXT,
    upi_reference TEXT,
    bank_reference_number TEXT,
    bank_name TEXT,
    
    -- Card Specific (if applicable)
    card_last4 TEXT,
    card_brand TEXT,
    
    -- ============================================
    -- RELATIONSHIPS & REFERENCES
    -- ============================================
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    -- Linked order (for order payments/refunds)
    
    parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    -- Original transaction (for retries, refunds, corrections)
    
    referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
    -- Linked referral (for referral bonuses)
    
    related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Other user involved (referrer, gift card sender, etc.)
    
    giftcard_code TEXT,
    -- Gift card code (if applicable)
    
    -- ============================================
    -- REFUND DETAILS
    -- ============================================
    refund_destination TEXT CHECK (refund_destination IN (
        'wallet', 'source', 'bank_transfer', 'manual'
    )),
    refund_reason TEXT,
    refunded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- ============================================
    -- METADATA & DESCRIPTION
    -- ============================================
    description TEXT NOT NULL,
    -- Human-readable description
    
    notes TEXT,
    -- Admin notes or additional context
    
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Flexible JSON storage for extra data
    
    -- ============================================
    -- VERIFICATION & AUDIT
    -- ============================================
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verification_method TEXT CHECK (verification_method IN (
        'email_parse', 'webhook', 'manual', 'automatic', 'api'
    )),
    
    -- Email verification details (if applicable)
    email_verification_id UUID REFERENCES public.payment_verifications(id) ON DELETE SET NULL,
    
    -- ============================================
    -- TIMESTAMPS
    -- ============================================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- ============================================
    -- SOFT DELETE & AUDIT
    -- ============================================
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Idempotency key for preventing duplicate transactions
    idempotency_key TEXT UNIQUE,
    
    -- IP address and user agent for fraud detection
    ip_address INET,
    user_agent TEXT
);

-- Add comment
COMMENT ON TABLE public.transactions IS 'Unified transactions table - single source of truth for all financial movements';

-- =====================================================
-- PART 2: CREATE WALLET BALANCES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.wallet_balances (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Current Balances
    available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
    locked_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0),
    total_balance DECIMAL(12, 2) GENERATED ALWAYS AS (available_balance + locked_balance) STORED,
    
    -- Lifetime Statistics
    total_credited DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- All credits ever
    total_debited DECIMAL(12, 2) NOT NULL DEFAULT 0.00,   -- All debits ever
    total_refunded DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- All refunds received
    
    -- Transaction Counts
    transaction_count INTEGER NOT NULL DEFAULT 0,
    last_transaction_at TIMESTAMPTZ,
    
    -- Limits & Restrictions
    daily_load_limit DECIMAL(12, 2) DEFAULT 50000.00,
    monthly_load_limit DECIMAL(12, 2) DEFAULT 200000.00,
    max_balance_limit DECIMAL(12, 2) DEFAULT 200000.00,
    
    -- KYC & Verification
    kyc_verified BOOLEAN DEFAULT false,
    kyc_verified_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_frozen BOOLEAN DEFAULT false,
    frozen_reason TEXT,
    frozen_at TIMESTAMPTZ,
    frozen_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Version for optimistic locking
    version INTEGER NOT NULL DEFAULT 1
);

-- Add comment
COMMENT ON TABLE public.wallet_balances IS 'User wallet balances with lifetime statistics and limits';

-- =====================================================
-- PART 3: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id 
    ON public.transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_order_id 
    ON public.transactions(order_id) 
    WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_internal_txn_id 
    ON public.transactions(internal_transaction_id) 
    WHERE internal_transaction_id IS NOT NULL;

-- Status and type filtering
CREATE INDEX IF NOT EXISTS idx_transactions_status_type 
    ON public.transactions(status, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_type_user 
    ON public.transactions(type, user_id, created_at DESC);

-- Wallet transactions
CREATE INDEX IF NOT EXISTS idx_transactions_wallet 
    ON public.transactions(user_id, type, created_at DESC) 
    WHERE type LIKE 'wallet%' OR type LIKE '%wallet%';

-- Gateway lookups
CREATE INDEX IF NOT EXISTS idx_transactions_gateway_txn_id 
    ON public.transactions(gateway_transaction_id) 
    WHERE gateway_transaction_id IS NOT NULL;

-- Parent-child relationships
CREATE INDEX IF NOT EXISTS idx_transactions_parent 
    ON public.transactions(parent_transaction_id) 
    WHERE parent_transaction_id IS NOT NULL;

-- Referral transactions
CREATE INDEX IF NOT EXISTS idx_transactions_referral 
    ON public.transactions(referral_id) 
    WHERE referral_id IS NOT NULL;

-- Pending transactions (for cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_transactions_pending 
    ON public.transactions(status, created_at) 
    WHERE status = 'pending';

-- JSONB metadata (GIN index for flexible queries)
CREATE INDEX IF NOT EXISTS idx_transactions_metadata 
    ON public.transactions USING GIN (metadata);

-- Wallet balances - active wallets
CREATE INDEX IF NOT EXISTS idx_wallet_balances_active 
    ON public.wallet_balances(user_id) 
    WHERE is_active = true AND is_frozen = false;

-- =====================================================
-- PART 4: HELPER FUNCTIONS
-- =====================================================

-- =====================================================
-- FUNCTION: Initialize wallet for new user
-- =====================================================
CREATE OR REPLACE FUNCTION initialize_wallet_balance(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Validate that user_id is not null
    IF p_user_id IS NULL THEN
        RAISE WARNING 'Cannot initialize wallet: user_id is NULL';
        RETURN;
    END IF;
    
    INSERT INTO public.wallet_balances (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION initialize_wallet_balance IS 'Initialize wallet balance for a new user';

-- =====================================================
-- FUNCTION: Get current wallet balance
-- =====================================================
CREATE OR REPLACE FUNCTION get_wallet_balance(p_user_id UUID)
RETURNS DECIMAL(12, 2) AS $$
DECLARE
    v_balance DECIMAL(12, 2);
BEGIN
    SELECT available_balance INTO v_balance
    FROM public.wallet_balances
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(v_balance, 0.00);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_wallet_balance IS 'Get current available wallet balance for a user';

-- =====================================================
-- FUNCTION: Update wallet balance (with optimistic locking)
-- =====================================================
CREATE OR REPLACE FUNCTION update_wallet_balance(
    p_user_id UUID,
    p_amount DECIMAL(12, 2),
    p_direction TEXT,  -- 'credit' or 'debit'
    p_current_version INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_balance DECIMAL(12, 2);
    v_new_balance DECIMAL(12, 2);
    v_current_version INTEGER;
    v_wallet_exists BOOLEAN;
BEGIN
    -- Check if wallet exists
    SELECT EXISTS(SELECT 1 FROM public.wallet_balances WHERE user_id = p_user_id) INTO v_wallet_exists;
    
    -- Initialize wallet if it doesn't exist
    IF NOT v_wallet_exists THEN
        PERFORM initialize_wallet_balance(p_user_id);
    END IF;
    
    -- Get current balance and version with row lock
    SELECT available_balance, version 
    INTO v_current_balance, v_current_version
    FROM public.wallet_balances
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- Optimistic locking check (if version provided)
    IF p_current_version IS NOT NULL AND v_current_version != p_current_version THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'version_mismatch',
            'message', 'Wallet was updated by another transaction'
        );
    END IF;
    
    -- Calculate new balance
    IF p_direction = 'credit' THEN
        v_new_balance := v_current_balance + p_amount;
    ELSIF p_direction = 'debit' THEN
        v_new_balance := v_current_balance - p_amount;
        
        -- Check for insufficient balance
        IF v_new_balance < 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'insufficient_balance',
                'message', 'Insufficient wallet balance',
                'current_balance', v_current_balance,
                'requested_amount', p_amount
            );
        END IF;
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_direction',
            'message', 'Direction must be credit or debit'
        );
    END IF;
    
    -- Update wallet balance
    UPDATE public.wallet_balances
    SET available_balance = v_new_balance,
        total_credited = CASE WHEN p_direction = 'credit' THEN total_credited + p_amount ELSE total_credited END,
        total_debited = CASE WHEN p_direction = 'debit' THEN total_debited + p_amount ELSE total_debited END,
        transaction_count = transaction_count + 1,
        last_transaction_at = NOW(),
        updated_at = NOW(),
        version = version + 1
    WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'balance_before', v_current_balance,
        'balance_after', v_new_balance,
        'amount', p_amount,
        'direction', p_direction
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_wallet_balance IS 'Update wallet balance with optimistic locking and validation';

-- =====================================================
-- FUNCTION: Calculate wallet balance from transactions
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_wallet_balance_from_transactions(p_user_id UUID)
RETURNS DECIMAL(12, 2) AS $$
DECLARE
    v_balance DECIMAL(12, 2);
BEGIN
    SELECT 
        COALESCE(
            SUM(CASE 
                WHEN direction = 'credit' AND status = 'completed' THEN amount
                WHEN direction = 'debit' AND status = 'completed' THEN -amount
                ELSE 0
            END),
            0.00
        )
    INTO v_balance
    FROM public.transactions
    WHERE user_id = p_user_id
    AND type IN (
        'wallet_load_upi', 'wallet_load_card', 'wallet_load_netbanking', 'wallet_load_giftcard',
        'wallet_payment', 'order_partial_wallet',
        'referral_bonus_earned', 'referral_bonus_received', 'cashback', 'loyalty_points', 'promotional_credit',
        'refund_to_wallet', 'admin_adjustment_credit', 'admin_adjustment_debit'
    );
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_wallet_balance_from_transactions IS 'Calculate wallet balance from transaction history (for verification)';

-- =====================================================
-- PART 5: TRIGGERS
-- =====================================================

-- =====================================================
-- TRIGGER: Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON public.transactions;
CREATE TRIGGER trigger_update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transactions_updated_at();

-- =====================================================
-- TRIGGER: Auto-update wallet_balances updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_wallet_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_wallet_balances_updated_at ON public.wallet_balances;
CREATE TRIGGER trigger_update_wallet_balances_updated_at
    BEFORE UPDATE ON public.wallet_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_balances_updated_at();

-- =====================================================
-- TRIGGER: Initialize wallet on user creation
-- =====================================================
CREATE OR REPLACE FUNCTION create_wallet_on_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate that user_id is not null
    IF NEW.id IS NULL THEN
        RAISE WARNING 'Cannot create wallet: user_id is NULL';
        RETURN NEW;
    END IF;
    
    -- Insert wallet record for new user
    INSERT INTO public.wallet_balances (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Failed to create wallet for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_wallet_on_signup ON auth.users;
CREATE TRIGGER trigger_create_wallet_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_wallet_on_user_signup();

-- =====================================================
-- PART 6: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

-- Transactions: Users can view their own transactions
DROP POLICY IF EXISTS transactions_select_own ON public.transactions;
CREATE POLICY transactions_select_own ON public.transactions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Transactions: Users can insert their own transactions (via application)
DROP POLICY IF EXISTS transactions_insert_own ON public.transactions;
CREATE POLICY transactions_insert_own ON public.transactions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Transactions: Only admins can update/delete
DROP POLICY IF EXISTS transactions_admin_all ON public.transactions;
CREATE POLICY transactions_admin_all ON public.transactions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Wallet Balances: Users can view their own balance
DROP POLICY IF EXISTS wallet_balances_select_own ON public.wallet_balances;
CREATE POLICY wallet_balances_select_own ON public.wallet_balances
    FOR SELECT
    USING (auth.uid() = user_id);

-- Wallet Balances: Only system can insert/update (via triggers/functions)
-- Admins can view all
DROP POLICY IF EXISTS wallet_balances_admin_all ON public.wallet_balances;
CREATE POLICY wallet_balances_admin_all ON public.wallet_balances
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- PART 7: GRANT PERMISSIONS
-- =====================================================

-- Grant usage on tables
GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT SELECT ON public.wallet_balances TO authenticated;

-- Grant all to service role
GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.wallet_balances TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION initialize_wallet_balance TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_wallet_balance TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_wallet_balance TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION calculate_wallet_balance_from_transactions TO authenticated, service_role;

-- =====================================================
-- PART 8: SAMPLE DATA (Optional - for testing)
-- =====================================================

-- This section is commented out by default
-- Uncomment to insert sample transactions for testing

/*
-- Sample: Wallet load
INSERT INTO public.transactions (
    user_id, type, amount, direction, status, payment_method,
    internal_transaction_id, description, verified, completed_at
) VALUES (
    (SELECT id FROM auth.users LIMIT 1),
    'wallet_load_upi',
    1000.00,
    'credit',
    'completed',
    'upi',
    'TXN' || FLOOR(RANDOM() * 100000000)::TEXT,
    'Wallet load via UPI',
    true,
    NOW()
);

-- Sample: Order payment
INSERT INTO public.transactions (
    user_id, type, amount, direction, status, payment_method,
    internal_transaction_id, description, verified, completed_at,
    order_id
) VALUES (
    (SELECT id FROM auth.users LIMIT 1),
    'order_payment',
    1500.00,
    'debit',
    'completed',
    'upi',
    'TXN' || FLOOR(RANDOM() * 100000000)::TEXT,
    'Payment for Order #100177',
    true,
    NOW(),
    (SELECT id FROM public.orders LIMIT 1)
);
*/

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 042_unified_transactions_system.sql completed successfully';
    RAISE NOTICE '📊 Created tables: transactions, wallet_balances';
    RAISE NOTICE '🔑 Created indexes: 11 performance indexes';
    RAISE NOTICE '⚙️  Created functions: 4 helper functions';
    RAISE NOTICE '🔔 Created triggers: 3 automatic triggers';
    RAISE NOTICE '🔒 Enabled RLS with proper policies';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next steps:';
    RAISE NOTICE '   1. Verify tables created: SELECT * FROM public.transactions LIMIT 1;';
    RAISE NOTICE '   2. Test wallet initialization: SELECT initialize_wallet_balance(auth.uid());';
    RAISE NOTICE '   3. Check wallet balance: SELECT get_wallet_balance(auth.uid());';
    RAISE NOTICE '   4. Update application code to use new tables';
    RAISE NOTICE '   5. Run backfill script to migrate historical data';
END $$;
