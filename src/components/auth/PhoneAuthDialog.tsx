import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Pencil } from 'lucide-react';
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
  const [otpError, setOtpError] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

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
        setOtpError(true);
        setStep('otp');
        setSubmitting(false);
        setTimeout(() => otpRefs.current[OTP_LENGTH - 1]?.focus(), 50);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signInWithPhone, onOpenChange, onAuthSuccess, phoneInput]
  );

  const otp = useOTPWidget({
    onSuccess: handleOTPSuccess,
    onError: () => {
      setOtpError(true);
      setStep('otp');
      setSubmitting(false);
      setTimeout(() => otpRefs.current[OTP_LENGTH - 1]?.focus(), 50);
    },
  });

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('phone');
        setPhoneInput('');
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setOtpError(false);
        setName('');
        setSubmitting(false);
        setResendIn(0);
        otp.reset();
      }, 200);
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

  // Autofocus first OTP cell on entry
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 120);
    }
  }, [step]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length !== 10) return;
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setOtpError(false);
    setStep('otp');
    otp.sendOTP(cleaned);
    setResendIn(30);
  };

  const submitOtpIfComplete = (digits: string[]) => {
    if (digits.every((d) => d.length === 1)) {
      setStep('verifying');
      otp.verifyOTP(digits.join(''));
    }
  };

  const setDigit = (idx: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 1);
    setOtpError(false);
    const nextDigits = [...otpDigits];
    nextDigits[idx] = clean;
    setOtpDigits(nextDigits);
    if (clean && idx < OTP_LENGTH - 1) {
      otpRefs.current[idx + 1]?.focus();
    }
    if (clean) submitOtpIfComplete(nextDigits);
  };

  const handleOtpKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitOtpIfComplete(otpDigits);
    } else if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
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
    setOtpError(false);
    const arr = pasted.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);
    setOtpDigits(arr);
    if (pasted.length === OTP_LENGTH) {
      setStep('verifying');
      otp.verifyOTP(pasted);
    } else {
      otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !user?.id) return;
    setSubmitting(true);
    try {
      await supabase.from('profiles').update({ name: trimmed }).eq('id', user.id);
      await supabase.auth.updateUser({ data: { name: trimmed } });
      onOpenChange(false);
      onAuthSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save name');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPhone = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setOtpError(false);
    setStep('phone');
    otp.reset();
  };

  const handleResend = () => {
    if (resendIn > 0 || submitting) return;
    const cleaned = phoneInput.replace(/\D/g, '');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setOtpError(false);
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
    otp.sendOTP(cleaned);
    setResendIn(30);
  };

  // ---- Body ----
  const body: ReactNode = !otp.isConfigured ? (
    <div className="py-8 text-center text-sm text-[var(--vv-fg-muted,#585966)]">
      Phone login not configured.
    </div>
  ) : (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'phone' && (
        <StepContainer key="phone">
          <h2 className="text-[17px] font-bold text-[var(--vv-fg,#0f0f12)]">Sign in</h2>
          <form onSubmit={handleSend} className="space-y-3">
            <div className="flex gap-2">
              <span className="inline-flex items-center px-3 h-12 rounded-xl border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-inset,#f1f2f4)] text-[15px] font-semibold text-[var(--vv-fg,#0f0f12)]">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoFocus
                placeholder="Phone number"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={otp.isLoading}
                className="flex-1 h-12 px-4 border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-elevated,#fff)] text-[var(--vv-fg,#0f0f12)] rounded-xl text-[16px] focus:outline-none focus:border-[var(--vv-brand,#2563eb)] focus:ring-[3px] focus:ring-[var(--vv-brand,#2563eb)]/20 transition"
              />
            </div>
            <button
              type="submit"
              disabled={otp.isLoading || !otp.isLoaded || phoneInput.length !== 10}
              className="w-full h-12 rounded-xl bg-[var(--vv-brand,#2563eb)] text-white font-semibold text-[15px] hover:bg-[var(--vv-brand-hover,#1d4ed8)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              {otp.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : !otp.isLoaded ? 'Loading…' : 'Continue'}
            </button>
          </form>
        </StepContainer>
      )}

      {step === 'otp' && (
        <StepContainer key="otp">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold text-[var(--vv-fg,#0f0f12)]">Enter code</h2>
              <p className="text-[13px] text-[var(--vv-fg-muted,#585966)] mt-0.5 flex items-center gap-1.5">
                Sent to +91 {phoneInput}
                <button
                  onClick={handleEditPhone}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--vv-brand,#2563eb)] hover:bg-[var(--vv-brand-soft,#eff6ff)]"
                  aria-label="Change phone number"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </p>
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendIn > 0}
              className={`text-[13px] font-semibold shrink-0 mt-0.5 ${resendIn > 0 ? 'text-[var(--vv-fg-subtle,#8a8b95)]' : 'text-[var(--vv-brand,#2563eb)] hover:underline'}`}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend'}
            </button>
          </div>

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
                className={`w-14 h-16 text-center text-2xl font-bold rounded-xl border bg-[var(--vv-bg-elevated,#fff)] text-[var(--vv-fg,#0f0f12)] focus:outline-none focus:ring-[3px] transition ${
                  otpError
                    ? 'border-[var(--vv-danger,#dc2626)] focus:border-[var(--vv-danger,#dc2626)] focus:ring-[var(--vv-danger,#dc2626)]/20'
                    : 'border-[var(--vv-border,#e7e8ec)] focus:border-[var(--vv-brand,#2563eb)] focus:ring-[var(--vv-brand,#2563eb)]/20'
                }`}
              />
            ))}
          </div>

          {otpError && (
            <p className="text-center text-[13px] text-[var(--vv-danger,#dc2626)] font-medium -mt-2">
              Wrong code, try again
            </p>
          )}
        </StepContainer>
      )}

      {step === 'verifying' && (
        <StepContainer key="verifying">
          <div className="py-6 flex items-center justify-center gap-3 text-[var(--vv-fg-muted,#585966)]">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--vv-brand,#2563eb)]" />
            <span className="text-[15px] font-medium">Verifying…</span>
          </div>
        </StepContainer>
      )}

      {step === 'name' && (
        <StepContainer key="name">
          <h2 className="text-[17px] font-bold text-[var(--vv-fg,#0f0f12)]">Your name</h2>
          <form onSubmit={handleNameSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="e.g. Rohan"
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

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/50 z-[9999] backdrop-blur-[2px]" />
          <Drawer.Content className="bg-[var(--vv-bg-elevated,#fff)] flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 z-[10000] outline-none">
            <Drawer.Title className="sr-only">Sign in</Drawer.Title>
            <Drawer.Description className="sr-only">Phone verification</Drawer.Description>
            <div className="mx-auto w-10 h-1 rounded-full bg-[var(--vv-border-strong,#d2d4dc)] mt-3" />
            <div className="px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              {body}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[var(--vv-brand,#2563eb)] via-[var(--vv-brand-hover,#1d4ed8)] to-[var(--vv-accent,#ff4b34)]" />
        <div className="px-6 py-5">{body}</div>
      </DialogContent>
    </Dialog>
  );
}

function StepContainer({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      {children}
    </motion.div>
  );
}
