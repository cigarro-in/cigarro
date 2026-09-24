import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { useAuth, AuthError, newAuthCorrelationId } from '../../hooks/useAuth';
import { useMyProfile } from '../../hooks/data/useMyProfile';
import { useOTPWidget } from '../../hooks/useOTPWidget';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess?: () => void;
}

const OTP_LENGTH = 4;

// NOTE on theming: every color below resolves via --vv-* tokens (defined for
// both themes — classic in src/themes/classic/tokens.css, vivid in
// src/themes/vivid/tokens.css). The literal fallbacks use the Classic
// (default) palette so the dialog never flashes blue/white before tokens
// load or when a token is missing.

type Step = 'phone' | 'otp' | 'verifying' | 'name';

type AuthErrorKind =
  | 'invalid_code'
  | 'expired'
  | 'send_failed'
  | 'session'
  | 'network'
  | 'name_save'
  | 'unknown';

interface InlineError {
  kind: AuthErrorKind;
  message: string;
  code: string;
  correlationId: string;
}

const ERROR_CODES: Record<AuthErrorKind, string> = {
  invalid_code: 'OTP_INVALID',
  expired: 'OTP_EXPIRED',
  send_failed: 'OTP_SEND_FAILED',
  session: 'SESSION_FAILED',
  network: 'AUTH_NETWORK',
  name_save: 'NAME_SAVE_FAILED',
  unknown: 'AUTH_FAILED',
};

function classifyWidgetError(message: string): AuthErrorKind {
  const m = message.toLowerCase();
  if (/expir/.test(m)) return 'expired';
  if (/throttl|too many|try again later|blocked|limit/.test(m)) return 'send_failed';
  if (/network|timeout|took too long|not ready|load|http failure|unknown error|failed to fetch|fetch failed/.test(m)) return 'network';
  if (/send|resend/.test(m)) return 'send_failed';
  if (/invalid|wrong|incorrect|mismatch|not match|failed/.test(m)) return 'invalid_code';
  return 'unknown';
}

function friendlyWidgetMessage(kind: AuthErrorKind, raw: string): string {
  switch (kind) {
    case 'invalid_code':
      return 'Wrong code — check the SMS and try again.';
    case 'expired':
      return 'That code expired — request a new one below.';
    case 'network':
      return 'Network hiccup — try again.';
    case 'send_failed':
      return friendlySendFailureMessage(raw);
    default:
      return raw || 'Verification failed — try again.';
  }
}

// Send-OTP failures stay on the phone step with a Retry button, so the
// message must be actionable on its own. The widget surfaces transport
// failures verbatim (e.g. "Http failure response for
// https://api.msg91.com/api/v5/widget/sendOtp: 0 Unknown Error" when CSP
// or the network blocks the call) — translate those to plain language and
// keep short human messages as-is.
function friendlySendFailureMessage(raw: string): string {
  const m = (raw || '').toLowerCase();
  if (/http failure|0 unknown error|unknown error|failed to fetch|csp|blocked by|network|timeout|took too long|not ready|econn|enotfound/.test(m)) {
    return "Couldn't reach the SMS service — check your connection and try again.";
  }
  if (raw && raw.length <= 120 && !/https?:\/\//.test(raw)) return raw;
  return "Couldn't send the code — try again.";
}

function toInlineError(kind: AuthErrorKind, message: string, code?: string): InlineError {
  return {
    kind,
    message,
    code: code || ERROR_CODES[kind],
    correlationId: newAuthCorrelationId(),
  };
}

// Tracks the keyboard-visible height on mobile so the drawer never renders
// taller than the visible area (100dvh fallback where visualViewport is
// unavailable). ponytail: single resize listener, drop when native
// keyboard-inset APIs are available.
function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setHeight(Math.round(vv.height));
    onResize();
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);
  return height;
}

