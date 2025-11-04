-- =====================================================
-- FIX ORDER STATUS ENUM
-- Add missing 'completed' status or ensure enum matches code
-- =====================================================

-- First, let's see what the current enum values are and add 'completed' if needed
-- Note: PostgreSQL doesn't allow modifying enums directly, so we need to:
-- 1. Add the new value if it doesn't exist
-- 2. Or update the referral trigger to use correct status values

-- Add 'completed' to order_status enum if it doesn't exist
DO $$ 
BEGIN
    -- Try to add 'completed' to the enum
    -- This will fail silently if it already exists
    BEGIN
        ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Status value "completed" already exists';
    END;
END $$;

-- Update the referral trigger to use correct status values
-- The trigger should check for 'processing' and 'delivered' instead of 'completed'
CREATE OR REPLACE FUNCTION process_referral_first_order()
RETURNS TRIGGER AS $$
DECLARE
    v_referred_user_record RECORD;
    v_is_first_order BOOLEAN;
BEGIN
    -- Only process for completed/paid orders
    -- Changed: Use 'processing' and 'delivered' instead of 'completed'
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
        
        -- If user was referred by someone, update referrer's stats
        IF v_referred_user_record.referred_by_user_id IS NOT NULL THEN
            UPDATE public.referrals
            SET successful_referrals = successful_referrals + 1,
                total_rewards_earned = total_rewards_earned + 100.00,
                updated_at = NOW()
            WHERE user_id = v_referred_user_record.referred_by_user_id;
            
            -- Create reward transaction for referrer
            INSERT INTO public.referral_transactions (
                user_id,
                transaction_type,
                amount,
                description,
                related_order_id,
                related_user_id
            ) VALUES (
                v_referred_user_record.referred_by_user_id,
                'reward_earned',
                100.00,
                'Referral reward for successful first order',
                NEW.id,
                NEW.user_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_process_referral_first_order ON public.orders;
CREATE TRIGGER trigger_process_referral_first_order
    AFTER INSERT OR UPDATE OF status, payment_confirmed ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION process_referral_first_order();

-- Add comment
COMMENT ON FUNCTION process_referral_first_order() IS 'Updated to use correct order status values: processing, delivered, shipped instead of completed';
