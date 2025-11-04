-- =====================================================
-- REFERRAL SYSTEM - SIMPLIFIED SINGLE TABLE
-- =====================================================
-- Features:
-- 1. Unique 6-digit alphanumeric referral codes (e.g., ABC123)
-- 2. Track referrals and their status
-- 3. Both referrer and referred get ₹100 after first order
-- 4. Referral link: cigarro.in/referral/ABC123
-- =====================================================

-- =====================================================
-- SINGLE REFERRALS TABLE (Everything in one place)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User Information
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code TEXT UNIQUE NOT NULL, -- User's unique 6-digit code (e.g., ABC123)
    
    -- Referral Stats (for this user as a referrer)
    total_referrals INTEGER NOT NULL DEFAULT 0, -- How many people they referred
    successful_referrals INTEGER NOT NULL DEFAULT 0, -- How many completed first order
    total_rewards_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Total ₹ earned
    
    -- If this user was referred by someone
    referred_by_user_id UUID REFERENCES auth.users(id), -- Who referred them
    referred_by_code TEXT, -- Code they used to sign up
    referral_reward_amount DECIMAL(10,2) DEFAULT 100.00, -- ₹100 reward
    
    -- First Order Tracking (for reward eligibility)
    first_order_completed BOOLEAN DEFAULT false,
    first_order_id UUID REFERENCES public.orders(id),
    first_order_date TIMESTAMPTZ,
    
    -- Reward Status
    own_reward_paid BOOLEAN DEFAULT false, -- Did they get their ₹100 for being referred
    own_reward_paid_at TIMESTAMPTZ,
    
    -- Metadata
    signup_source TEXT, -- 'web', 'mobile', etc.
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON public.referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_by ON public.referrals(referred_by_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_first_order ON public.referrals(first_order_completed);

-- =====================================================
-- FUNCTION: GENERATE UNIQUE 6-DIGIT ALPHANUMERIC CODE
-- =====================================================
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars (0, O, I, 1)
    result TEXT := '';
    i INTEGER;
    code_exists BOOLEAN;
BEGIN
    LOOP
        result := '';
        -- Generate 6 random characters
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM public.referrals WHERE referral_code = result) INTO code_exists;
        
        -- Exit loop if code is unique
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: CREATE REFERRAL RECORD FOR NEW USER
-- =====================================================
CREATE OR REPLACE FUNCTION create_user_referral_record()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
BEGIN
    -- Generate unique referral code
    new_code := generate_referral_code();
    
    -- Insert referral record for new user
    INSERT INTO public.referrals (user_id, referral_code)
    VALUES (NEW.id, new_code)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Failed to create referral record for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-generate referral code on user signup
DROP TRIGGER IF EXISTS trigger_create_referral_record ON auth.users;
CREATE TRIGGER trigger_create_referral_record
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_referral_record();

-- =====================================================
-- FUNCTION: RECORD REFERRAL RELATIONSHIP
-- =====================================================
CREATE OR REPLACE FUNCTION record_referral(
    p_referred_user_id UUID,
    p_referral_code TEXT,
    p_signup_source TEXT DEFAULT 'web',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_referrer_id UUID;
    v_referrer_name TEXT;
BEGIN
    -- Find referrer by code
    SELECT user_id INTO v_referrer_id
    FROM public.referrals
    WHERE referral_code = UPPER(p_referral_code)
    AND is_active = true;
    
    -- If referral code not found
    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid referral code'
        );
    END IF;
    
    -- Check if user is trying to refer themselves
    IF v_referrer_id = p_referred_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cannot refer yourself'
        );
    END IF;
    
    -- Check if user was already referred
    IF EXISTS(SELECT 1 FROM public.referrals WHERE user_id = p_referred_user_id AND referred_by_user_id IS NOT NULL) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User already referred by someone else'
        );
    END IF;
    
    -- Get referrer's name for welcome message
    SELECT COALESCE(p.name, u.email) INTO v_referrer_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = v_referrer_id;
    
    -- Update referred user's record with referrer info
    UPDATE public.referrals
    SET referred_by_user_id = v_referrer_id,
        referred_by_code = UPPER(p_referral_code),
        signup_source = p_signup_source,
        ip_address = p_ip_address,
        user_agent = p_user_agent,
        updated_at = NOW()
    WHERE user_id = p_referred_user_id;
    
    -- Update referrer's total referrals count
    UPDATE public.referrals
    SET total_referrals = total_referrals + 1,
        updated_at = NOW()
    WHERE user_id = v_referrer_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'referrer_id', v_referrer_id,
        'referrer_name', v_referrer_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: VALIDATE REFERRAL CODE (Public function for landing page)
