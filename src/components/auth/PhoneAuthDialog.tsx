import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowLeft, Phone, Shield, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '../ui/dialog';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useOTPWidget } from '../../hooks/useOTPWidget';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess?: () => void;
}

const OTP_LENGTH = 4;

type Step = 'phone' | 'otp' | 'verifying' | 'name';

export function PhoneAuthDialog({ open, onOpenChange, onAuthSuccess }: Props) {
  const { signInWithPhone, user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Verification pipeline
  const handleOTPSuccess = useCallback(
    async (_phone: string, countryCode: string, token: string) => {
      if (!token) {
        toast.error('No verification token received');
        return;
      }
      setStep('verifying');
      setSubmitting(true);
      try {
        const result = await signInWithPhone({ phone: phoneInput, token, countryCode });
        if (result.isNewUser) {
          setSubmitting(false);
          setStep('name');
          return;
        }
        toast.success('Welcome back');
        onOpenChange(false);
        onAuthSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Sign-in failed');
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setStep('otp');
        setSubmitting(false);
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signInWithPhone, onOpenChange, onAuthSuccess, phoneInput]
  );

  const otp = useOTPWidget({
    onSuccess: handleOTPSuccess,
    onError: (err) => {
      toast.error(err);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setStep('otp');
      setSubmitting(false);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    },
  });

  // Full reset when dialog closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('phone');
        setPhoneInput('');
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setName('');
        setSubmitting(false);
        setResendIn(0);
        otp.reset();
      }, 200); // after close animation
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Resend cooldown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Focus first OTP cell on entering step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 120);
    }
  }, [step]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setStep('otp');
    otp.sendOTP(cleaned);
    setResendIn(30);
  };

  const setDigit = (idx: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = clean;
      return next;
    });
    if (clean && idx < OTP_LENGTH - 1) {
      otpRefs.current[idx + 1]?.focus();
    }
    const joined = [
      ...otpDigits.slice(0, idx),
      clean,
      ...otpDigits.slice(idx + 1),
    ].join('');
    if (joined.length === OTP_LENGTH && !joined.includes('')) {
      setStep('verifying');
      otp.verifyOTP(joined);
    }
  };

  const handleOtpKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const arr = pasted.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);
    setOtpDigits(arr);
    const lastFilled = Math.min(pasted.length, OTP_LENGTH) - 1;
    otpRefs.current[Math.max(0, lastFilled)]?.focus();
    if (pasted.length === OTP_LENGTH) {
      setStep('verifying');
      otp.verifyOTP(pasted);
    }
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
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from('profiles').update({ name: trimmed }).eq('id', user.id);
      await supabase.auth.updateUser({ data: { name: trimmed } });
      toast.success(`Welcome, ${trimmed.split(' ')[0]}`);
      onOpenChange(false);
      onAuthSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save name');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeNumber = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setStep('phone');
    otp.reset();
  };

  const handleResend = () => {
    if (resendIn > 0 || submitting) return;
    const cleaned = phoneInput.replace(/\D/g, '');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
    otp.sendOTP(cleaned);
    setResendIn(30);
    toast.success('Code sent again');
  };

  // ---- Body: step UI, shared between Drawer and Dialog ----
  const body: ReactNode = !otp.isConfigured ? (
    <div className="py-10 text-center text-sm text-[var(--vv-fg-muted,#585966)]">
      Phone login is not configured. Please contact support.
    </div>
  ) : (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'phone' && (
        <StepContainer key="phone">
          <StepHeader
            icon={<Phone className="w-5 h-5" />}
            title="Sign in with phone"
            subtitle="We'll send a quick verification code."
          />
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--vv-fg-muted,#585966)] mb-1.5 block">
                Phone number
              </label>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 px-3 h-12 rounded-xl border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-inset,#f1f2f4)] text-sm font-semibold text-[var(--vv-fg,#0f0f12)]">
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  placeholder="9876543210"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  disabled={otp.isLoading}
                  className="flex-1 h-12 px-4 border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-elevated,#fff)] text-[var(--vv-fg,#0f0f12)] rounded-xl text-[16px] focus:outline-none focus:border-[var(--vv-brand,#2563eb)] focus:ring-[3px] focus:ring-[var(--vv-brand,#2563eb)]/20 transition"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={otp.isLoading || !otp.isLoaded || phoneInput.length !== 10}
              className="w-full h-12 rounded-xl bg-[var(--vv-brand,#2563eb)] text-white font-semibold text-[15px] hover:bg-[var(--vv-brand-hover,#1d4ed8)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              {otp.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : !otp.isLoaded ? 'Loading…' : 'Send code'}
            </button>
            <p className="text-[11px] text-center text-[var(--vv-fg-subtle,#8a8b95)]">
              By continuing, you agree to our Terms and Privacy Policy.
            </p>
          </form>
        </StepContainer>
      )}

      {step === 'otp' && (
        <StepContainer key="otp">
          <StepHeader
            icon={<Shield className="w-5 h-5" />}
            title="Enter verification code"
            subtitle={
              <>
                Sent to <span className="font-semibold text-[var(--vv-fg,#0f0f12)]">+91 {phoneInput}</span>
              </>
            }
          />
          <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
            {otpDigits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  otpRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => handleOtpKey(i, e)}
                className="w-14 h-16 text-center text-2xl font-bold rounded-xl border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-elevated,#fff)] text-[var(--vv-fg,#0f0f12)] focus:outline-none focus:border-[var(--vv-brand,#2563eb)] focus:ring-[3px] focus:ring-[var(--vv-brand,#2563eb)]/20 transition"
              />
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleChangeNumber}
              className="inline-flex items-center gap-1 text-[13px] text-[var(--vv-fg-muted,#585966)] hover:text-[var(--vv-fg,#0f0f12)]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change number
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendIn > 0}
              className={`text-[13px] font-semibold ${resendIn > 0 ? 'text-[var(--vv-fg-subtle,#8a8b95)]' : 'text-[var(--vv-brand,#2563eb)] hover:underline'}`}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </StepContainer>
      )}

      {step === 'verifying' && (
        <StepContainer key="verifying">
          <div className="py-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--vv-brand-soft,#eff6ff)] text-[var(--vv-brand,#2563eb)] grid place-items-center mb-4">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-[var(--vv-fg,#0f0f12)]">Verifying…</h2>
            <p className="text-sm text-[var(--vv-fg-muted,#585966)] mt-1">
              Hold on a second
            </p>
          </div>
        </StepContainer>
      )}

      {step === 'name' && (
        <StepContainer key="name">
          <StepHeader
            icon={<CheckCircle2 className="w-5 h-5" />}
            title="Almost there"
            subtitle="What should we call you?"
          />
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoFocus
              className="w-full h-12 px-4 border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-elevated,#fff)] text-[var(--vv-fg,#0f0f12)] rounded-xl text-[16px] focus:outline-none focus:border-[var(--vv-brand,#2563eb)] focus:ring-[3px] focus:ring-[var(--vv-brand,#2563eb)]/20 transition"
            />
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full h-12 rounded-xl bg-[var(--vv-brand,#2563eb)] text-white font-semibold text-[15px] hover:bg-[var(--vv-brand-hover,#1d4ed8)] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
            </button>
          </form>
        </StepContainer>
      )}
    </AnimatePresence>
  );

  // Mobile: bottom sheet via vaul
  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/50 z-[9999] backdrop-blur-[2px]" />
          <Drawer.Content className="bg-[var(--vv-bg-elevated,#fff)] flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 z-[10000] max-h-[92%] outline-none">
            <Drawer.Title className="sr-only">Sign in</Drawer.Title>
            <Drawer.Description className="sr-only">Phone number verification</Drawer.Description>
            <div className="mx-auto w-10 h-1 rounded-full bg-[var(--vv-border-strong,#d2d4dc)] mt-3" />
            <div className="relative px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full grid place-items-center text-[var(--vv-fg-muted,#585966)] hover:bg-[var(--vv-bg-inset,#f1f2f4)]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              {body}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  // Desktop: centered dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[var(--vv-brand,#2563eb)] via-[var(--vv-brand-hover,#1d4ed8)] to-[var(--vv-accent,#ff4b34)]" />
        <div className="px-6 pt-6 pb-6">{body}</div>
      </DialogContent>
    </Dialog>
  );
}

// ---- helpers ----

function StepContainer({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      {children}
    </motion.div>
  );
}

function StepHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
}) {
  return (
    <div className="text-center">
      <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-[var(--vv-brand-soft,#eff6ff)] text-[var(--vv-brand,#2563eb)] grid place-items-center">
        {icon}
      </div>
      <h2 className="text-lg font-bold tracking-tight text-[var(--vv-fg,#0f0f12)]">{title}</h2>
      <p className="text-[13px] text-[var(--vv-fg-muted,#585966)] mt-1">{subtitle}</p>
    </div>
  );
}
