// =====================================================
// REFERRAL PAGE - USER REFERRAL DASHBOARD (ZEN REDESIGN)
// =====================================================

import { useState } from 'react';
import { useReferral } from '../../hooks/useReferral';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Copy, 
  Share2, 
  Users, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Wallet,
  ArrowRight,
  Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../components/ui/utils';

export default function ReferralPage() {
  const { stats, referredUsers, wasReferred, loading, copyLink, shareLink } = useReferral();
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleCopyLink = async () => {
    setCopying(true);
    const success = await copyLink();
    if (success) {
      toast.success('Invitation copied to clipboard');
    } else {
      toast.error('Failed to copy link');
    }
    setTimeout(() => setCopying(false), 1000);
  };

  const handleShareLink = async () => {
    setSharing(true);
    const success = await shareLink();
    if (!success) {
      toast.error('Failed to open share menu');
    }
    setSharing(false);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-creme">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-canyon/30 border-t-canyon rounded-full animate-spin" />
          <p className="text-canyon/60 font-serif italic">Loading your sanctuary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-creme text-dark font-sans selection:bg-canyon/20 overflow-hidden">
      {/* Ambient Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-coyote/5 rounded-full blur-[100px] mix-blend-multiply" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-canyon/5 rounded-full blur-[100px] mix-blend-multiply" />
      </div>

      <div className="container max-w-4xl mx-auto px-6 py-20 relative z-10">
        
        {/* Header Section */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/40 border border-white/60 backdrop-blur-sm text-xs uppercase tracking-widest text-canyon mb-6">
              <Sparkles className="w-3 h-3" />
              <span>The Circle</span>
            </span>
            <h1 className="font-serif text-5xl md:text-7xl text-dark mb-6 tracking-tight leading-[0.9]">
              Share the <br/>
              <span className="italic text-canyon">Ritual</span>
            </h1>
            <p className="font-sans text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed font-light">
              Invite friends to discover Cigarro. When they find their peace, you both receive <span className="font-medium text-dark">₹100</span> as a token of our gratitude.
            </p>
          </motion.div>
        </div>

        {/* Main Interaction Area - The Token */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-xl mx-auto mb-24"
        >
          <div className="relative group cursor-pointer" onClick={handleCopyLink}>
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-coyote/20 via-canyon/20 to-coyote/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-500 group-hover:-translate-y-1">
              <div className="flex flex-col items-center gap-6">
                <div className="text-center space-y-1">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Your Exclusive Code</p>
                  <div className="font-mono text-4xl md:text-5xl text-dark tracking-wider">
                    {stats?.referral_code || '...'}
                  </div>
                </div>
                
                <div className="flex gap-3 w-full max-w-xs">
                  <Button 
                    variant="outline" 
                    className={cn(
                      "flex-1 h-12 rounded-full border-coyote/20 bg-transparent hover:bg-coyote/5 transition-all duration-300 text-sm uppercase tracking-wide",
                      copying && "bg-green-50 border-green-200 text-green-700"
                    )}
                  >
                    {copying ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Copied
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Copy className="w-4 h-4" /> Copy
                      </span>
                    )}
                  </Button>
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareLink();
                    }}
                    className="flex-1 h-12 rounded-full bg-dark text-creme hover:bg-canyon transition-colors duration-300 text-sm uppercase tracking-wide shadow-lg hover:shadow-canyon/20"
                  >
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <p className="text-center text-xs text-muted-foreground mt-6 opacity-60">
            Tap the card to copy your code instantly
          </p>
        </motion.div>

        {/* Stats Grid - Zen Stones */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-24">
          {[
            { 
              label: "Earnings", 
              value: `₹${stats?.total_rewards_earned || 0}`, 
              icon: Wallet,
              delay: 0.3
            },
            { 
              label: "Network", 
              value: stats?.total_referrals || 0, 
              icon: Users,
              delay: 0.4 
            },
            { 
              label: "Completed", 
              value: stats?.successful_referrals || 0, 
              icon: CheckCircle2,
              delay: 0.5
            },
            { 
              label: "Pending", 
              value: stats?.pending_referrals || 0, 
              icon: Clock,
              delay: 0.6
            }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: stat.delay }}
              className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/30 border border-white/40 backdrop-blur-sm hover:bg-white/50 transition-colors duration-300"
            >
              <div className="mb-3 p-3 rounded-full bg-creme-light shadow-inner">
                <stat.icon className="w-5 h-5 text-canyon/70" />
              </div>
              <div className="font-serif text-2xl md:text-3xl text-dark mb-1">
                {stat.value}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* The Circle (Network List) */}
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-serif text-3xl text-dark">Your Circle</h3>
            <div className="h-px flex-1 bg-coyote/20 ml-8" />
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {referredUsers.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16 border border-dashed border-coyote/20 rounded-2xl bg-white/20"
                >
                  <div className="w-16 h-16 mx-auto bg-white/50 rounded-full flex items-center justify-center mb-4">
                    <Heart className="w-8 h-8 text-coyote/40" />
                  </div>
                  <p className="font-serif text-xl text-dark/60 mb-2">The circle is waiting</p>
                  <p className="text-sm text-muted-foreground font-light">
                    Share your light with others to begin.
                  </p>
                </motion.div>
              ) : (
                referredUsers.map((user, i) => (
                  <motion.div
                    key={user.referred_user_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="group flex items-center justify-between p-4 rounded-xl bg-white/40 border border-transparent hover:border-white/60 hover:bg-white/60 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-creme-light flex items-center justify-center font-serif text-canyon border border-coyote/10 shadow-sm group-hover:scale-110 transition-transform duration-300">
                        {user.referred_user_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-dark">{user.referred_user_name}</div>
                        <div className="text-xs text-muted-foreground font-light">
                          Joined {new Date(user.signup_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      {user.first_order_completed ? (
                        <Badge variant="secondary" className="bg-green-100/50 text-green-800 border-green-200/50 font-normal py-1 px-3">
                          +₹{user.reward_earned}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-coyote border-coyote/30 font-normal py-1 px-3 bg-transparent">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-20 text-xs text-muted-foreground/40 font-light max-w-md mx-auto leading-relaxed">
          <p>Rewards are credited to your wallet automatically once your friend completes their first delivery. Self-referrals are not part of the ritual.</p>
        </div>
      </div>
    </div>
  );
}
