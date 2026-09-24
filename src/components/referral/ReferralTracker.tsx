import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { recordReferral, checkIfUserWasReferred } from '../../utils/referral/referralService';

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
          // Record the referral
          const result = await recordReferral({
            referred_user_id: user.id,
            referral_code: referralCode,
            signup_source: 'web_tracker'
          });

          if (result.success) {
            // No status: background tracker, renders null — the wallet credit is the confirmation.
            // Only clear if successful
            sessionStorage.removeItem('referral_code');
          } else {
             // If error is "already referred", clear it too
             if (result.error?.includes('already referred') || result.error?.includes('Cannot refer yourself')) {
                sessionStorage.removeItem('referral_code');
             }
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