-- =====================================================
CREATE OR REPLACE FUNCTION validate_referral_code(p_referral_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_referrer_id UUID;
    v_referrer_name TEXT;
BEGIN
    -- Find referrer by code
    SELECT r.user_id INTO v_referrer_id
    FROM public.referrals r
    WHERE r.referral_code = UPPER(p_referral_code)
    AND r.is_active = true;
    
    -- If referral code not found
    IF v_referrer_id IS NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Invalid referral code'
        );
    END IF;
    
    -- Get referrer's name
    SELECT COALESCE(p.name, u.email) INTO v_referrer_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = v_referrer_id;
    
    RETURN jsonb_build_object(
        'valid', true,
        'referrer_name', v_referrer_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: PROCESS FIRST ORDER REFERRAL REWARDS
-- =====================================================
CREATE OR REPLACE FUNCTION process_referral_first_order()
RETURNS TRIGGER AS $$
DECLARE
    v_referred_user_record RECORD;
    v_is_first_order BOOLEAN;
BEGIN
    -- Only process for completed/paid orders
    IF NEW.status NOT IN ('processing', 'completed') OR NEW.payment_confirmed != true THEN
        RETURN NEW;
    END IF;
    
    -- Check if this is user's first order
    SELECT COUNT(*) = 1 INTO v_is_first_order
    FROM public.orders
    WHERE user_id = NEW.user_id
    AND payment_confirmed = true
    AND status IN ('processing', 'completed');
    
    -- If not first order, exit
    IF NOT v_is_first_order THEN
        RETURN NEW;
    END IF;
    
    -- Get user's referral record
    SELECT * INTO v_referred_user_record
    FROM public.referrals
    WHERE user_id = NEW.user_id
    AND first_order_completed = false;
    
    -- If user exists and hasn't completed first order yet
    IF FOUND THEN
        -- Mark first order as completed
        UPDATE public.referrals
        SET first_order_completed = true,
            first_order_id = NEW.id,
            first_order_date = NOW(),
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
        
        -- If user was referred by someone, update referrer's stats
        IF v_referred_user_record.referred_by_user_id IS NOT NULL THEN
            UPDATE public.referrals
            SET successful_referrals = successful_referrals + 1,
                total_rewards_earned = total_rewards_earned + 100.00,
                updated_at = NOW()
            WHERE user_id = v_referred_user_record.referred_by_user_id;
            
            -- Log the event
            RAISE NOTICE 'Referral rewards triggered for order % - Referrer: %, Referred: %', 
                NEW.id, v_referred_user_record.referred_by_user_id, NEW.user_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process referral rewards on first order
DROP TRIGGER IF EXISTS trigger_process_referral_rewards ON public.orders;
CREATE TRIGGER trigger_process_referral_rewards
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION process_referral_first_order();

-- =====================================================
-- FUNCTION: GET USER REFERRAL STATS
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_referral_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'referral_code', r.referral_code,
        'total_referrals', r.total_referrals,
        'successful_referrals', r.successful_referrals,
        'pending_referrals', r.total_referrals - r.successful_referrals,
        'total_rewards_earned', r.total_rewards_earned,
        'referral_link', 'https://cigarro.in/referral/' || r.referral_code,
        'own_reward_pending', CASE 
            WHEN r.referred_by_user_id IS NOT NULL AND r.first_order_completed AND NOT r.own_reward_paid 
            THEN r.referral_reward_amount 
            ELSE 0 
        END
    ) INTO v_stats
    FROM public.referrals r
    WHERE r.user_id = p_user_id;
    
    RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: GET USER'S REFERRAL LIST
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_referrals(p_user_id UUID)
RETURNS TABLE (
    referred_user_id UUID,
    referred_user_email TEXT,
    referred_user_name TEXT,
    signup_date TIMESTAMPTZ,
    first_order_completed BOOLEAN,
    first_order_date TIMESTAMPTZ,
    reward_earned DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.user_id,
        u.email::TEXT,
        COALESCE(p.name, 'User')::TEXT,
        r.created_at,
        r.first_order_completed,
        r.first_order_date,
        CASE WHEN r.first_order_completed THEN 100.00 ELSE 0.00 END
    FROM public.referrals r
    JOIN auth.users u ON u.id = r.user_id
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE r.referred_by_user_id = p_user_id
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_referrals_updated_at ON public.referrals;
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referral data
DROP POLICY IF EXISTS "Users can view own referral data" ON public.referrals;
CREATE POLICY "Users can view own referral data"
    ON public.referrals FOR SELECT
    USING (auth.uid() = user_id);

-- Users can view referral data of people they referred
DROP POLICY IF EXISTS "Users can view referred users" ON public.referrals;
CREATE POLICY "Users can view referred users"
    ON public.referrals FOR SELECT
    USING (auth.uid() = referred_by_user_id);

-- =====================================================
-- VIEWS FOR EASY QUERYING
-- =====================================================

-- View: Referral leaderboard
CREATE OR REPLACE VIEW referral_leaderboard AS
SELECT 
    r.user_id,
    COALESCE(p.name, u.email) as user_name,
    u.email,
    r.referral_code,
    r.total_referrals,
    r.successful_referrals,
    r.total_rewards_earned,
    r.created_at
FROM public.referrals r
JOIN auth.users u ON u.id = r.user_id
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE r.is_active = true
AND r.total_referrals > 0
ORDER BY r.successful_referrals DESC, r.total_referrals DESC;

-- View: Pending referral rewards (users who completed first order but haven't been paid)
CREATE OR REPLACE VIEW pending_referral_rewards AS
SELECT 
    r.user_id,
    u.email,
    COALESCE(p.name, u.email) as user_name,
    r.referred_by_user_id,
    r.first_order_id,
    r.first_order_date,
    r.referral_reward_amount,
    r.own_reward_paid,
    r.created_at
FROM public.referrals r
JOIN auth.users u ON u.id = r.user_id
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE r.first_order_completed = true
AND r.own_reward_paid = false
AND r.referred_by_user_id IS NOT NULL
ORDER BY r.first_order_date DESC;

-- =====================================================
-- BACKFILL REFERRAL RECORDS FOR EXISTING USERS
-- =====================================================
-- Create referral records for users who signed up before this migration
INSERT INTO public.referrals (user_id, referral_code)
SELECT 
    u.id,
    generate_referral_code()
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.referrals r WHERE r.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON referral_leaderboard TO authenticated;
GRANT SELECT ON pending_referral_rewards TO authenticated;

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION get_user_referral_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_referrals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_referral(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_referral_code(TEXT) TO anon, authenticated;
