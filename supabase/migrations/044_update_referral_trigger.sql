-- =====================================================
-- UPDATE REFERRAL TRIGGER TO USE UNIFIED TRANSACTIONS
-- Migration: 044_update_referral_trigger.sql
-- Date: 2025-10-30
-- =====================================================
--
-- Updates the referral trigger to use the new process_referral_bonus()
-- function which credits wallet instead of just updating aggregates
--
-- =====================================================

-- Update the referral trigger function
CREATE OR REPLACE FUNCTION process_referral_first_order()
RETURNS TRIGGER AS $$
DECLARE
    v_referred_user_record RECORD;
    v_is_first_order BOOLEAN;
    v_bonus_result JSONB;
BEGIN
    -- Only process for completed/paid orders
    IF NEW.status NOT IN ('processing', 'delivered', 'shipped') OR NEW.payment_confirmed != true THEN
        RETURN NEW;
    END IF;
    
    -- Check if this is user's first order
    SELECT COUNT(*) = 1 INTO v_is_first_order
    FROM public.orders
    WHERE user_id = NEW.user_id
    AND payment_confirmed = true
    AND status IN ('processing', 'delivered', 'shipped');
    
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
        
        -- If user was referred by someone, process referral bonus
        IF v_referred_user_record.referred_by_user_id IS NOT NULL THEN
            -- Call the new unified function to credit wallets
            SELECT process_referral_bonus(
                p_referrer_id := v_referred_user_record.referred_by_user_id,
                p_referred_id := NEW.user_id,
                p_referral_id := v_referred_user_record.id,
                p_order_id := NEW.id,
                p_bonus_amount := 100.00
            ) INTO v_bonus_result;
            
            -- Log the result
            IF (v_bonus_result->>'success')::boolean = true THEN
                RAISE NOTICE 'Referral bonuses credited: %', v_bonus_result;
            ELSE
                RAISE WARNING 'Failed to credit referral bonuses: %', v_bonus_result->>'message';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger (in case it doesn't exist)
DROP TRIGGER IF EXISTS trigger_process_referral_first_order ON public.orders;
CREATE TRIGGER trigger_process_referral_first_order
    AFTER INSERT OR UPDATE OF status, payment_confirmed ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION process_referral_first_order();

-- Add comment
COMMENT ON FUNCTION process_referral_first_order() IS 'Updated to use process_referral_bonus() for wallet credits - bonuses now go to wallet instead of just aggregate tracking';

-- Migration complete
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 044_update_referral_trigger.sql completed';
    RAISE NOTICE '🎁 Referral bonuses now credit user wallets';
    RAISE NOTICE '💰 Both referrer and referred user get ₹100 in wallet';
END $$;
