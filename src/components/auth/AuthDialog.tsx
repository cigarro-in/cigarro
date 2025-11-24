import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Chrome, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { validateEmail, validatePassword, validateName, authRateLimiter } from '../../utils/validation';
import { supabase } from '../../lib/supabase/client';
import { BottomDrawer } from '../ui/BottomDrawer';
import { Link } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess?: () => void;
  context?: 'checkout' | 'general';
}

// Proper Google Logo Component
const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export function AuthDialog({ open, onOpenChange, onAuthSuccess, context = 'general' }: AuthDialogProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    name: string;
  }>({
    email: '',
    password: '',
    name: '',
  });

  const { signIn, signUp, signInWithGoogle } = useAuth();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limiting check
    const clientId = 'auth_' + (formData.email || 'unknown');
    if (!authRateLimiter.isAllowed(clientId)) {
      const resetTime = new Date(authRateLimiter.getResetTime(clientId));
      toast.error(`Too many attempts. Please try again after ${resetTime.toLocaleTimeString()}`);
      return;
    }
    
    // Validate inputs
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      toast.error(emailValidation.error);
      return;
    }
    
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.error);
      return;
    }
    
    setIsLoading(true);
    try {
      await signIn(emailValidation.sanitizedValue!, passwordValidation.sanitizedValue!);
      toast.success('Welcome back!');
      onOpenChange(false);
      onAuthSuccess?.();
    } catch (error: any) {
      // Provide more specific error messages
      if (error?.message?.includes('Invalid login credentials')) {
        toast.error('Invalid email or password. Please try again.');
      } else {
        toast.error(error?.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limiting check
    const clientId = 'auth_' + (formData.email || 'unknown');
    if (!authRateLimiter.isAllowed(clientId)) {
      const resetTime = new Date(authRateLimiter.getResetTime(clientId));
      toast.error(`Too many attempts. Please try again after ${resetTime.toLocaleTimeString()}`);
      return;
    }
    
    // Validate all inputs
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      toast.error(emailValidation.error);
      return;
    }
    
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.error);
      return;
    }
    
    const nameValidation = validateName(formData.name, 'Name');
    if (!nameValidation.isValid) {
      toast.error(nameValidation.error);
      return;
    }
    
    setIsLoading(true);
    try {
      await signUp(
        emailValidation.sanitizedValue!, 
        passwordValidation.sanitizedValue!, 
        nameValidation.sanitizedValue!
      );
      
      // Check if there's a referral code in sessionStorage
      const referralCode = sessionStorage.getItem('referral_code');
      if (referralCode) {
        // Get the current user after signup
        const { data: { user: newUser } } = await supabase.auth.getUser();
        
        if (newUser) {
          // Import recordReferral dynamically to avoid circular dependencies
          const { recordReferral } = await import('../../utils/referral/referralService');
          const result = await recordReferral({
            referred_user_id: newUser.id,
            referral_code: referralCode,
            signup_source: 'web'
          });
          
          if (result.success && result.referrer_name) {
            toast.success(`Account created! You'll get ₹100 after your first order, referred by ${result.referrer_name}`);
          } else {
            toast.success('Account created successfully!');
          }
          
          // Clear the referral code from sessionStorage
          sessionStorage.removeItem('referral_code');
        } else {
          toast.success('Account created successfully!');
        }
      } else {
        toast.success('Account created successfully!');
      }
      
      onOpenChange(false);
      onAuthSuccess?.();
    } catch (error: any) {
      const errorMessage = error?.message || '';
      
      if (errorMessage.includes('Password should be at least')) {
        toast.error('Password must be at least 6 characters long');
      } else if (errorMessage.includes('Email address already in use') || 
                 errorMessage.includes('User already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        console.error('Signup error details:', error);
        toast.error('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  if (isMobile) {
    return (
      <BottomDrawer
        open={open}
        onOpenChange={onOpenChange}
        className="h-auto min-h-[280px]"
        showCloseButton={false}
      >
        <div className="flex flex-col h-full p-6 pb-10 bg-creme">
          <div className="flex-1 flex flex-col justify-center gap-8 mt-4">
              {/* Description or Prompt */}
              <div className="space-y-1 text-center">
                  <p className="font-sans text-dark/80 text-lg font-medium">
                      Please login to continue with your order
                  </p>
              </div>

              {/* Google Login Button - Styled as White Card with Border */}
              <Button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full h-14 bg-white hover:bg-gray-50 text-dark border border-coyote/30 font-sans font-medium text-base rounded-lg shadow-sm flex items-center justify-center gap-3 transition-all hover:shadow-md"
              >
                  {isLoading ? (
                      <span>Connecting...</span>
                  ) : (
                      <>
                          <GoogleLogo />
                          <span>Continue with Google</span>
                      </>
                  )}
              </Button>

              {/* Terms Footer */}
              <p className="text-center text-xs text-dark/50 font-sans mt-2 leading-relaxed">
                  By clicking, I accept the{' '}
                  <Link 
                      to="/terms" 
                      className="font-bold text-dark/80 hover:underline"
                      onClick={() => onOpenChange(false)}
                  >
                      Terms & Conditions
                  </Link>
                  {' '}&{' '}
                  <Link 
                      to="/privacy" 
                      className="font-bold text-dark/80 hover:underline"
                      onClick={() => onOpenChange(false)}
                  >
                      Privacy Policy
                  </Link>
              </p>
          </div>
        </div>
      </BottomDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-creme border border-coyote rounded-lg max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="font-serif font-normal text-3xl text-center text-dark tracking-tight">
            {context === 'checkout' ? 'Complete Your Order' : 'Welcome Back'}
          </DialogTitle>
          <DialogDescription className="font-sans text-center text-coyote mt-2">
            Sign in to access your account
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          <Tabs defaultValue="signin" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-creme-light border border-coyote/20 rounded-lg h-12 mb-6">
              <TabsTrigger 
                value="signin" 
                className="font-sans text-sm font-medium text-dark data-[state=active]:bg-dark data-[state=active]:text-creme-light transition-all duration-200"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger 
                value="signup" 
                className="font-sans text-sm font-medium text-dark data-[state=active]:bg-dark data-[state=active]:text-creme-light transition-all duration-200"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-coyote" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="pl-10 bg-white border-coyote/30"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-coyote" />
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="pl-10 pr-10 bg-white border-coyote/30"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-coyote hover:text-dark"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-dark text-creme-light hover:bg-canyon" disabled={isLoading}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-coyote" />
                    <Input
                      id="signup-name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="pl-10 bg-white border-coyote/30"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-coyote" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="pl-10 bg-white border-coyote/30"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-coyote" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="pl-10 pr-10 bg-white border-coyote/30"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-coyote hover:text-dark"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-dark text-creme-light hover:bg-canyon" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-coyote/30"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-creme px-2 text-coyote">Or continue with</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleGoogleSignIn}
              className="w-full bg-white border-coyote/30 hover:bg-gray-50 gap-2"
              disabled={isLoading}
            >
              <GoogleLogo />
              Continue with Google
            </Button>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
