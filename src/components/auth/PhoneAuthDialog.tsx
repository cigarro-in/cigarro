import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Loader2, ArrowLeft, Phone, Shield, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { useOTPWidget } from '../../hooks/useOTPWidget';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess?: () => void;
}

const OTP_LENGTH = 6;

export function PhoneAuthDialog({ open, onOpenChange, onAuthSuccess }: Props) {
  const { signInWithPhone, user } = useAuth();
  const [phoneInput, setPhoneInput] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

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
        toast.success('Welcome back');
        onOpenChange(false);
        onAuthSuccess?.();
        reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Sign-in failed');
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

  // Resend cooldown timer
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Autofocus first OTP cell when arriving on OTP step
  useEffect(() => {
    if (otp.step === 'otp') {
      otpRefs.current[0]?.focus();
    }
  }, [otp.step]);

  const reset = () => {
    setPhoneInput('');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setName('');
    setNeedsName(false);
    setResendIn(0);
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
    setResendIn(30);
  };

  const setDigit = (idx: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[idx] = clean;
      return next;
    });
    if (clean && idx < OTP_LENGTH - 1) otpRefs.current[idx + 1]?.focus();

    const joined = [
      ...otpDigits.slice(0, idx),
      clean,
      ...otpDigits.slice(idx + 1),
    ].join('');
    if (joined.length === OTP_LENGTH && !joined.includes('')) {
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
    if (pasted.length === OTP_LENGTH) otp.verifyOTP(pasted);
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
      toast.success(`Welcome, ${trimmed.split(' ')[0]}`);
      onOpenChange(false);
      onAuthSuccess?.();
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save name');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-[var(--vv-brand,#2563eb)] via-[var(--vv-brand-hover,#1d4ed8)] to-[var(--vv-accent,#ff4b34)]" />

        <div className="px-6 pt-6 pb-6">
          {!otp.isConfigured ? (
            <NotConfigured />
          ) : needsName ? (
            <NameStep
              name={name}
              setName={setName}
              onSubmit={handleNameSubmit}
              submitting={submitting}
              phone={phoneInput}
            />
          ) : otp.step === 'otp' ? (
            <OtpStep
              phone={phoneInput}
              digits={otpDigits}
              setDigit={setDigit}
              onKey={handleOtpKey}
              onPaste={handleOtpPaste}
              inputsRef={otpRefs}
              loading={otp.isLoading || submitting}
              resendIn={resendIn}
              onResend={() => {
                otp.resendOTP();
                setResendIn(30);
              }}
              onChangeNumber={() => {
                otp.reset();
                setOtpDigits(Array(OTP_LENGTH).fill(''));
              }}
            />
          ) : (
            <PhoneStep
              phone={phoneInput}
              setPhone={setPhoneInput}
              onSubmit={handleSend}
              loading={otp.isLoading}
              ready={otp.isLoaded}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Step components ----

function Heading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="text-center mb-5">
      <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-[var(--vv-brand-soft,#eff6ff)] text-[var(--vv-brand,#2563eb)] grid place-items-center">
        {icon}
      </div>
      <h2 className="text-lg font-bold tracking-tight text-[var(--vv-fg,#0f0f12)]">{title}</h2>
      <p className="text-xs text-[var(--vv-fg-muted,#585966)] mt-1">{subtitle}</p>
    </div>
  );
}

function PhoneStep({
  phone,
  setPhone,
  onSubmit,
  loading,
  ready,
}: {
  phone: string;
  setPhone: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  ready: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Heading
        icon={<Phone className="w-5 h-5" />}
        title="Sign in with phone"
        subtitle="We'll send a verification code to get you in."
      />

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--vv-fg-muted,#585966)] mb-1.5 block">
          Phone number
        </label>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1 px-3 h-11 rounded-[10px] border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-inset,#f1f2f4)] text-sm font-semibold text-[var(--vv-fg,#0f0f12)]">
            🇮🇳 +91
          </span>
          <input
            type="tel"
            inputMode="numeric"
            autoFocus
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            disabled={loading}
            className="flex-1 h-11 px-4 border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-elevated,#fff)] text-[var(--vv-fg,#0f0f12)] rounded-[10px] text-[15px] focus:outline-none focus:border-[var(--vv-brand,#2563eb)] focus:ring-[3px] focus:ring-[var(--vv-brand,#2563eb)]/20 transition"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !ready}
        className="w-full h-12 rounded-[10px] bg-[var(--vv-brand,#2563eb)] text-white font-semibold text-[15px] hover:bg-[var(--vv-brand-hover,#1d4ed8)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : !ready ? 'Loading…' : 'Send verification code'}
      </button>

      <p className="text-[11px] text-center text-[var(--vv-fg-subtle,#8a8b95)] leading-relaxed">
        By continuing, you agree to our Terms and Privacy Policy.
      </p>
    </form>
  );
}

function OtpStep({
  phone,
  digits,
  setDigit,
  onKey,
  onPaste,
  inputsRef,
  loading,
  resendIn,
  onResend,
  onChangeNumber,
}: {
  phone: string;
  digits: string[];
  setDigit: (i: number, v: string) => void;
  onKey: (i: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  inputsRef: React.MutableRefObject<Array<HTMLInputElement | null>>;
  loading: boolean;
  resendIn: number;
  onResend: () => void;
  onChangeNumber: () => void;
}) {
  return (
    <div className="space-y-5">
      <Heading
        icon={<Shield className="w-5 h-5" />}
        title="Verify your number"
        subtitle={`Enter the ${OTP_LENGTH}-digit code sent to +91 ${phone}`}
      />

      <div className="flex justify-center gap-2" onPaste={onPaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            disabled={loading}
            className="w-11 h-12 text-center text-xl font-bold rounded-[10px] border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-elevated,#fff)] text-[var(--vv-fg,#0f0f12)] focus:outline-none focus:border-[var(--vv-brand,#2563eb)] focus:ring-[3px] focus:ring-[var(--vv-brand,#2563eb)]/20 transition"
          />
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--vv-fg-muted,#585966)]">
          <Loader2 className="w-3 h-3 animate-spin" /> Verifying…
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onChangeNumber}
          className="text-[var(--vv-fg-muted,#585966)] hover:text-[var(--vv-fg,#0f0f12)] flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Change number
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={resendIn > 0 || loading}
          className={resendIn > 0 ? 'text-[var(--vv-fg-subtle,#8a8b95)]' : 'text-[var(--vv-brand,#2563eb)] hover:underline font-semibold'}
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}

function NameStep({
  name,
  setName,
  onSubmit,
  submitting,
  phone,
}: {
  name: string;
  setName: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  phone: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Heading
        icon={<CheckCircle2 className="w-5 h-5" />}
        title="Almost there"
        subtitle={`Phone verified (+91 ${phone}). What should we call you?`}
      />
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={submitting}
        autoFocus
        className="w-full h-11 px-4 border border-[var(--vv-border,#e7e8ec)] bg-[var(--vv-bg-elevated,#fff)] text-[var(--vv-fg,#0f0f12)] rounded-[10px] text-[15px] focus:outline-none focus:border-[var(--vv-brand,#2563eb)] focus:ring-[3px] focus:ring-[var(--vv-brand,#2563eb)]/20 transition"
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full h-12 rounded-[10px] bg-[var(--vv-brand,#2563eb)] text-white font-semibold text-[15px] hover:bg-[var(--vv-brand-hover,#1d4ed8)] active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
      </button>
    </form>
  );
}

function NotConfigured() {
  return (
    <div className="py-10 text-center text-sm text-[var(--vv-fg-muted,#585966)]">
      Phone login is not configured. Please contact support.
    </div>
  );
}
