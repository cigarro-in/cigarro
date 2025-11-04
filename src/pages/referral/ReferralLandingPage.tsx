// =====================================================
// REFERRAL LANDING PAGE - /referral/:code
// =====================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Gift, CheckCircle, Users, TrendingUp, ArrowRight } from 'lucide-react';
import { validateReferralCode } from '../../utils/referral/referralService';
import { AuthDialog } from '../../components/auth/AuthDialog';

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
          <p className="text-muted-foreground">Validating referral code...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-dark mb-2">Invalid Referral Code</h2>
            <p className="text-muted-foreground mb-6">
              This referral code is not valid or has expired.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-creme to-creme-light">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          {/* Invitation Badge */}
          <div className="inline-flex items-center gap-2 bg-canyon/10 text-canyon px-4 py-2 rounded-full mb-6">
            <Gift className="h-4 w-4" />
            <span className="font-medium">You've been invited!</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-5xl font-bold text-dark mb-4">
            {referrerName} invited you to join
            <br />
            <span className="text-canyon">Cigarro</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8">
            Sign up now and get <span className="font-bold text-canyon">₹100</span> after your first order!
          </p>

          {/* CTA Button */}
          <Button 
            size="lg" 
            onClick={handleGetStarted}
            className="bg-canyon hover:bg-canyon/90 text-lg px-8 py-6 h-auto"
          >
            Get Started & Claim ₹100
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <p className="text-sm text-muted-foreground mt-4">
            Referral Code: <span className="font-mono font-bold text-dark">{code?.toUpperCase()}</span>
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-2 border-canyon/20">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-canyon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="h-8 w-8 text-canyon" />
              </div>
              <h3 className="font-bold text-dark mb-2">₹100 Welcome Bonus</h3>
              <p className="text-sm text-muted-foreground">
                Get ₹100 credited to your wallet after completing your first order
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-canyon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-canyon" />
              </div>
              <h3 className="font-bold text-dark mb-2">Premium Products</h3>
              <p className="text-sm text-muted-foreground">
                Access to exclusive cigarette brands and premium collections
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 bg-canyon/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-canyon" />
              </div>
              <h3 className="font-bold text-dark mb-2">Earn More Rewards</h3>
              <p className="text-sm text-muted-foreground">
                Refer your friends and earn ₹100 for each successful referral
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="bg-white/50 backdrop-blur">
          <CardContent className="pt-6">
            <h3 className="text-2xl font-bold text-dark text-center mb-8">How It Works</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-canyon text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                  1
                </div>
                <h4 className="font-semibold text-dark mb-2">Sign Up</h4>
                <p className="text-sm text-muted-foreground">
                  Create your account using the referral code
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-canyon text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                  2
                </div>
                <h4 className="font-semibold text-dark mb-2">Browse Products</h4>
                <p className="text-sm text-muted-foreground">
                  Explore our premium cigarette collection
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-canyon text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                  3
                </div>
                <h4 className="font-semibold text-dark mb-2">Place Order</h4>
                <p className="text-sm text-muted-foreground">
                  Complete your first order successfully
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-canyon text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                  4
                </div>
                <h4 className="font-semibold text-dark mb-2">Get ₹100</h4>
                <p className="text-sm text-muted-foreground">
                  Receive ₹100 in your wallet automatically
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final CTA */}
        <div className="text-center mt-12">
          <p className="text-lg text-muted-foreground mb-4">
            Ready to get started?
          </p>
          <Button 
            size="lg" 
            onClick={handleGetStarted}
            className="bg-canyon hover:bg-canyon/90"
          >
            Join Now & Claim Your ₹100
          </Button>
        </div>

        {/* Terms */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">
            By signing up, you agree to our Terms of Service and Privacy Policy.
            <br />
            Referral bonus is credited after your first successful order.
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
