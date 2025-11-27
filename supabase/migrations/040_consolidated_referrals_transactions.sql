-- ============================================================================
-- Migration: 040_consolidated_referrals_transactions.sql
-- Description: Consolidated migration for Referral System and Unified Transactions
--              Merges migrations 040-044 into a single coherent update.
--              Includes:
--              1. Referral System (040, 044)
--              2. Order Status Enum Fix (041)
--              3. Unified Transactions Table (042)
--              4. Transaction & Wallet Functions (043)
-- Date: 2024-11-27
-- ============================================================================

-- ============================================================================
-- SECTION 1: REFERRAL SYSTEM (040)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code TEXT UNIQUE NOT NULL,
    total_referrals INTEGER NOT NULL DEFAULT 0,
    successful_referrals INTEGER NOT NULL DEFAULT 0,
    total_rewards_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    referred_by_user_id UUID REFERENCES auth.users(id),
    referred_by_code TEXT,
    referral_reward_amount DECIMAL(10,2) DEFAULT 100.00,
    first_order_completed BOOLEAN DEFAULT false,
    first_order_id UUID REFERENCES public.orders(id),
    first_order_date TIMESTAMPTZ,
    own_reward_paid BOOLEAN DEFAULT false,
    own_reward_paid_at TIMESTAMPTZ,
    signup_source TEXT,
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON public.referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_by ON public.referrals(referred_by_user_id);

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
    code_exists BOOLEAN;
BEGIN
    LOOP
        result := '';
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        SELECT EXISTS(SELECT 1 FROM public.referrals WHERE referral_code = result) INTO code_exists;
        EXIT WHEN NOT code_exists;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_user_referral_record()
RETURNS TRIGGER AS $$
DECLARE new_code TEXT;
BEGIN
    new_code := generate_referral_code();
    INSERT INTO public.referrals (user_id, referral_code) VALUES (NEW.id, new_code) ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_referral_record ON auth.users;
CREATE TRIGGER trigger_create_referral_record AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION create_user_referral_record();

