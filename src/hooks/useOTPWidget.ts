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
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isConfigured || initializedRef.current) return;
    initializedRef.current = true;

    const config: MSG91Config = {
      widgetId: WIDGET_ID!,
      tokenAuth: TOKEN_AUTH!,
      exposeMethods: true,
      success: (data) => {
        setStep('success');
        onSuccessRef.current(
          data.mobile || phoneRef.current,
          data.countryCode || '91',
          data.message || ''
        );
      },
      failure: (err) => {
        const message = err.message || 'Verification failed';
        setError(message);
        onErrorRef.current?.(message);
      },
    };

    if (document.getElementById('msg91-otp-script')) {
      if (window.initSendOTP) {
        window.initSendOTP(config);
        setIsLoaded(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'msg91-otp-script';
    script.src = 'https://control.msg91.com/app/assets/otp-provider/otp-provider.js';
    script.async = true;
    script.onload = () => {
      setTimeout(() => {
        if (window.initSendOTP) {
          window.initSendOTP(config);
          setIsLoaded(true);
        } else {
          setError('OTP widget failed to initialize');
        }
      }, 500);
    };
    script.onerror = () => {
      setError('Failed to load OTP service');
    };
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
