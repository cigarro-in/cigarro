import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { recordReferral, checkIfUserWasReferred } from '../../utils/referral/referralService';
import { toast } from 'sonner';

export function ReferralTracker() {
  const { user } = useAuth();

  useEffect(() => {
    const checkAndRecordReferral = async () => {
      if (!user) return;

      // Check if there's a referral code pending in session
      const referralCode = sessionStorage.getItem('referral_code');
      if (!referralCode) return;

      try {
        // Check if user is already referred
        const { was_referred } = await checkIfUserWasReferred(user.id);
        
        if (!was_referred) {
          console.log('🔗 Found pending referral code:', referralCode);
          
          // Record the referral
          const result = await recordReferral({
            referred_user_id: user.id,
            referral_code: referralCode,
            signup_source: 'web_tracker'
          });

          if (result.success) {
            if (result.referrer_name) {
              toast.success(`Referral applied! You'll get ₹100 after your first order, referred by ${result.referrer_name}`);
            } else {
              toast.success('Referral code applied successfully!');
            }
            // Only clear if successful
            sessionStorage.removeItem('referral_code');
          } else {
             // If error is "already referred", clear it too
             if (result.error?.includes('already referred') || result.error?.includes('Cannot refer yourself')) {
                sessionStorage.removeItem('referral_code');
             }
             console.log('Referral record result:', result);
          }
        } else {
          // Already referred, clear the code
          sessionStorage.removeItem('referral_code');
        }
      } catch (error) {
        console.error('Error in ReferralTracker:', error);
      }
    };

    checkAndRecordReferral();
  }, [user]);

  return null; // Invisible component
}
