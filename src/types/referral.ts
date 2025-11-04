// =====================================================
// REFERRAL SYSTEM - TYPESCRIPT TYPES (SIMPLIFIED)
// =====================================================

export interface Referral {
  id: string;
  user_id: string;
  referral_code: string;
  
  // Referral Stats (as a referrer)
  total_referrals: number;
  successful_referrals: number;
  total_rewards_earned: number;
  
  // If this user was referred
  referred_by_user_id: string | null;
  referred_by_code: string | null;
  referral_reward_amount: number;
  
  // First Order Tracking
  first_order_completed: boolean;
  first_order_id: string | null;
  first_order_date: string | null;
  
  // Reward Status
  own_reward_paid: boolean;
  own_reward_paid_at: string | null;
  
  // Metadata
  signup_source: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface ReferralStats {
  referral_code: string;
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  total_rewards_earned: number;
  referral_link: string;
  own_reward_pending: number; // Amount pending for user if they were referred
}

export interface ReferredUser {
  referred_user_id: string;
  referred_user_email: string;
  referred_user_name: string;
  signup_date: string;
  first_order_completed: boolean;
  first_order_date: string | null;
  reward_earned: number;
}

export interface RecordReferralParams {
  referred_user_id: string;
  referral_code: string;
  signup_source?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface RecordReferralResponse {
  success: boolean;
  error?: string;
  referrer_id?: string;
  referrer_name?: string; // Name of person who referred them
}

export interface ReferralLeaderboard {
  user_id: string;
  user_name: string;
  email: string;
  referral_code: string;
  total_referrals: number;
  successful_referrals: number;
  total_rewards_earned: number;
  created_at: string;
}
