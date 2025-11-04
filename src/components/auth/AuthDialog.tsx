import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Chrome } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { validateEmail, validatePassword, validateName, authRateLimiter } from '../../utils/validation';
import { supabase } from '../../utils/supabase/client';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess?: () => void;
  context?: 'checkout' | 'general';
}

export function AuthDialog({ open, onOpenChange, onAuthSuccess, context = 'general' }: AuthDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [isVisible, setIsVisible] = useState(false);
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

  // Prevent flicker by managing visibility
  React.useEffect(() => {
    if (open) {
      setIsVisible(true);
    } else {
      // Delay hiding to allow exit animation
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!isVisible) return null;

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
      // Enhanced error handling for better user experience
      const errorMessage = error?.message || '';
      
      if (errorMessage.includes('Password should be at least')) {
        toast.error('Password must be at least 6 characters long');
      } else if (errorMessage.includes('Email address already in use') || 
                 errorMessage.includes('User already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else if (errorMessage.includes('invalid') && errorMessage.includes('email')) {
        toast.error('Please enter a valid email address. Try using a real email format like user@example.com');
      } else if (errorMessage.includes('SignUp not allowed for new users')) {
        toast.error('New user registration is currently disabled. Please contact support.');
      } else if (errorMessage.includes('Only an email address is accepted as an email') || 
                 errorMessage.includes('Email address') && errorMessage.includes('invalid')) {
        toast.error('Please use a valid email address. Avoid generic test emails.');
      } else {
        // Log the full error for debugging while showing a generic message
        console.error('Signup error details:', error);
        toast.error('Failed to create account. Please try again or contact support.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      // User will be redirected to Google OAuth page
      // After successful auth, they'll be redirected back to the app
    } catch (error: any) {
      toast.error(error?.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-creme border border-coyote rounded-lg max-w-2xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] sm:max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="font-serif font-normal text-2xl sm:text-3xl lg:text-4xl text-center text-dark tracking-tight leading-tight">
            {context === 'checkout' ? 'Complete Your Order' : 'Welcome'}
          </DialogTitle>
          <DialogDescription className="font-sans text-center text-coyote text-sm sm:text-base lg:text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
            {context === 'checkout' 
              ? 'Sign in to your account or create a new one to proceed with checkout and complete your order.'
              : 'Sign in to your account or create a new one to access our curated tobacco collection.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <Tabs defaultValue="signin" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-secondary border border-coyote/20 rounded-lg h-12 mb-6">
              <TabsTrigger 
                value="signin" 
                className="font-sans text-sm font-medium text-dark data-[state=active]:bg-dark data-[state=active]:text-creme-light data-[state=active]:shadow-sm transition-all duration-200"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger 
                value="signup" 
                className="font-sans text-sm font-medium text-dark data-[state=active]:bg-dark data-[state=active]:text-creme-light data-[state=active]:shadow-sm transition-all duration-200"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-6">
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSignIn}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="font-sans text-dark text-sm sm:text-base lg:text-lg font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-coyote" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      className="pl-10 sm:pl-12 lg:pl-14 h-10 sm:h-12 lg:h-14 text-sm sm:text-base lg:text-lg bg-creme-light border-2 border-coyote rounded-lg font-sans text-dark placeholder:text-coyote focus:border-dark transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="font-sans text-dark text-sm sm:text-base lg:text-lg font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-coyote" />
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                      className="pl-10 sm:pl-12 lg:pl-14 pr-10 sm:pr-12 lg:pr-14 h-10 sm:h-12 lg:h-14 text-sm sm:text-base lg:text-lg bg-creme-light border-2 border-coyote rounded-lg font-sans text-dark placeholder:text-coyote focus:border-dark transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-coyote hover:text-dark transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 sm:h-12 lg:h-14 bg-dark text-creme-light font-sans font-medium text-sm sm:text-base lg:text-lg rounded-lg hover:bg-creme-light hover:text-dark transition-all duration-300 group mt-8 shadow-lg hover:shadow-xl"
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ml-2 sm:ml-3 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-coyote/30"></div>
                </div>
                <div className="relative flex justify-center text-xs sm:text-sm uppercase">
                  <span className="bg-creme px-2 text-coyote font-sans">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="w-full h-10 sm:h-12 lg:h-14 bg-white border-2 border-coyote text-dark font-sans font-medium text-sm sm:text-base lg:text-lg rounded-lg hover:bg-creme-light transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <Chrome className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mr-2 sm:mr-3" />
                {isLoading ? 'Connecting...' : 'Sign in with Google'}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-6">
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSignUp}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="font-sans text-dark text-sm sm:text-base lg:text-lg font-medium">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-coyote" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      className="pl-10 sm:pl-12 lg:pl-14 h-10 sm:h-12 lg:h-14 text-sm sm:text-base lg:text-lg bg-creme-light border-2 border-coyote rounded-lg font-sans text-dark placeholder:text-coyote focus:border-dark transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="font-sans text-dark text-sm sm:text-base lg:text-lg font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-coyote" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      className="pl-10 sm:pl-12 lg:pl-14 h-10 sm:h-12 lg:h-14 text-sm sm:text-base lg:text-lg bg-creme-light border-2 border-coyote rounded-lg font-sans text-dark placeholder:text-coyote focus:border-dark transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="font-sans text-dark text-sm sm:text-base lg:text-lg font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-coyote" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password (min. 6 characters)"
                      value={formData.password}
                      onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                      className="pl-10 sm:pl-12 lg:pl-14 pr-10 sm:pr-12 lg:pr-14 h-10 sm:h-12 lg:h-14 text-sm sm:text-base lg:text-lg bg-creme-light border-2 border-coyote rounded-lg font-sans text-dark placeholder:text-coyote focus:border-dark transition-colors"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-coyote hover:text-dark transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />}
                    </button>
                  </div>
                </div>


                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 sm:h-12 lg:h-14 bg-dark text-creme-light font-sans font-medium text-sm sm:text-base lg:text-lg rounded-lg hover:bg-creme-light hover:text-dark transition-all duration-300 group mt-8 shadow-lg hover:shadow-xl"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ml-2 sm:ml-3 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-coyote/30"></div>
                </div>
                <div className="relative flex justify-center text-xs sm:text-sm uppercase">
                  <span className="bg-creme px-2 text-coyote font-sans">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="w-full h-10 sm:h-12 lg:h-14 bg-white border-2 border-coyote text-dark font-sans font-medium text-sm sm:text-base lg:text-lg rounded-lg hover:bg-creme-light transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <Chrome className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mr-2 sm:mr-3" />
                {isLoading ? 'Connecting...' : 'Sign up with Google'}
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <div className="text-center px-6 sm:px-8 py-4 sm:py-6 border-t border-coyote mt-8">
          {context === 'checkout' && (
            <div className="mb-4">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                I'm Just Browsing
              </Button>
            </div>
          )}
          <p className="font-sans text-sm sm:text-base lg:text-lg text-coyote leading-relaxed">
            By continuing, you agree to our Terms of Service and confirm you are of legal smoking age.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
