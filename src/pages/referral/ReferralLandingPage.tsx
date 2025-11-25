// =====================================================
// REFERRAL LANDING PAGE - /referral/:code (ZEN REDESIGN)
// =====================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Sparkles, ArrowRight, Gift, Leaf, Heart } from 'lucide-react';
import { validateReferralCode } from '../../utils/referral/referralService';
import { AuthDialog } from '../../components/auth/AuthDialog';
import { motion } from 'framer-motion';

export default function ReferralLandingPage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [validating, setValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [referrerName, setReferrerName] = useState('A friend');
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    if (code) {
      validateCode();
    }
  }, [code]);

  // Store referral code in sessionStorage for signup
  useEffect(() => {
    if (code && isValid) {
      sessionStorage.setItem('referral_code', code.toUpperCase());
    }
  }, [code, isValid]);

  const validateCode = async () => {
    if (!code) {
      setValidating(false);
      return;
    }

    setValidating(true);
    const result = await validateReferralCode(code);
    
    setIsValid(result.valid);
    if (result.referrer_name) {
      setReferrerName(result.referrer_name);
    }
    setValidating(false);
  };

  const handleGetStarted = () => {
    if (user) {
      // User is already logged in, redirect to home
      navigate('/');
    } else {
      // Show signup dialog
      setShowAuthDialog(true);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-canyon/30 border-t-canyon rounded-full animate-spin" />
          <p className="text-canyon/60 font-serif italic">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-coyote/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Leaf className="h-8 w-8 text-coyote" />
          </div>
          <h2 className="text-3xl font-serif text-dark">Invitation Expired</h2>
          <p className="text-muted-foreground leading-relaxed">
            This path appears to have closed. However, the sanctuary is always open for you to explore.
          </p>
          <Button onClick={() => navigate('/')} className="bg-dark hover:bg-black text-creme-light rounded-full px-8 py-6">
            Enter Cigarro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-creme font-sans overflow-hidden relative selection:bg-canyon/20">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-white/60 to-transparent opacity-60" />
        <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-coyote/5 rounded-full blur-[100px] mix-blend-multiply" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-canyon/5 rounded-full blur-[100px] mix-blend-multiply" />
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20 max-w-4xl relative z-10">
        <div className="text-center mb-24">
          {/* Invitation Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/40 border border-white/60 backdrop-blur-sm text-xs uppercase tracking-widest text-canyon mb-8">
              <Sparkles className="w-3 h-3" />
              <span>Private Invitation</span>
            </span>
            
            <h1 className="text-5xl md:text-7xl font-serif text-dark mb-8 leading-[0.95] tracking-tight">
              <span className="block text-2xl md:text-3xl mb-4 font-sans font-light text-muted-foreground tracking-normal">
                {referrerName} invites you to
              </span>
              The <span className="italic text-canyon">Ritual</span>
            </h1>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl mx-auto"
          >
            <p className="text-xl text-dark/80 mb-12 leading-relaxed font-serif italic">
              "Discover a curated collection of premium tobacco. Accept this invitation to begin your journey with a <span className="font-semibold text-canyon not-italic">₹100 gift</span> for your first order."
            </p>

            {/* CTA Button */}
            <Button 
              onClick={handleGetStarted}
              className="group relative overflow-hidden bg-dark hover:bg-canyon text-creme text-lg px-10 py-8 rounded-full transition-all duration-500 shadow-xl hover:shadow-canyon/20 hover:-translate-y-1"
            >
              <span className="relative z-10 flex items-center gap-3">
                <span>Accept Invitation</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
            
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground/50 uppercase tracking-widest">
              <span>Code:</span>
              <span className="font-mono text-dark/80 bg-white/50 px-2 py-1 rounded border border-coyote/10">
                {code?.toUpperCase()}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Zen Pillars (Benefits) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
          {[
            {
              icon: Gift,
              title: "The Gift",
              desc: "Receive ₹100 in your wallet upon your first delivery.",
              delay: 0.4
            },
            {
              icon: Leaf,
              title: "The Selection",
              desc: "Access our curated catalog of world-renowned brands.",
              delay: 0.5
            },
            {
              icon: Heart,
              title: "The Circle",
              desc: "Extend invitations to others and grow your rewards.",
              delay: 0.6
            }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: item.delay }}
              className="text-center group"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/40 border border-white/60 flex items-center justify-center group-hover:bg-white/80 transition-colors duration-500 shadow-sm">
                <item.icon className="w-6 h-6 text-canyon/80" />
              </div>
              <h3 className="font-serif text-2xl text-dark mb-3">{item.title}</h3>
              <p className="text-muted-foreground leading-relaxed font-light px-4">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* The Journey Path */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="relative py-20 border-t border-coyote/10"
        >
          <h3 className="text-center font-serif text-3xl text-dark mb-16">Your Path</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-6 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-coyote/30 to-transparent" />

            {[
              { step: "01", title: "Join", desc: "Create account" },
              { step: "02", title: "Choose", desc: "Select products" },
              { step: "03", title: "Order", desc: "Secure delivery" },
              { step: "04", title: "Receive", desc: "Get ₹100 credit" }
            ].map((item, i) => (
              <div key={i} className="text-center relative z-10">
                <div className="w-12 h-12 mx-auto bg-creme border border-coyote/20 rounded-full flex items-center justify-center mb-4 font-serif text-canyon text-lg shadow-[0_0_0_8px_var(--color-creme)]">
                  {item.step}
                </div>
                <h4 className="font-medium text-dark uppercase tracking-wide text-sm mb-1">{item.title}</h4>
                <p className="text-xs text-muted-foreground font-light">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Final Whisper */}
        <div className="text-center mt-12">
           <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">
             Invitation valid for new members only
           </p>
        </div>
      </div>

      {/* Auth Dialog */}
      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
      />
    </div>
  );
}
