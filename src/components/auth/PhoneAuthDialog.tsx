import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader2, ArrowRight, ArrowLeft, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useOTPWidget } from '../../hooks/useOTPWidget';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess?: () => void;
}

export function PhoneAuthDialog({ open, onOpenChange, onAuthSuccess }: Props) {
  const { signInWithPhone, user } = useAuth();
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsName, setNeedsName] = useState(false);

  const handleOTPSuccess = useCallback(
    async (_phone: string, countryCode: string, token: string) => {
      if (!token) {
        toast.error('No verification token received');
        return;
      }
      setSubmitting(true);
      try {
        const result = await signInWithPhone({ phone: phoneInput, token, countryCode });
        if (result.isNewUser) {
          setNeedsName(true);
          setSubmitting(false);
          return;
        }
        toast.success('Welcome back!');
        onOpenChange(false);
        onAuthSuccess?.();
        reset();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sign-in failed';
        toast.error(msg);
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signInWithPhone, onOpenChange, onAuthSuccess, phoneInput]
  );

  const otp = useOTPWidget({
    onSuccess: handleOTPSuccess,
    onError: (err) => toast.error(err),
  });

  const reset = () => {
    setPhoneInput('');
    setOtpInput('');
    setName('');
    setNeedsName(false);
    otp.reset();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }
    otp.sendOTP(cleaned);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.length < 4) {
      toast.error('Enter the OTP');
      return;
    }
    otp.verifyOTP(otpInput);
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Please enter your name');
      return;
    }
    if (!user?.id) {
      toast.error('Session missing — please sign in again');
      reset();
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from('profiles').update({ name: trimmed }).eq('id', user.id);
      await supabase.auth.updateUser({ data: { name: trimmed } });
      toast.success('Account created!');
      onOpenChange(false);
      onAuthSuccess?.();
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save name');
    } finally {
      setSubmitting(false);
    }
  };

  const title = needsName
    ? 'Almost there'
    : otp.step === 'otp'
    ? 'Verify OTP'
    : 'Sign in';
  const description = needsName
    ? 'What should we call you?'
    : otp.step === 'otp'
    ? `Enter the OTP sent to +91${phoneInput}`
    : "We'll send a verification code to your phone";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        {!otp.isConfigured ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Phone login is not configured. Please contact support.
          </div>
        ) : needsName ? (
          <form onSubmit={handleNameSubmit} className="space-y-4 pt-2">
            <div className="text-center text-sm text-green-600">
              ✓ Phone verified: +91{phoneInput}
            </div>
            <Input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
            </Button>
          </form>
        ) : otp.step === 'otp' ? (
          <form onSubmit={handleVerify} className="space-y-4 pt-2">
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter OTP"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest"
              disabled={otp.isLoading || submitting}
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={otp.isLoading || submitting}>
              {otp.isLoading || submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => otp.reset()}
              >
                <ArrowLeft className="w-3 h-3" /> Change number
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => otp.resendOTP()}
                disabled={otp.isLoading}
              >
                Resend OTP
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSend} className="space-y-4 pt-2">
            <div className="flex gap-2">
              <span className="flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                <Phone className="w-3.5 h-3.5 mr-1.5" /> +91
              </span>
              <Input
                type="tel"
                placeholder="Phone number"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1"
                disabled={otp.isLoading}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={otp.isLoading || !otp.isLoaded}
            >
              {otp.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : !otp.isLoaded ? (
                'Loading…'
              ) : (
                <>
                  Send OTP <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            {!otp.isLoaded && (
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading OTP service…
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
