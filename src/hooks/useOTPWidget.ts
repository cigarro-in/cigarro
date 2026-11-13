/**
 * MSG91 OTP Widget hook.
 *
 * Loads the MSG91 OTP provider script, initializes the widget, and exposes
 * sendOTP / verifyOTP / resendOTP methods. On successful verification, the
 * widget returns a one-time JWT (`data.message`) that must be POSTed to
 * /api/auth/phone-verify for server-side verification + session creation.
 *
 * Env:
 *   VITE_MSG91_WIDGET_ID
 *   VITE_MSG91_TOKEN_AUTH
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { MSG91Config, MSG91Error } from '../types/msg91';
import { reportCrash } from '../lib/crashReporting';

interface OTPWidgetProps {
  onSuccess: (phone: string, countryCode: string, token: string) => void;
  onError?: (error: string) => void;
  // Only the currently-open dialog claims the singleton widget's callbacks.
  // Mounted-but-closed dialogs (header + bottom-nav + page hosts) must not
  // steal results. Defaults to true to preserve the existing contract.
  enabled?: boolean;
}

export interface SendOTPCallbacks {
  onSent?: () => void;
  // `code` is a stable identifier for the inline error (never contains PII).
  onFailed?: (message: string, code?: string) => void;
}

const WIDGET_ID = import.meta.env.VITE_MSG91_WIDGET_ID as string | undefined;
const TOKEN_AUTH = import.meta.env.VITE_MSG91_TOKEN_AUTH as string | undefined;
const SCRIPT_URL = 'https://control.msg91.com/app/assets/otp-provider/otp-provider.js';
// A send that the widget never answers must not leave the spinner running.
const SEND_TIMEOUT_MS = 20_000;
const INIT_POLL_MS = 200;
const INIT_POLL_MAX = 50; // 10 s total

// MSG91 defines a custom element (`h-captcha`) on init. Calling initSendOTP a
// second time re-runs customElements.define → DOMException → half-init state
// where `hcaptchaService` never gets assigned → later sendOtp crashes.
// Guard globally so we only init once per page lifetime. Callbacks are stored
// in a dispatcher that the singleton widget forwards to whichever component
// is currently "active".
type WidgetCallbacks = {
  success: (data: { mobile?: string; countryCode?: string; message?: string }) => void;
  failure: (err: MSG91Error) => void;
};
const widgetState: {
  loadStarted: boolean;
  initialized: boolean;
  loadError: string | null;
  activeCallbacks: WidgetCallbacks | null;
  scriptLoadListeners: Array<() => void>;
  scriptFailListeners: Array<(message: string) => void>;
} = {
  loadStarted: false,
  initialized: false,
  loadError: null,
  activeCallbacks: null,
  scriptLoadListeners: [],
  scriptFailListeners: [],
};

// Fail the script load for every mounted instance and remember it, so
// instances mounted later also see the error instead of spinning forever.
function markLoadFailed(message: string, code: string): void {
  if (widgetState.loadError) return;
  widgetState.loadError = message;
  reportOtpFailure('otp.loadScript', message, code);
  const listeners = widgetState.scriptFailListeners;
  widgetState.scriptFailListeners = [];
  widgetState.scriptLoadListeners = [];
  for (const fn of listeners) fn(message);
}

// Provider error codes are short identifiers; strip anything else.
function providerCodeOf(err: MSG91Error | undefined, fallback: string): string {
  const raw = (err as { code?: unknown } | undefined)?.code;
  if (typeof raw !== 'string' && typeof raw !== 'number') return fallback;
  const clean = String(raw).replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
  return clean ? `OTP_PROVIDER_${clean}` : fallback;
}

// Reports never include the phone number: digit runs are masked before send.
function reportOtpFailure(operation: string, message: string, code: string): void {
  const masked = message.replace(/\d{4,}/g, '[num]').slice(0, 500);
  reportCrash(new Error(`[${code}] ${masked}`), { source: 'app', operation });
}

type SendResult = { ok: true } | { ok: false; message: string; code: string };
type PendingSend = { id: number; cbs: SendOTPCallbacks; timer: ReturnType<typeof setTimeout> };

export function useOTPWidget({ onSuccess, onError, enabled = true }: OTPWidgetProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const phoneRef = useRef(phone);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  phoneRef.current = phone;

  const pendingSendRef = useRef<PendingSend | null>(null);
  const sendSeqRef = useRef(0);

  const isConfigured = !!WIDGET_ID && !!TOKEN_AUTH;

  // Settles the in-flight sendOtp exactly once. `id` null means "whatever send
  // is pending" (the singleton global failure callback carries no request id).
  const settleSend = useCallback((id: number | null, result: SendResult): boolean => {
    const pending = pendingSendRef.current;
    if (!pending || (id !== null && pending.id !== id)) return false;
    pendingSendRef.current = null;
    clearTimeout(pending.timer);
    setIsLoading(false);
    if (result.ok) {
      setStep('otp');
      pending.cbs.onSent?.();
    } else {
      setError(result.message);
      reportOtpFailure('otp.sendOtp', result.message, result.code);
      pending.cbs.onFailed?.(result.message, result.code);
    }
    return true;
  }, []);

  // Register this component's callbacks with the singleton dispatcher so the
  // already-initialized widget's success/failure routes to the current caller.
  // Claimed only while `enabled` (dialog open) — a mounted-but-closed dialog
  // releases the dispatcher on close so it can never intercept another
  // dialog's OTP result.
  useEffect(() => {
    if (!isConfigured || !enabled) return;
    const callbacks: WidgetCallbacks = {
      success: (data) => {
        setStep('success');
        onSuccessRef.current(
          data.mobile || phoneRef.current,
          data.countryCode || '91',
          data.message || '',
        );
      },
      failure: (err) => {
        // A failure during an in-flight send belongs to that send's caller.
        if (settleSend(null, {
          ok: false,
          message: err?.message || 'Failed to send OTP',
          code: providerCodeOf(err, 'OTP_SEND_FAILED'),
        })) return;
        const message = err?.message || 'Verification failed';
        setError(message);
        onErrorRef.current?.(message);
      },
    };
    widgetState.activeCallbacks = callbacks;
    return () => {
      if (widgetState.activeCallbacks === callbacks) {
        widgetState.activeCallbacks = null;
      }
    };
  }, [isConfigured, enabled, settleSend]);

  // Ensure the MSG91 script is loaded and initSendOTP is called exactly once
  // per page lifetime. Subsequent mounts just mark themselves as loaded.
  useEffect(() => {
    if (!isConfigured) return;

    if (widgetState.initialized) {
      setIsLoaded(true);
      return;
    }
    if (widgetState.loadError) {
      setLoadError(widgetState.loadError);
      return;
    }

    widgetState.scriptLoadListeners.push(() => setIsLoaded(true));
    widgetState.scriptFailListeners.push((message) => setLoadError(message));

    if (widgetState.loadStarted) return;
    widgetState.loadStarted = true;

    const config: MSG91Config = {
      widgetId: WIDGET_ID!,
      tokenAuth: TOKEN_AUTH!,
      exposeMethods: true,
      success: (data) => widgetState.activeCallbacks?.success(data),
      failure: (err) => widgetState.activeCallbacks?.failure(err),
    };

    const initOnce = () => {
      if (widgetState.initialized || widgetState.loadError) return;
      if (typeof window.initSendOTP !== 'function') return;
      try {
        window.initSendOTP(config);
        widgetState.initialized = true;
        const listeners = widgetState.scriptLoadListeners;
        widgetState.scriptLoadListeners = [];
        widgetState.scriptFailListeners = [];
        for (const fn of listeners) fn();
      } catch {
        markLoadFailed('OTP widget failed to initialize', 'OTP_INIT_FAILED');
      }
    };

    const pollForInit = () => {
      let attempts = 0;
      const iv = setInterval(() => {
        attempts += 1;
        if (typeof window.initSendOTP === 'function') {
          clearInterval(iv);
          initOnce();
        } else if (attempts >= INIT_POLL_MAX) {
          clearInterval(iv);
          markLoadFailed('OTP service took too long to load', 'OTP_LOAD_TIMEOUT');
        }
      }, INIT_POLL_MS);
    };

    const existing = document.getElementById('msg91-otp-script');
    if (existing) {
      // Script is already on the page from a previous mount — don't add another.
      if (typeof window.initSendOTP === 'function') initOnce();
      else pollForInit();
      return;
    }

    const script = document.createElement('script');
    script.id = 'msg91-otp-script';
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = pollForInit;
    script.onerror = () => markLoadFailed('Failed to load OTP service', 'OTP_SCRIPT_LOAD');
    document.body.appendChild(script);
  }, [isConfigured]);

  const sendOTP = useCallback(
    (phoneNumber: string, cbs?: SendOTPCallbacks) => {
      // One send at a time; a second tap while sending is ignored.
      if (pendingSendRef.current) return;

      const failNow = (message: string, code: string) => {
        setError(message);
        reportOtpFailure('otp.sendOtp', message, code);
        cbs?.onFailed?.(message, code);
      };

      if (!isLoaded) {
        if (loadError) failNow(loadError, 'OTP_SCRIPT_LOAD');
        else failNow('OTP service not ready', 'OTP_NOT_READY');
        return;
      }
      const send = window.sendOtp;
      if (typeof send !== 'function') {
        failNow('Sign-in service is unavailable. Reload the page and try again.', 'OTP_UNAVAILABLE');
        return;
      }

      setIsLoading(true);
      setError('');
      setPhone(phoneNumber);
      phoneRef.current = phoneNumber;

      const formattedPhone = phoneNumber.startsWith('91') ? phoneNumber : `91${phoneNumber}`;

      sendSeqRef.current += 1;
      const id = sendSeqRef.current;
      const timer = setTimeout(() => {
        // shortcut: the widget's callback often never fires when its
        // captcha scripts are blocked, yet the SMS is already dispatched
        // server-side. Advance so the received code can be entered; the
        // resend flow covers the genuinely-unsent case. Revisit if the
        // provider adds a reliable send-ack signal.
        settleSend(id, { ok: true });
      }, SEND_TIMEOUT_MS);
      pendingSendRef.current = { id, cbs: cbs ?? {}, timer };

      try {
        window.sendOtp!(
          formattedPhone,
          () => {
            settleSend(id, { ok: true });
          },
          (err) => {
            settleSend(id, {
              ok: false,
              message: err?.message || 'Failed to send OTP',
              code: providerCodeOf(err, 'OTP_SEND_FAILED'),
            });
          }
        );
      } catch {
        settleSend(id, {
          ok: false,
          message: 'Could not reach the SMS service. Try again.',
          code: 'OTP_THROW',
        });
      }
    },
    [isLoaded, loadError, settleSend]
  );

  const verifyOTP = useCallback(
    (otp: string) => {
      if (!isLoaded || !window.verifyOtp) {
        setError('OTP service not ready');
        return;
      }

      setIsLoading(true);
      setError('');

      window.verifyOtp(
        otp,
        (data) => {
          setStep('success');
          setIsLoading(false);
          // Route through the singleton dispatcher so only the currently-open
          // (claiming) dialog receives the result — never a stale background
          // mount. Fall back to local refs when nobody claimed (unmounted).
          const claimed = widgetState.activeCallbacks?.success;
          if (claimed) {
            claimed(data);
          } else {
            onSuccessRef.current(
              data.mobile || phoneRef.current,
              data.countryCode || '91',
              data.message || ''
            );
          }
        },
        (err) => {
          setIsLoading(false);
          const message = err.message || 'Invalid OTP';
          const claimed = widgetState.activeCallbacks?.failure;
          if (claimed) {
            claimed(err);
          } else {
            setError(message);
            onErrorRef.current?.(message);
          }
        }
      );
    },
    [isLoaded]
  );

  const resendOTP = useCallback(() => {
    if (!isLoaded || !window.retryOtp) {
      setError('OTP service not ready');
      return;
    }

    setIsLoading(true);
    setError('');

    window.retryOtp(
      null,
      () => setIsLoading(false),
      (err) => {
        setError(err.message || 'Failed to resend OTP');
        setIsLoading(false);
      }
    );
  }, [isLoaded]);

  const reset = useCallback(() => {
    setStep('phone');
    setPhone('');
    setError('');
  }, []);

  return {
    isConfigured,
    isLoaded,
    isLoading,
    loadError,
    step,
    phone,
    error,
    sendOTP,
    verifyOTP,
    resendOTP,
    reset,
    setError,
  };
}