export function PhoneAuthDialog({ open, onOpenChange, onAuthSuccess }: Props) {
  const { signInWithPhone, user } = useAuth();
  const { updateDisplayName } = useMyProfile();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const vvHeight = useVisualViewportHeight();

  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [authError, setAuthError] = useState<InlineError | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<InlineError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const verifyAttemptedFor = useRef<string | null>(null);
  const lastToken = useRef<{ phone: string; countryCode: string; token: string } | null>(null);
  // Mirrors `step` for the MSG91 global failure callback, which can fire for
  // either a send failure (phone step) or a verification failure (otp step).
  const stepRef = useRef<Step>('phone');
  stepRef.current = step;

  const focusOtp = useCallback(() => {
    setTimeout(() => otpInputRef.current?.focus({ preventScroll: true }), 60);
  }, []);

  const handleWidgetError = useCallback(
    (message: string) => {
      const kind = classifyWidgetError(message);
      // Step-aware: the singleton widget's global failure callback fires for
      // send failures too. On the phone step a send/network failure must stay
      // here with the actionable inline Retry — never jump to the OTP step.
      // Verification errors (wrong/expired code) keep the OTP step below.
      if (stepRef.current === 'phone' && (kind === 'send_failed' || kind === 'network')) {
        const friendly = friendlySendFailureMessage(message);
        setAuthError(toInlineError('send_failed', friendly));
        setSubmitting(false);
        return;
      }
      setAuthError(toInlineError(kind, friendlyWidgetMessage(kind, message)));
      setSubmitting(false);
      if (kind !== 'expired') {
        verifyAttemptedFor.current = null;
        setStep('otp');
        focusOtp();
      } else {
        setStep('otp');
      }
    },
    [focusOtp]
  );

  const handleOTPSuccess = useCallback(
    async (_phone: string, countryCode: string, token: string) => {
      if (!token) {
        handleWidgetError('No verification token received');
        return;
      }
      lastToken.current = { phone: phoneInput, countryCode, token };
      setAuthError(null);
      setStep('verifying');
      setSubmitting(true);
      try {
        const result = await signInWithPhone({ phone: phoneInput, token, countryCode });
        if (result.isNewUser) {
          setSubmitting(false);
          setStep('name');
          return;
        }
        onOpenChange(false);
        onAuthSuccess?.();
      } catch (err) {
        const corr = err instanceof AuthError ? err.correlationId : undefined;
        const code = err instanceof AuthError ? err.code : undefined;
        const message = err instanceof Error ? err.message : 'Sign-in failed';
        const inline: InlineError = {
          kind: 'session',
          message,
          code: code || ERROR_CODES.session,
          correlationId: corr || newAuthCorrelationId(),
        };
        setAuthError(inline);
        setStep('otp');
        setSubmitting(false);
        verifyAttemptedFor.current = null;
        focusOtp();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signInWithPhone, onOpenChange, onAuthSuccess, phoneInput, handleWidgetError, focusOtp]
  );

  // Claims the singleton MSG91 dispatcher only while open — mounted-but-closed
  // dialogs never intercept another dialog's OTP result.
  const otp = useOTPWidget({
    onSuccess: handleOTPSuccess,
    onError: handleWidgetError,
    enabled: open,
  });

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('phone');
        setPhoneInput('');
        setOtpValue('');
        setAuthError(null);
        setName('');
        setNameError(null);
        setSubmitting(false);
        setResendIn(0);
        verifyAttemptedFor.current = null;
        lastToken.current = null;
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

  const submitOtpValue = useCallback(
    (value: string) => {
      if (value.length !== OTP_LENGTH || verifyAttemptedFor.current === value) return;
      verifyAttemptedFor.current = value;
      setAuthError(null);
      setStep('verifying');
      otp.verifyOTP(value);
    },
    [otp]
  );

  const handleOtpChange = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtpValue(clean);
    if (authError) setAuthError(null);
    if (clean.length === OTP_LENGTH) submitOtpValue(clean);
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    handleOtpChange(pasted);
  };

  const handleOtpKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitOtpValue(otpValue);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendOtpNow();
  };

  const sendOtpNow = () => {
    const cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length !== 10 || otp.isLoading) return;
    setAuthError(null);
    // Advance to the code step only after MSG91 confirms the send —
    // failures (IP block, bad key, throttling) stay here with the reason.
    otp.sendOTP(cleaned, {
      onSent: () => {
        setOtpValue('');
        verifyAttemptedFor.current = null;
        setAuthError(null);
        setStep('otp');
        setResendIn(30);
        focusOtp();
      },
      onFailed: (msg) => {
        // Stays on the phone step (no step change here) — the inline error
        // below carries the Retry action.
        const friendly = friendlySendFailureMessage(msg);
        setAuthError(toInlineError('send_failed', friendly));
      },
    });
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveNameNow();
  };

  const saveNameNow = async () => {
    const trimmed = name.trim();
    if (!trimmed || !user?.id || submitting) return;
    setSubmitting(true);
    setNameError(null);
    try {
      // Display name lives in Convex users. Failures stay inline with a
      // retry — never swallowed, never closing the dialog.
      await updateDisplayName(trimmed);
      onOpenChange(false);
      onAuthSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save name';
      const code = err instanceof AuthError ? err.code : undefined;
      const corr = err instanceof AuthError ? err.correlationId : undefined;
      setNameError({
        kind: 'name_save',
        message,
        code: code || ERROR_CODES.name_save,
        correlationId: corr || newAuthCorrelationId(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPhone = () => {
    setOtpValue('');
    verifyAttemptedFor.current = null;
    setAuthError(null);
    setStep('phone');
    otp.reset();
  };

  const handleResend = () => {
    if (resendIn > 0 || submitting) return;
    const cleaned = phoneInput.replace(/\D/g, '');
    setAuthError(null);
    otp.sendOTP(cleaned, {
      onSent: () => {
        setOtpValue('');
        verifyAttemptedFor.current = null;
        setResendIn(30);
        focusOtp();
      },
      onFailed: (msg) => {
        // Stays on the otp step (no step change here) — the inline error
        // below carries the resend action via handleErrorRetry.
        const friendly = friendlySendFailureMessage(msg);
        setAuthError(toInlineError('send_failed', friendly));
      },
    });
  };

  // Inline retry: expired → resend a fresh code; session failure after a good
  // OTP → retry sign-in with the same token (the server tolerates replays);
  // anything else → clear and let the user retype.
  const handleErrorRetry = () => {
    if (!authError) return;
    if (authError.kind === 'expired') {
      handleResend();
      return;
    }
    if (authError.kind === 'session' && lastToken.current) {
      const { phone, countryCode, token } = lastToken.current;
      void handleOTPSuccess(phone, countryCode, token);
      return;
    }
    setOtpValue('');
    verifyAttemptedFor.current = null;
    setAuthError(null);
    setStep('otp');
    focusOtp();
  };

  // ---- Body ----
  const body: ReactNode = !otp.isConfigured ? (
    <div className="py-8 text-center text-sm text-[var(--vv-fg-muted,#6f6259)]">
      Phone login not configured.
    </div>
  ) : (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'phone' && (
        <StepContainer key="phone">
          <h2 className="text-[17px] font-bold text-[var(--vv-fg,#433c35)]">Sign in</h2>
          <form onSubmit={handleSend} className="space-y-3">
            <div className="flex gap-2">
              <span className="inline-flex items-center px-3 h-12 rounded-xl border border-[var(--vv-border,#ded3bf)] bg-[var(--vv-bg-inset,#ded3bf)] text-[15px] font-semibold text-[var(--vv-fg,#433c35)]">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoFocus={!isMobile}
                enterKeyHint="send"
                placeholder="Phone number"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={otp.isLoading}
                aria-label="Phone number"
                className="flex-1 h-12 px-4 border border-[var(--vv-border,#ded3bf)] bg-[var(--vv-bg-elevated,#fff7e9)] text-[var(--vv-fg,#433c35)] rounded-xl text-[16px] focus:outline-none focus:border-[var(--vv-brand,#8c4630)] focus:ring-[3px] focus:ring-[var(--vv-brand,#8c4630)]/20 transition"
              />
            </div>
            {authError && (
              <InlineAuthError error={authError} onRetry={sendOtpNow} retryLabel="Retry" />
            )}
            <button
              type="submit"
              disabled={otp.isLoading || !otp.isLoaded || phoneInput.length !== 10}
              className="w-full h-12 rounded-xl bg-[var(--vv-brand,#8c4630)] text-white font-semibold text-[15px] hover:bg-[var(--vv-brand-hover,#6e3524)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              {otp.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : !otp.isLoaded ? 'Loading…' : 'Continue'}
            </button>
          </form>
        </StepContainer>
      )}

      {(step === 'otp' || step === 'verifying') && (
        <StepContainer key="otp">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold text-[var(--vv-fg,#433c35)]">Enter code</h2>
              <p className="text-[13px] text-[var(--vv-fg-muted,#6f6259)] mt-0.5 flex items-center gap-1.5">
                Sent to +91 {phoneInput}
                <button
                  onClick={handleEditPhone}
                  className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--vv-brand,#8c4630)] hover:bg-[var(--vv-brand-soft,#f0e4d3)]"
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
              className={`text-[13px] font-semibold shrink-0 mt-0.5 ${resendIn > 0 ? 'text-[var(--vv-fg-subtle,#8a7a6d)]' : 'text-[var(--vv-brand,#8c4630)] hover:underline'}`}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend'}
            </button>
          </div>

          {step === 'otp' ? (
            <>
              {/* Single logical OTP input: one value drives iOS/Android SMS
                  autofill (autocomplete=one-time-code) and paste. */}
              <input
                ref={otpInputRef}
                value={otpValue}
                onChange={(e) => handleOtpChange(e.target.value)}
                onPaste={handleOtpPaste}
                onKeyDown={handleOtpKey}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                enterKeyHint="done"
                maxLength={OTP_LENGTH}
                autoFocus={!isMobile}
                aria-label={`${OTP_LENGTH}-digit verification code`}
                aria-invalid={!!authError}
                aria-describedby={authError ? 'otp-error' : undefined}
                placeholder={'\u2022'.repeat(OTP_LENGTH)}
                disabled={submitting}
                className={`w-full h-14 text-center text-2xl font-bold tracking-[0.5em] indent-[0.5em] tabular-nums rounded-xl border bg-[var(--vv-bg-elevated,#fff7e9)] text-[var(--vv-fg,#433c35)] focus:outline-none focus:ring-[3px] transition ${
                  authError
                    ? 'border-[var(--vv-danger,#dc2626)] focus:border-[var(--vv-danger,#dc2626)] focus:ring-[var(--vv-danger,#dc2626)]/20'
                    : 'border-[var(--vv-border,#ded3bf)] focus:border-[var(--vv-brand,#8c4630)] focus:ring-[var(--vv-brand,#8c4630)]/20'
                }`}
              />
              {authError && (
                <InlineAuthError
                  id="otp-error"
                  error={authError}
                  onRetry={handleErrorRetry}
                  retryLabel={authError.kind === 'expired' ? 'Send new code' : 'Try again'}
                  onBack={handleEditPhone}
                />
              )}
            </>
          ) : (
            <div className="py-6 flex items-center justify-center gap-3 text-[var(--vv-fg-muted,#6f6259)]">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--vv-brand,#8c4630)]" />
              <span className="text-[15px] font-medium">Verifying…</span>
            </div>
          )}
        </StepContainer>
      )}

      {step === 'name' && (
        <StepContainer key="name">
          <h2 className="text-[17px] font-bold text-[var(--vv-fg,#433c35)]">Your name</h2>
          <form onSubmit={handleNameSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="e.g. Rohan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoFocus={!isMobile}
              autoComplete="name"
              aria-label="Your name"
              className="w-full h-12 px-4 border border-[var(--vv-border,#ded3bf)] bg-[var(--vv-bg-elevated,#fff7e9)] text-[var(--vv-fg,#433c35)] rounded-xl text-[16px] focus:outline-none focus:border-[var(--vv-brand,#8c4630)] focus:ring-[3px] focus:ring-[var(--vv-brand,#8c4630)]/20 transition"
            />
            {nameError && (
              <InlineAuthError
                error={nameError}
                onRetry={() => void saveNameNow()}
                retryLabel="Retry saving"
              />
            )}
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full h-12 rounded-xl bg-[var(--vv-brand,#8c4630)] text-white font-semibold text-[15px] hover:bg-[var(--vv-brand-hover,#6e3524)] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center"
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
          <Drawer.Content
            className="bg-[var(--vv-bg-elevated,#fff7e9)] text-[var(--vv-fg,#433c35)] flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 z-[10000] outline-none max-h-[100dvh] overflow-y-auto overscroll-contain"
            style={{ maxHeight: vvHeight ? `${vvHeight}px` : '100dvh' }}
          >
            <Drawer.Title className="sr-only">Sign in</Drawer.Title>
            <Drawer.Description className="sr-only">Phone verification</Drawer.Description>
            <div className="mx-auto w-10 h-1 rounded-full bg-[var(--vv-border-strong,#a68e7d)] mt-3 shrink-0" />
            <div className="px-5 pt-4 pb-[max(env(safe-area-inset-bottom),16px)]">
              {body}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-[var(--vv-bg-elevated,#fff7e9)] border-[var(--vv-border,#ded3bf)] text-[var(--vv-fg,#433c35)]">
        <DialogTitle className="sr-only">Sign in</DialogTitle>
        <DialogDescription className="sr-only">Phone verification</DialogDescription>
        <div className="h-1 w-full bg-gradient-to-r from-[var(--vv-brand,#8c4630)] via-[var(--vv-brand-hover,#6e3524)] to-[var(--vv-accent,#dea138)]" />
        <div className="px-6 py-5">{body}</div>
      </DialogContent>
    </Dialog>
  );
}

function InlineAuthError({
  error,
  onRetry,
  onBack,
  retryLabel,
  id,
}: {
  error: InlineError;
  onRetry?: () => void;
  onBack?: () => void;
  retryLabel?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="alert"
      className="rounded-xl border border-[var(--vv-danger,#dc2626)]/40 bg-[var(--vv-danger-soft,#f9e9e4)] px-3 py-2.5"
    >
      <p className="text-[13px] font-semibold text-[var(--vv-danger,#dc2626)]">{error.message}</p>
      <p className="mt-0.5 font-mono text-[11px] text-[var(--vv-fg-muted,#6f6259)]">
        {error.code} · {error.correlationId}
      </p>
      {(onRetry || onBack) && (
        <div className="mt-2 flex gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="h-9 px-4 rounded-lg bg-[var(--vv-brand,#8c4630)] text-white text-[13px] font-semibold hover:bg-[var(--vv-brand-hover,#6e3524)] active:scale-[0.98] transition"
            >
              {retryLabel || 'Try again'}
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="h-9 px-4 rounded-lg border border-[var(--vv-border,#ded3bf)] text-[var(--vv-fg,#433c35)] text-[13px] font-semibold hover:bg-[var(--vv-bg-inset,#ded3bf)] active:scale-[0.98] transition"
            >
              Back
            </button>
          )}
        </div>
      )}
    </div>
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
