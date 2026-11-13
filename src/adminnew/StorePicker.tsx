import { useEffect, useState } from 'react';
import { PhoneAuthDialog } from '../components/auth/PhoneAuthDialog';
import { AuthError } from '../hooks/useAuth';
import { listStoredSessionSlugs, storeSessionForStore } from '../lib/auth/session';

/**
 * admin.<root>/ with no store in the path. Phone-only sign-in: the OTP is
 * verified server-side, then the phone's admin stores are looked up and the
 * session opens the first one (or ?store= when that phone administers it).
 * Other stores are reached from the store menu in the sidebar, without a new OTP.
 */
export function StorePicker() {
  // A valid session already on this origin: go straight to that store.
  const [resumeSlug] = useState<string | null>(() => listStoredSessionSlugs()[0] ?? null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (resumeSlug) window.location.replace(`/${resumeSlug}/`);
  }, [resumeSlug]);

  // Runs after the MSG91 OTP is verified in PhoneAuthDialog. Errors thrown here
  // (for example NO_ADMIN_ACCESS) show inline in the dialog.
  const verifyAdminPhone = async ({ phone, token, countryCode }: { phone: string; token: string; countryCode: string }) => {
    let res: Response;
    try {
      res = await fetch('/api/auth/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, token, countryCode }),
      });
    } catch {
      throw new AuthError('Network error. Check your connection and try again.', { code: 'NETWORK' });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.cigarro_token || !data?.store) {
      throw new AuthError(data?.error || 'Sign-in failed. Try again.', {
        code: data?.code || `HTTP_${res.status}`,
      });
    }
    storeSessionForStore(data.store, data.cigarro_token, data.user_id, data.phone || phone);
    window.location.assign(`/${data.store}/`);
    return { isNewUser: false };
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-creme px-4">
      {resumeSlug ? (
        <p className="text-sm text-muted-foreground">Opening your store...</p>
      ) : (
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="font-bold text-lg">Cigarro Admin</p>
          <p className="text-sm text-muted-foreground">
            Sign in with your admin phone number. Your stores open after sign-in.
          </p>
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="h-11 w-full rounded-xl bg-canyon text-creme font-semibold text-base"
          >
            Sign in with phone
          </button>
        </div>
      )}
      <PhoneAuthDialog open={loginOpen} onOpenChange={setLoginOpen} onVerified={verifyAdminPhone} />
    </div>
  );
}