CREATE OR REPLACE FUNCTION record_referral(p_referred_user_id UUID, p_referral_code TEXT, p_signup_source TEXT DEFAULT 'web', p_ip_address TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE v_referrer_id UUID; v_referrer_name TEXT;
BEGIN
    SELECT user_id INTO v_referrer_id FROM public.referrals WHERE referral_code = UPPER(p_referral_code) AND is_active = true;
    IF v_referrer_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code'); END IF;
    IF v_referrer_id = p_referred_user_id THEN RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself'); END IF;
    IF EXISTS(SELECT 1 FROM public.referrals WHERE user_id = p_referred_user_id AND referred_by_user_id IS NOT NULL) THEN RETURN jsonb_build_object('success', false, 'error', 'User already referred'); END IF;
    
    SELECT COALESCE(p.name, u.email) INTO v_referrer_name FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = v_referrer_id;
    
    UPDATE public.referrals SET referred_by_user_id = v_referrer_id, referred_by_code = UPPER(p_referral_code), signup_source = p_signup_source, ip_address = p_ip_address, user_agent = p_user_agent, updated_at = NOW() WHERE user_id = p_referred_user_id;
    UPDATE public.referrals SET total_referrals = total_referrals + 1, updated_at = NOW() WHERE user_id = v_referrer_id;
    
    RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'referrer_name', v_referrer_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION validate_referral_code(p_referral_code TEXT)
RETURNS JSONB AS $$
DECLARE v_referrer_id UUID; v_referrer_name TEXT;
BEGIN
    SELECT r.user_id INTO v_referrer_id FROM public.referrals r WHERE r.referral_code = UPPER(p_referral_code) AND r.is_active = true;
    IF v_referrer_id IS NULL THEN RETURN jsonb_build_object('valid', false, 'error', 'Invalid referral code'); END IF;
    SELECT COALESCE(p.name, u.email) INTO v_referrer_name FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = v_referrer_id;
    RETURN jsonb_build_object('valid', true, 'referrer_name', v_referrer_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own referral data" ON public.referrals;
CREATE POLICY "Users can view own referral data" ON public.referrals FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view referred users" ON public.referrals;
CREATE POLICY "Users can view referred users" ON public.referrals FOR SELECT USING (auth.uid() = referred_by_user_id);

-- Backfill
INSERT INTO public.referrals (user_id, referral_code)
SELECT u.id, generate_referral_code() FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.referrals r WHERE r.user_id = u.id) ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- SECTION 2: ORDER STATUS FIX (041)
-- ============================================================================

DO $$ 
BEGIN
    BEGIN
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ============================================================================
-- SECTION 3: TRANSACTIONS & WALLET (042)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    balance_before DECIMAL(12, 2),
    balance_after DECIMAL(12, 2),
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    internal_transaction_id TEXT UNIQUE,
    gateway_transaction_id TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.wallet_balances (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
    total_credited DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_debited DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_internal_txn_id ON public.transactions(internal_transaction_id);

CREATE OR REPLACE FUNCTION initialize_wallet_balance(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.wallet_balances (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_wallet_balance(p_user_id UUID)
RETURNS DECIMAL(12, 2) AS $$
DECLARE v_balance DECIMAL(12, 2);
BEGIN
    SELECT available_balance INTO v_balance FROM public.wallet_balances WHERE user_id = p_user_id;
    RETURN COALESCE(v_balance, 0.00);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_wallet_balance(p_user_id UUID, p_amount DECIMAL(12, 2), p_direction TEXT)
RETURNS JSONB AS $$
DECLARE v_current_balance DECIMAL(12, 2); v_new_balance DECIMAL(12, 2);
BEGIN
    PERFORM initialize_wallet_balance(p_user_id);
    SELECT available_balance INTO v_current_balance FROM public.wallet_balances WHERE user_id = p_user_id FOR UPDATE;
    
    IF p_direction = 'credit' THEN v_new_balance := v_current_balance + p_amount;
    ELSIF p_direction = 'debit' THEN v_new_balance := v_current_balance - p_amount;
        IF v_new_balance < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance'); END IF;
    END IF;
    
    UPDATE public.wallet_balances SET available_balance = v_new_balance, updated_at = NOW(), version = version + 1 WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'balance_after', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_wallet_on_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallet_balances (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_wallet_on_signup ON auth.users;
CREATE TRIGGER trigger_create_wallet_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION create_wallet_on_user_signup();

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_select_own ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wallet_balances_select_own ON public.wallet_balances FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 4: TRANSACTION FUNCTIONS (043)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_wallet_load(p_user_id UUID, p_amount DECIMAL(12,2), p_payment_method TEXT, p_transaction_id TEXT, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE v_wallet_balance DECIMAL(12,2); v_transaction_id UUID;
BEGIN
    v_wallet_balance := get_wallet_balance(p_user_id);
    INSERT INTO public.transactions (user_id, type, amount, direction, status, payment_method, internal_transaction_id, description, balance_before, balance_after, metadata)
    VALUES (p_user_id, 'wallet_load_upi', p_amount, 'credit', 'pending', p_payment_method, p_transaction_id, 'Wallet load', v_wallet_balance, v_wallet_balance + p_amount, p_metadata)
    RETURNING id INTO v_transaction_id;
    RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION complete_wallet_load(p_transaction_id TEXT)
RETURNS JSONB AS $$
DECLARE v_transaction RECORD; v_update_result JSONB;
BEGIN
    SELECT * INTO v_transaction FROM public.transactions WHERE internal_transaction_id = p_transaction_id AND status = 'pending';
    IF v_transaction.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'transaction_not_found'); END IF;
    v_update_result := update_wallet_balance(v_transaction.user_id, v_transaction.amount, 'credit');
    IF (v_update_result->>'success')::boolean = false THEN RETURN v_update_result; END IF;
    UPDATE public.transactions SET status = 'completed', verified = true, completed_at = NOW(), balance_after = (v_update_result->>'balance_after')::decimal WHERE id = v_transaction.id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION process_referral_bonus(p_referrer_id UUID, p_referred_id UUID, p_referral_id UUID, p_order_id UUID, p_bonus_amount DECIMAL(12,2) DEFAULT 100.00)
RETURNS JSONB AS $$
DECLARE v_res JSONB;
BEGIN
    PERFORM update_wallet_balance(p_referrer_id, p_bonus_amount, 'credit');
    INSERT INTO public.transactions (user_id, type, amount, direction, status, description, order_id, referral_id, verified, completed_at)
    VALUES (p_referrer_id, 'referral_bonus_earned', p_bonus_amount, 'credit', 'completed', 'Referral bonus', p_order_id, p_referral_id, true, NOW());
    
    PERFORM update_wallet_balance(p_referred_id, p_bonus_amount, 'credit');
    INSERT INTO public.transactions (user_id, type, amount, direction, status, description, order_id, referral_id, verified, completed_at)
    VALUES (p_referred_id, 'referral_bonus_received', p_bonus_amount, 'credit', 'completed', 'Referral welcome bonus', p_order_id, p_referral_id, true, NOW());
    
    UPDATE public.referrals SET own_reward_paid = true, own_reward_paid_at = NOW() WHERE user_id = p_referred_id;
    UPDATE public.referrals SET successful_referrals = successful_referrals + 1, total_rewards_earned = total_rewards_earned + p_bonus_amount WHERE user_id = p_referrer_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 5: REFERRAL TRIGGER UPDATE (044)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_referral_first_order()
RETURNS TRIGGER AS $$
DECLARE v_referred_user_record RECORD; v_is_first_order BOOLEAN;
BEGIN
    IF NEW.status NOT IN ('processing', 'delivered', 'shipped') OR NEW.payment_confirmed != true THEN RETURN NEW; END IF;
    SELECT COUNT(*) = 1 INTO v_is_first_order FROM public.orders WHERE user_id = NEW.user_id AND payment_confirmed = true AND status IN ('processing', 'delivered', 'shipped');
    IF NOT v_is_first_order THEN RETURN NEW; END IF;
    
    SELECT * INTO v_referred_user_record FROM public.referrals WHERE user_id = NEW.user_id AND first_order_completed = false;
    IF FOUND THEN
        UPDATE public.referrals SET first_order_completed = true, first_order_id = NEW.id, first_order_date = NOW() WHERE user_id = NEW.user_id;
        IF v_referred_user_record.referred_by_user_id IS NOT NULL THEN
            PERFORM process_referral_bonus(v_referred_user_record.referred_by_user_id, NEW.user_id, v_referred_user_record.id, NEW.id, 100.00);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_process_referral_first_order ON public.orders;
CREATE TRIGGER trigger_process_referral_first_order AFTER INSERT OR UPDATE OF status, payment_confirmed ON public.orders FOR EACH ROW EXECUTE FUNCTION process_referral_first_order();

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 040_consolidated_referrals_transactions completed successfully';
END $$;
