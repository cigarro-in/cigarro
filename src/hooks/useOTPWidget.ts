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
import type { MSG91Config } from '../types/msg91';

interface OTPWidgetProps {
  onSuccess: (phone: string, countryCode: string, token: string) => void;
  onError?: (error: string) => void;
}

const WIDGET_ID = import.meta.env.VITE_MSG91_WIDGET_ID as string | undefined;
const TOKEN_AUTH = import.meta.env.VITE_MSG91_TOKEN_AUTH as string | undefined;

// MSG91 defines a custom element (`h-captcha`) on init. Calling initSendOTP a
// second time re-runs customElements.define → DOMException → half-init state
// where `hcaptchaService` never gets assigned → later sendOtp crashes.
// Guard globally so we only init once per page lifetime. Callbacks are stored
// in a dispatcher that the singleton widget forwards to whichever component
// is currently "active".
type WidgetCallbacks = {
  success: (data: { mobile?: string; countryCode?: string; message?: string }) => void;
  failure: (err: { message?: string }) => void;
};
const widgetState: {
  loadStarted: boolean;
  initialized: boolean;
  activeCallbacks: WidgetCallbacks | null;
  scriptLoadListeners: Array<() => void>;
} = {
  loadStarted: false,
  initialized: false,
  activeCallbacks: null,
  scriptLoadListeners: [],
};

export function useOTPWidget({ onSuccess, onError }: OTPWidgetProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const phoneRef = useRef(phone);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  phoneRef.current = phone;

  const isConfigured = !!WIDGET_ID && !!TOKEN_AUTH;

  // Register this component's callbacks with the singleton dispatcher so the
  // already-initialized widget's success/failure routes to the current caller.
  useEffect(() => {
    if (!isConfigured) return;
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
        const message = err.message || 'Verification failed';
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
  }, [isConfigured]);

  // Ensure the MSG91 script is loaded and initSendOTP is called exactly once
  // per page lifetime. Subsequent mounts just mark themselves as loaded.
  useEffect(() => {
    if (!isConfigured) return;

    const markLoadedWhenInitialized = () => {
      if (widgetState.initialized) {
        setIsLoaded(true);
      } else {
        widgetState.scriptLoadListeners.push(() => setIsLoaded(true));
      }
    };

    if (widgetState.initialized) {
      setIsLoaded(true);
      return;
    }

    if (widgetState.loadStarted) {
      markLoadedWhenInitialized();
      return;
    }

    widgetState.loadStarted = true;

    const config: MSG91Config = {
      widgetId: WIDGET_ID!,
      tokenAuth: TOKEN_AUTH!,
      exposeMethods: true,
      success: (data) => widgetState.activeCallbacks?.success(data),
      failure: (err) => widgetState.activeCallbacks?.failure(err),
    };

    const initOnce = () => {
      if (widgetState.initialized) return;
      if (!window.initSendOTP) return;
      try {
        window.initSendOTP(config);
        widgetState.initialized = true;
        setIsLoaded(true);
        for (const fn of widgetState.scriptLoadListeners) fn();
        widgetState.scriptLoadListeners = [];
      } catch (e) {
        setError('OTP widget failed to initialize');
      }
    };

    const pollForInit = () => {
      let attempts = 0;
      const max = 50; // 10 s @ 200 ms
      const iv = setInterval(() => {
        attempts += 1;
        if (window.initSendOTP) {
          clearInterval(iv);
          initOnce();
        } else if (attempts >= max) {
          clearInterval(iv);
          setError('OTP service took too long to load');
        }
      }, 200);
    };

    const existing = document.getElementById('msg91-otp-script');
    if (existing) {
      // Script is already on the page from a previous mount — don't add another.
      if (window.initSendOTP) initOnce();
      else pollForInit();
      return;
    }

    const script = document.createElement('script');
    script.id = 'msg91-otp-script';
    script.src = 'https://control.msg91.com/app/assets/otp-provider/otp-provider.js';
    script.async = true;
    script.onload = pollForInit;
    script.onerror = () => setError('Failed to load OTP service');
    document.body.appendChild(script);
  }, [isConfigured]);

  const sendOTP = useCallback(
    (phoneNumber: string) => {
      if (!isLoaded || !window.sendOtp) {
        setError('OTP service not ready');
        return;
      }

      setIsLoading(true);
      setError('');
      setPhone(phoneNumber);
      phoneRef.current = phoneNumber;

      const formattedPhone = phoneNumber.startsWith('91') ? phoneNumber : `91${phoneNumber}`;

      window.sendOtp(
        formattedPhone,
        () => {
          setStep('otp');
          setIsLoading(false);
        },
        (err) => {
          setError(err.message || 'Failed to send OTP');
          setIsLoading(false);
        }
      );
    },
    [isLoaded]
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
          onSuccessRef.current(
            data.mobile || phoneRef.current,
            data.countryCode || '91',
            data.message || ''
          );
        },
        (err) => {
          setError(err.message || 'Invalid OTP');
          setIsLoading(false);
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
