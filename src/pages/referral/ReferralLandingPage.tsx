// =====================================================
// REFERRAL LANDING PAGE - /referral/:code
// =====================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Gift, CheckCircle, Users, TrendingUp, ArrowRight, Sparkles } from 'lucide-react';
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-canyon mx-auto mb-4"></div>
          <p className="text-muted-foreground font-sans">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center p-4 font-sans">
        <Card className="max-w-md w-full border-coyote/30 shadow-lg">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Gift className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-serif text-dark mb-3">Invitation Expired</h2>
            <p className="text-muted-foreground mb-8 px-4">
              This referral link appears to be invalid or has expired. You can still join Cigarro and explore our premium collection.
            </p>
            <Button onClick={() => navigate('/')} className="w-full bg-dark hover:bg-black text-creme-light h-12 text-base">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-creme font-sans overflow-hidden relative">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-canyon/5 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-canyon/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 -left-20 w-72 h-72 bg-coyote/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 max-w-4xl relative z-10">
        <div className="text-center mb-16">
          {/* Invitation Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white border border-canyon/20 text-canyon px-4 py-1.5 rounded-full mb-8 shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span className="font-medium text-sm tracking-wide uppercase">Private Invitation</span>
          </motion.div>

          {/* Main Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-4xl md:text-6xl font-serif text-dark mb-6 leading-tight">
              {referrerName} has invited you to<br />
              <span className="text-canyon italic">Cigarro</span>
            </h1>
          </motion.div>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed font-serif italic"
          >
            "Experience the finest collection of premium tobacco. Accept this invitation to receive a <span className="font-bold text-canyon not-italic">₹100 credit</span> in your wallet upon your first order."
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              className="bg-canyon hover:bg-canyon/90 text-white text-lg px-12 py-8 h-auto shadow-xl hover:shadow-2xl transition-all duration-300 rounded-full group"
            >
              <span className="flex flex-col items-center">
                <span className="font-medium tracking-wide">Accept Invitation</span>
                <span className="text-xs opacity-90 font-normal mt-0.5">Join & Claim ₹100 Credit</span>
              </span>
              <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          <p className="text-sm text-muted-foreground mt-8 font-medium opacity-70">
            Invitation Code: <span className="font-mono tracking-wider text-dark">{code?.toUpperCase()}</span>
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            {
              icon: Gift,
              title: "Welcome Privilege",
              desc: "A ₹100 credit awaits in your wallet, unlocked immediately after your first successful delivery.",
              delay: 0.4
            },
            {
              icon: CheckCircle,
              title: "Curated Selection",
              desc: "Access an exclusive catalog of world-renowned cigarette brands and premium accessories.",
              delay: 0.5
            },
            {
              icon: TrendingUp,
              title: "Elite Rewards",
              desc: "Extend invitations to your own circle and earn ₹100 for every successful introduction.",
              delay: 0.6
            }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: item.delay }}
            >
              <Card className="h-full border border-coyote/20 bg-white/60 backdrop-blur hover:bg-white transition-all duration-500 hover:shadow-lg group">
                <CardContent className="pt-10 pb-10 text-center px-6">
                  <div className="w-14 h-14 bg-canyon/5 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                    <item.icon className="h-6 w-6 text-canyon opacity-80" />
                  </div>
                  <h3 className="font-serif text-xl text-dark mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <Card className="bg-white border border-coyote/10 shadow-xl shadow-canyon/5 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-canyon/40 to-transparent" />
            <CardContent className="pt-16 pb-16 px-8 md:px-16">
              <h3 className="text-3xl font-serif text-dark text-center mb-16">Your Journey Begins</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-10 relative">
                {/* Connecting Line (Desktop) */}
                <div className="hidden md:block absolute top-7 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-coyote/30 to-transparent z-0" />

                {[
                  { step: "1", title: "Join", desc: "Create your account" },
                  { step: "2", title: "Select", desc: "Choose your products" },
                  { step: "3", title: "Order", desc: "Secure your purchase" },
                  { step: "4", title: "Receive", desc: "Get ₹100 credit" }
                ].map((item, i) => (
                  <div key={i} className="text-center relative z-10 group">
                    <div className="w-14 h-14 bg-creme border border-coyote/30 text-dark rounded-full flex items-center justify-center mx-auto mb-6 font-serif font-medium text-lg shadow-sm group-hover:border-canyon group-hover:text-canyon transition-colors duration-300">
                      {item.step}
                    </div>
                    <h4 className="font-bold text-dark mb-2 text-base tracking-wide uppercase">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Final CTA */}
        <div className="text-center mt-20 mb-12">
          <Button 
            size="lg" 
            onClick={handleGetStarted}
            variant="outline"
            className="border-canyon text-canyon hover:bg-canyon hover:text-white px-12 py-6 h-auto rounded-full text-lg transition-all duration-300"
          >
            Claim Invitation
          </Button>
        </div>

        {/* Terms */}
        <div className="mt-12 text-center border-t border-coyote/10 pt-8 max-w-xl mx-auto">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Terms & Conditions Apply
          </p>
          <p className="text-xs text-muted-foreground/50 mt-2 leading-relaxed">
            Offer valid for new members only. Referral credit is applied automatically upon successful delivery of your first order. 
            Cigarro reserves the right to revoke invitations in cases of misuse.
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
