// =====================================================
// REFERRAL SERVICE - CLIENT-SIDE OPERATIONS
// =====================================================

import { supabase } from '../../lib/supabase/client';
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
export async function getUserReferral(userId: string): Promise<Referral | null> {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user referral:', error);
    return null;
  }
}

// =====================================================
// GET USER'S REFERRAL STATS
// =====================================================
export async function getUserReferralStats(userId: string): Promise<ReferralStats | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_referral_stats', { p_user_id: userId })
      .single();

    if (error) {
      console.error('RPC Error - get_user_referral_stats:', error);
      throw error;
    }

    // The RPC returns JSONB data directly
    return data as ReferralStats;
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    return null;
  }
}

// =====================================================
// GET LIST OF USERS REFERRED BY THIS USER
// =====================================================
export async function getUserReferrals(userId: string): Promise<ReferredUser[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_referrals', { p_user_id: userId });

    if (error) throw error;
    return data || [];
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
    const { data, error } = await supabase
      .rpc('record_referral', {
        p_referred_user_id: params.referred_user_id,
        p_referral_code: params.referral_code.toUpperCase(),
        p_signup_source: params.signup_source || 'web',
        p_ip_address: params.ip_address || null,
        p_user_agent: params.user_agent || navigator.userAgent
      });

    if (error) throw error;
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
    const { data, error } = await supabase
      .rpc('validate_referral_code', { p_referral_code: code.toUpperCase() });

    if (error) {
      console.error('RPC Error - validate_referral_code:', error);
      return {
        valid: false,
        error: 'Failed to validate code'
      };
    }

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
    const { data, error } = await supabase
      .from('referral_leaderboard')
      .select('*')
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

// =====================================================
// CHECK IF USER WAS REFERRED
// =====================================================
export async function checkIfUserWasReferred(userId: string): Promise<{
  was_referred: boolean;
  referrer_name?: string;
  reward_pending?: number;
}> {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        referred_by_user_id,
        first_order_completed,
        own_reward_paid,
        referral_reward_amount
      `)
      .eq('user_id', userId)
      .single();

    if (error || !data || !data.referred_by_user_id) {
      return { was_referred: false };
    }

    // Get referrer's name
    const { data: referrerData } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', data.referred_by_user_id)
      .single();

    return {
      was_referred: true,
      referrer_name: referrerData?.name || 'A friend',
      reward_pending: data.first_order_completed && !data.own_reward_paid
        ? data.referral_reward_amount
        : 0
    };
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
