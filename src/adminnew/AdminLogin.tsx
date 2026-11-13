import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth, AuthError } from '../hooks/useAuth';
import { useOTPWidget } from '../hooks/useOTPWidget';
import { setReloadBlocked } from '../lib/reloadGuard';
import { Banner, Button, OtpInput } from './ui';

// MSG91 sends 4-digit codes (same as the storefront dialog).
const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

interface LoginError {
  message: string;
  code?: string;
}

function friendlySendError(raw: string): string {
  const m = (raw || '').toLowerCase();
  if (/http failure|unknown error|failed to fetch|csp|blocked by|network|timeout|took too long|not ready/.test(m)) {
    return "Couldn't reach the SMS service. Check your connection and try again.";
  }
  if (raw && raw.length <= 120 && !/https?:\/\//.test(raw)) return raw;
  return "Couldn't send the code. Try again.";
}

function friendlyVerifyError(raw: string): string {
  const m = (raw || '').toLowerCase();
  if (/expir/.test(m)) return 'That code has expired. Send a new one.';
  if (/network|timeout|failed to fetch|unknown error/.test(m)) return 'Network problem. Try again.';
  if (/invalid|wrong|incorrect|mismatch|not match|failed/.test(m)) return 'Wrong code. Check the SMS and try again.';
  return raw || 'Verification failed. Try again.';
}

/**
 * Admin host sign-in: phone number, then OTP. Store-agnostic platform page.
 *
 * - With `onVerified` (admin root, no store in the path): the caller exchanges
 *   the MSG91 token for a session and picks the store (see StorePicker).
 * - Without it (admin.<root>/<store>/...): signs in to the store in the path
 *   through useAuth().signInWithPhone, exactly like the old dialog did.
 */
export function AdminLogin({
  onVerified,
}: {
  onVerified?: (args: { phone: string; token: string; countryCode: string }) => Promise<unknown>;
}) {
  const { signInWithPhone } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const attemptedFor = useRef<string | null>(null);

  const focusOtp = () => setTimeout(() => otpRef.current?.focus({ preventScroll: true }), 30);

  const handleWidgetError = useCallback((message: string) => {
    setVerifying(false);
    if (stepRef.current === 'phone') {
      setError({ message: friendlySendError(message), code: 'OTP_SEND_FAILED' });
      return;
    }
    attemptedFor.current = null;
    setCode('');
    setError({ message: friendlyVerifyError(message), code: /expir/i.test(message) ? 'OTP_EXPIRED' : 'OTP_INVALID' });
    focusOtp();
  }, []);

  const handleSuccess = useCallback(
    async (_mobile: string, countryCode: string, token: string) => {
      if (!token) {
        handleWidgetError('No verification token received');
        return;
      }
      setError(null);
      setVerifying(true);
      try {
        if (onVerified) await onVerified({ phone, token, countryCode });
        else await signInWithPhone({ phone, token, countryCode });
        // Success: the parent re-renders (session) or navigates. Keep the spinner.
      } catch (err) {
        setVerifying(false);
        attemptedFor.current = null;
        setCode('');
        setError({
          message: err instanceof Error ? err.message : 'Sign-in failed. Try again.',
          code: err instanceof AuthError ? err.code : undefined,
        });
        focusOtp();
      }
    },
    [onVerified, signInWithPhone, phone, handleWidgetError],
  );

  const otp = useOTPWidget({ onSuccess: handleSuccess, onError: handleWidgetError, enabled: true });

  // No automatic reloads (chunk recovery, SW update) while signing in.
  useEffect(() => {
    setReloadBlocked(true);
    return () => setReloadBlocked(false);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const scriptError: LoginError | null = otp.loadError
    ? { message: "Sign-in couldn't load. Check your connection and reload the page.", code: 'OTP_SCRIPT_LOAD' }
    : null;

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (phone.length !== 10 || otp.isLoading) return;
    setError(null);
    otp.sendOTP(phone, {
      onSent: () => {
        setCode('');
        attemptedFor.current = null;
        setStep('otp');
        setResendIn(RESEND_SECONDS);
        focusOtp();
      },
      onFailed: (msg, c) => setError({ message: friendlySendError(msg), code: c || 'OTP_SEND_FAILED' }),
    });
  };

  const resend = () => {
    if (resendIn > 0 || verifying) return;
    setError(null);
    otp.sendOTP(phone, {
      onSent: () => {
        setCode('');
        attemptedFor.current = null;
        setResendIn(RESEND_SECONDS);
        focusOtp();
      },
      onFailed: (msg, c) => setError({ message: friendlySendError(msg), code: c || 'OTP_SEND_FAILED' }),
    });
  };

  const verify = (value: string) => {
    if (value.length !== OTP_LENGTH || attemptedFor.current === value) return;
    attemptedFor.current = value;
    setError(null);
    setVerifying(true);
    otp.verifyOTP(value);
  };

  const editPhone = () => {
    setStep('phone');
    setCode('');
    setError(null);
    setVerifying(false);
    attemptedFor.current = null;
    otp.reset();
    setTimeout(() => phoneRef.current?.focus(), 30);
  };

  const shownError = error ?? scriptError;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[var(--admin-bg)] px-4 pt-[12vh]">
      <p className="mb-6 text-lg font-semibold tracking-[-0.02em] text-[var(--admin-text)]">Cigarro</p>
      <div className="w-full max-w-[380px] rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 sm:p-7">
        <h1 className="text-xl font-semibold text-[var(--admin-text)]">Welcome back</h1>
        <p className="mt-1 min-h-5 text-sm text-[var(--admin-text-muted)]">
          {step === 'phone' ? 'Sign in with your admin phone number.' : `Enter the code sent to +91 ${phone}.`}
        </p>

        {!otp.isConfigured ? (
          <Banner tone="critical" className="mt-5">
            Phone sign-in is not configured.
          </Banner>
        ) : step === 'phone' ? (
          <form onSubmit={send} className="mt-5 flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[var(--admin-text)]">Phone number</span>
              <div className="flex h-11 items-stretch overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] focus-within:border-[var(--admin-focus)] focus-within:ring-2 focus-within:ring-[var(--admin-focus)]/20">
                <span className="flex items-center border-r border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3 text-sm font-medium text-[var(--admin-text-muted)]">
                  +91
                </span>
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoFocus
                  enterKeyHint="send"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    if (error) setError(null);
                  }}
                  disabled={otp.isLoading}
                  aria-invalid={!!shownError || undefined}
                  className="min-w-0 flex-1 bg-transparent px-3 text-base tabular-nums text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-text-subtle)]"
                  placeholder="98765 43210"
                />
              </div>
            </label>
            {shownError && <LoginErrorBanner error={shownError} />}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={otp.isLoading || (!otp.isLoaded && !otp.loadError)}
              disabled={phone.length !== 10 || !!otp.loadError}
            >
              Send code
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verify(code);
            }}
            className="mt-5 flex flex-col gap-4"
            noValidate
          >
            <OtpInput
              ref={otpRef}
              length={OTP_LENGTH}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              onComplete={verify}
              disabled={verifying}
              invalid={!!error}
              autoFocus
              describedBy={error ? 'admin-login-error' : undefined}
            />
            {shownError && <LoginErrorBanner id="admin-login-error" error={shownError} />}
            <Button type="submit" variant="primary" size="lg" fullWidth loading={verifying} disabled={code.length !== OTP_LENGTH}>
              Sign in
            </Button>
            <div className="flex items-center justify-between text-[13px]">
              <button type="button" onClick={editPhone} className="font-medium text-[var(--admin-primary)] hover:underline">
                Change number
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={resendIn > 0 || otp.isLoading || verifying}
                className="font-medium text-[var(--admin-primary)] hover:underline disabled:cursor-default disabled:text-[var(--admin-text-subtle)] disabled:no-underline"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function LoginErrorBanner({ error, id }: { error: LoginError; id?: string }) {
  return (
    <div id={id}>
      <Banner tone="critical">
        {error.message}
        {error.code && <span className="ml-1.5 font-mono text-xs text-[var(--admin-text-muted)]">{error.code}</span>}
      </Banner>
    </div>
  );
}
