// =====================================================
// REFERRAL PAGE - USER REFERRAL DASHBOARD
// =====================================================

import { useState, useEffect } from 'react';
import { useReferral } from '../../hooks/useReferral';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { 
  Copy, 
  Share2, 
  Users, 
  CheckCircle, 
  Clock, 
  Sparkles,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ReferralPage() {
  const { stats, referredUsers, wasReferred, loading, copyLink, shareLink } = useReferral();
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleCopyLink = async () => {
    setCopying(true);
    const success = await copyLink();
    if (success) {
      toast.success('Referral link copied to clipboard!');
    } else {
      toast.error('Failed to copy link');
    }
    setCopying(false);
  };

  const handleShareLink = async () => {
    setSharing(true);
    const success = await shareLink();
    if (success) {
      toast.success('Shared successfully!');
    } else {
      toast.error('Failed to share');
    }
    setSharing(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-canyon mx-auto mb-4"></div>
          <p className="text-muted-foreground font-sans">Loading your referral dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-creme font-sans pb-20">
      {/* Header Section with Gradient Background */}
      <div className="relative bg-dark text-creme-light py-16 md:py-24 overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-canyon rounded-full blur-[128px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-coyote rounded-full blur-[128px]" />
        </div>

        <div className="container mx-auto px-4 relative z-10 max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 bg-canyon/20 border border-canyon/30 text-canyon-light px-3 py-1 rounded-full mb-4 text-sm font-medium"
              >
                <Sparkles className="h-4 w-4" />
                <span>Elite Rewards Program</span>
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl font-serif mb-4 tracking-tight"
              >
                Refer & Earn
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-creme-light/70 max-w-xl leading-relaxed font-light"
              >
                Invite your friends to join the Cigarro community. 
                They receive a special welcome, and you earn rewards for each successful introduction.
              </motion.p>
            </div>

            {/* Total Earnings Card - Floating */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-md border border-white/10 p-6 rounded-2xl min-w-[240px]"
            >
              <div className="flex items-center gap-3 mb-2 text-creme-light/80 text-sm uppercase tracking-wider">
                <Wallet className="h-4 w-4" />
                <span>Total Earned</span>
              </div>
              <div className="text-4xl font-serif text-white">
                ₹{stats?.total_rewards_earned || 0}
              </div>
              <div className="mt-2 text-xs text-creme-light/50">
                Lifetime earnings from referrals
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-8 relative z-20 max-w-6xl">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Referrals", value: stats?.total_referrals || 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Successful", value: stats?.successful_referrals || 0, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
            { label: "Pending", value: stats?.pending_referrals || 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + (i * 0.1) }}
            >
              <Card className="border-none shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-1">{stat.label}</p>
                    <p className="text-3xl font-serif text-dark">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Referral Tools */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Share Card */}
            <Card className="overflow-hidden border-coyote/20 shadow-lg">
              <div className="bg-gradient-to-r from-dark to-dark/95 p-6 text-creme-light">
                <h3 className="text-xl font-serif mb-1">Your Invitation Link</h3>
                <p className="text-creme-light/60 text-sm">Share this exclusive link with your network</p>
              </div>
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                  <div className="flex-1 bg-muted/30 border border-coyote/20 rounded-lg px-4 py-3 flex items-center justify-between group transition-colors hover:bg-muted/50 hover:border-coyote/40">
                    <code className="text-dark font-mono font-medium text-lg tracking-wide">
                      {stats?.referral_code || 'LOADING...'}
                    </code>
                    <span className="text-xs text-muted-foreground bg-white px-2 py-1 rounded border border-coyote/10">
                      CODE
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleCopyLink}
                      disabled={copying || !stats?.referral_code}
                      className="flex-1 border-coyote/30 hover:bg-coyote/10 hover:text-canyon h-auto py-3"
                    >
                      <Copy className="h-5 w-5 mr-2" />
                      {copying ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      size="lg"
                      onClick={handleShareLink}
                      disabled={sharing || !stats?.referral_code}
                      className="flex-1 bg-canyon hover:bg-canyon/90 text-white h-auto py-3 shadow-md hover:shadow-lg transition-all"
                    >
                      <Share2 className="h-5 w-5 mr-2" />
                      Share
                    </Button>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { step: "1", text: "Share your exclusive code" },
                    { step: "2", text: "Friends place first order" },
                    { step: "3", text: "Both receive ₹100 credit" },
                  ].map((item, i) => (
                    <div key={i} className="text-center relative">
                      <div className="w-8 h-8 bg-canyon/10 text-canyon rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-sm border border-canyon/20">
                        {item.step}
                      </div>
                      <p className="text-sm text-muted-foreground font-medium leading-tight px-2">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Referrals List */}
            <div className="space-y-4">
              <h3 className="text-xl font-serif text-dark px-1">Your Network</h3>
              <Card className="border-coyote/20 shadow-sm">
                <CardContent className="p-0">
                  {referredUsers.length === 0 ? (
                    <div className="text-center py-16 px-6">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <h4 className="text-lg font-medium text-dark mb-2">No referrals yet</h4>
                      <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                        Start building your network by sharing your invitation code with friends and colleagues.
                      </p>
                      <Button variant="outline" onClick={handleShareLink} className="border-canyon text-canyon hover:bg-canyon hover:text-white">
                        Invite Friends
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-coyote/10">
                      {referredUsers.map((user) => (
                        <div key={user.referred_user_id} className="p-5 hover:bg-muted/5 transition-colors flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-canyon/20 to-coyote/20 flex items-center justify-center text-canyon font-serif text-lg">
                              {user.referred_user_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-dark text-base">
                                {user.referred_user_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Joined {new Date(user.signup_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            {user.first_order_completed ? (
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal">
                                  <CheckCircle className="h-3 w-3 mr-1.5" />
                                  Completed
                                </Badge>
                                <span className="text-xs font-medium text-green-600">+₹{user.reward_earned}</span>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 font-normal">
                                <Clock className="h-3 w-3 mr-1.5" />
                                Pending Order
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Status & Info */}
          <div className="space-y-6">
            {/* Referred By Status */}
            {wasReferred.was_referred && (
              <Card className="border-none shadow-lg bg-gradient-to-br from-dark to-[#2a2420] text-creme-light overflow-hidden relative">
                {/* Decorative shine */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                      <Sparkles className="h-6 w-6 text-creme-light" />
                    </div>
                    <div>
                      <p className="text-creme-light/60 text-xs uppercase tracking-widest mb-1">Invited By</p>
                      <h3 className="text-xl font-serif text-white mb-1">
                        {wasReferred.referrer_name}
                      </h3>
                      <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified Invitation
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                    {wasReferred.reward_pending && wasReferred.reward_pending > 0 ? (
                      <div className="space-y-2">
                         <div className="flex justify-between items-center text-sm">
                           <span className="text-creme-light/70">Status</span>
                           <span className="text-amber-400 font-medium">Pending Action</span>
                         </div>
                         <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                           <div className="h-full w-1/2 bg-amber-400 rounded-full" />
                         </div>
                         <p className="text-xs text-creme-light/60 pt-1">
                           Complete your first order to unlock your <span className="text-white font-bold">₹{wasReferred.reward_pending}</span> welcome bonus.
                         </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">Bonus Claimed</p>
                          <p className="text-xs text-creme-light/60">₹100 credited to wallet</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Terms Card */}
            <Card className="bg-muted/30 border-none shadow-inner">
              <CardContent className="p-6">
                <h4 className="font-serif text-dark mb-4 text-sm uppercase tracking-wider">Program Terms</h4>
                <ul className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                  <li className="flex gap-2 items-start">
                    <div className="w-1 h-1 rounded-full bg-canyon mt-1.5 shrink-0" />
                    <span>Referrer and referee both receive ₹100 credit.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <div className="w-1 h-1 rounded-full bg-canyon mt-1.5 shrink-0" />
                    <span>Rewards unlocked after referee's first successful delivery.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <div className="w-1 h-1 rounded-full bg-canyon mt-1.5 shrink-0" />
                    <span>Credits are automatically added to your Cigarro Wallet.</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <div className="w-1 h-1 rounded-full bg-canyon mt-1.5 shrink-0" />
                    <span>Self-referrals are strictly prohibited and monitored.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
