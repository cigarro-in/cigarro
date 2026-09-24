// =====================================================
// REFERRAL SERVICE - CLIENT-SIDE OPERATIONS (Convex-backed)
// =====================================================

import { convex } from '../../lib/convex/client';
import { api } from '../../../convex/_generated/api';
import { ORG_SLUG } from '../../lib/convex/org';
import type {
  Referral,
  ReferralStats,
  ReferredUser,
  RecordReferralParams,
  RecordReferralResponse,
  ReferralLeaderboard
} from '../../types/referral';

// =====================================================
// GET USER'S REFERRAL DATA
// =====================================================
export async function getUserReferral(_userId: string): Promise<Referral | null> {
  try {
    return await convex.query(api.referrals.getMyReferral, { orgSlug: ORG_SLUG });
  } catch (error) {
    console.error('Error fetching user referral:', error);
    return null;
  }
}

// =====================================================
// GET USER'S REFERRAL STATS
// =====================================================
export async function getUserReferralStats(_userId: string): Promise<ReferralStats | null> {
  try {
    // Existing users may never have visited the referral page before. Mint
    // their code lazily so the dashboard is usable for them as well.
    await convex.mutation(api.referrals.ensureMyReferral, { orgSlug: ORG_SLUG });
    const stats = await convex.query(api.referrals.getReferralStats, { orgSlug: ORG_SLUG });
    if (!stats) return null;
    if (!stats.referral_link && stats.referral_code) {
      stats.referral_link = generateReferralLink(stats.referral_code);
    }
    return stats as ReferralStats;
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    return null;
  }
}

// =====================================================
// GET LIST OF USERS REFERRED BY THIS USER
// =====================================================
export async function getUserReferrals(_userId: string): Promise<ReferredUser[]> {
  try {
    return await convex.query(api.referrals.getReferredUsers, { orgSlug: ORG_SLUG });
  } catch (error) {
    console.error('Error fetching user referrals:', error);
    return [];
  }
}

// =====================================================
// RECORD REFERRAL RELATIONSHIP (Called during signup)
// =====================================================
export async function recordReferral(
  params: RecordReferralParams
): Promise<RecordReferralResponse> {
  try {
    const data = await convex.mutation(api.referrals.recordReferral, {
      orgSlug: ORG_SLUG,
      referredUserId: params.referred_user_id,
      referralCode: params.referral_code.toUpperCase(),
      signupSource: params.signup_source || 'web',
      ipAddress: params.ip_address || undefined,
      userAgent: params.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
    });
    return data;
  } catch (error) {
    console.error('Error recording referral:', error);
    return {
      success: false,
      error: 'Failed to record referral'
    };
  }
}

// =====================================================
// VALIDATE REFERRAL CODE
// =====================================================
export async function validateReferralCode(code: string): Promise<{
  valid: boolean;
  referrer_name?: string;
  error?: string;
}> {
  try {
    const data = await convex.query(api.referrals.validateReferralCode, {
      code: code.toUpperCase(),
      orgSlug: ORG_SLUG,
    });
    return data || {
      valid: false,
      error: 'Invalid referral code'
    };
  } catch (error) {
    console.error('Error validating referral code:', error);
    return {
      valid: false,
      error: 'Failed to validate code'
    };
  }
}

// =====================================================
// GET REFERRAL LEADERBOARD
// =====================================================
export async function getReferralLeaderboard(limit: number = 10): Promise<ReferralLeaderboard[]> {
  try {
    return await convex.query(api.referrals.getLeaderboard, { limit, orgSlug: ORG_SLUG });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

// =====================================================
// CHECK IF USER WAS REFERRED
// =====================================================
export async function checkIfUserWasReferred(_userId: string): Promise<{
  was_referred: boolean;
  referrer_name?: string;
  reward_pending?: number;
}> {
  try {
    return await convex.query(api.referrals.checkIfReferred, { orgSlug: ORG_SLUG });
  } catch (error) {
    console.error('Error checking referral status:', error);
    return { was_referred: false };
  }
}

// =====================================================
// GENERATE SHAREABLE REFERRAL LINK
// =====================================================
export function generateReferralLink(referralCode: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/referral/${referralCode}`;
}

// =====================================================
// COPY REFERRAL LINK TO CLIPBOARD
// =====================================================
export async function copyReferralLink(referralCode: string): Promise<boolean> {
  try {
    const link = generateReferralLink(referralCode);
    await navigator.clipboard.writeText(link);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
}

// =====================================================
// SHARE REFERRAL LINK (Mobile Share API)
// =====================================================
export async function shareReferralLink(referralCode: string): Promise<boolean> {
  try {
    const link = generateReferralLink(referralCode);

    if (navigator.share) {
      await navigator.share({
        title: 'Join Cigarro',
        text: `Join Cigarro using my referral code ${referralCode} and get ₹100 after your first order!`,
        url: link
      });
      return true;
    } else {
      // Fallback to copy
      return await copyReferralLink(referralCode);
    }
  } catch (error) {
    console.error('Error sharing link:', error);
    return false;
  }
}
