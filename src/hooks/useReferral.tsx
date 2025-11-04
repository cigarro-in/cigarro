// =====================================================
// REFERRAL HOOK - REACT HOOK FOR REFERRAL MANAGEMENT
// =====================================================

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import type { ReferralStats, ReferredUser } from '../types/referral';
import {
  getUserReferralStats,
  getUserReferrals,
  copyReferralLink,
  shareReferralLink,
  checkIfUserWasReferred
} from '../utils/referral/referralService';

export function useReferral() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [wasReferred, setWasReferred] = useState<{
    was_referred: boolean;
    referrer_name?: string;
    reward_pending?: number;
  }>({ was_referred: false });

  // Load referral data
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadReferralData();
  }, [user]);

  const loadReferralData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [statsData, referralsData, referredStatus] = await Promise.all([
        getUserReferralStats(user.id),
        getUserReferrals(user.id),
        checkIfUserWasReferred(user.id)
      ]);

      setStats(statsData);
      setReferredUsers(referralsData);
      setWasReferred(referredStatus);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Copy referral link
  const copyLink = async (): Promise<boolean> => {
    if (!stats?.referral_code) return false;
    return await copyReferralLink(stats.referral_code);
  };

  // Share referral link
  const shareLink = async (): Promise<boolean> => {
    if (!stats?.referral_code) return false;
    return await shareReferralLink(stats.referral_code);
  };

  // Refresh data
  const refresh = () => {
    loadReferralData();
  };

  return {
    stats,
    referredUsers,
    wasReferred,
    loading,
    copyLink,
    shareLink,
    refresh
  };
}
