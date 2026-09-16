import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { ConvexHttpClient } from 'convex/browser';
import { convexUrl } from '../lib/convex/client';
import { api } from '../../convex/_generated/api';
import { getSession, storeSession, clearSession, notifyAuthChanged } from '../lib/auth/session';
import { ORG_SLUG } from '../lib/convex/org';
import { transferGuestDataToUser, shouldTransferGuestData } from '../utils/userDataTransfer';
import { logger } from '../utils/logger';

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  isAdmin: boolean;
}

interface PhoneSignInArgs {
  phone: string;
  token: string;
  name?: string;
  countryCode?: string;
}

interface PhoneSignInResult {
  isNewUser: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithPhone: (args: PhoneSignInArgs) => Promise<PhoneSignInResult>;
  signOut: () => Promise<void>;
  // Single global auth-dialog controller: exactly one dialog host is mounted
  // (AppContent) and every trigger (header, bottom nav, theme shells) opens
  // it via requestAuth instead of mounting its own dialog.
  authDialog: AuthDialogRequest;
  requestAuth: (opts?: { onSuccess?: () => void }) => void;
  closeAuthDialog: () => void;
}

// Classified session error: still an Error (message contract preserved) but
// carries the HTTP status as `code` and a per-attempt `correlationId` so the
// dialog can render inline retry/back UI with a stable reference.
export class AuthError extends Error {
  code?: string;
  correlationId?: string;
  constructor(message: string, opts?: { code?: string; correlationId?: string }) {
    super(message);
    Object.setPrototypeOf(this, AuthError.prototype);
    this.name = 'AuthError';
    if (opts?.code) this.code = opts.code;
    if (opts?.correlationId) this.correlationId = opts.correlationId;
  }
}

export function newAuthCorrelationId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID().slice(0, 8);
    }
  } catch {
    // fall through to Math.random below
  }
  return Math.random().toString(36).slice(2, 10);
}

export interface AuthDialogRequest {
  open: boolean;
  onSuccess?: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadConvexUser(client: ConvexHttpClient): Promise<User> {
  const profile = await client.query(api.userState.getMyProfile, {});
  return {
    id: profile.userId,
    email: null,
    phone: profile.phone,
    name: profile.name || 'Customer',
    isAdmin: profile.isAdmin,
  };
}

async function establishCustomerSession(
  token: string,
  profile: { phone?: string; name?: string } = {},
): Promise<User> {
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  const org = await client.query(api.organizations.getBySlug, { slug: ORG_SLUG });
  if (!org) throw new Error('Store unavailable');
  await client.mutation(api.userState.ensureMyProfile, {
    orgSlug: ORG_SLUG,
    phone: profile.phone || undefined,
    name: profile.name || undefined,
  });
  return loadConvexUser(client);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authDialog, setAuthDialog] = useState<AuthDialogRequest>({ open: false });

  const requestAuth = useCallback((opts?: { onSuccess?: () => void }) => {
    setAuthDialog({ open: true, onSuccess: opts?.onSuccess });
  }, []);

  const closeAuthDialog = useCallback(() => {
    setAuthDialog((s) => (s.open ? { open: false, onSuccess: s.onSuccess } : s));
  }, []);

  useEffect(() => {
    void checkSession();
    const onStorage = () => void checkSession();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSession = async () => {
    try {
      // Own JWT only (auth cutover complete — no Supabase).
      const session = getSession();
      if (session) {
        const u = await establishCustomerSession(session.token, {
          phone: session.phone,
        });
        setUser(u);
      } else {
        setUser(null);
      }
    } catch (error) {
      logger.error('Session check error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithPhone = async (args: PhoneSignInArgs): Promise<PhoneSignInResult> => {
    const correlationId = newAuthCorrelationId();
    let res: Response;
    try {
      res = await fetch('/api/auth/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
    } catch {
      throw new AuthError('Network error — check your connection and try again', {
        code: 'NETWORK',
        correlationId,
      });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new AuthError(data?.error || 'Phone verification failed', {
        code: `HTTP_${res.status}`,
        correlationId: data?.correlation_id || correlationId,
      });
    }

    // Own JWT (auth cutover complete — the server always mints one).
    if (!data?.cigarro_token || !data?.user_id) {
      throw new AuthError('Invalid server response — missing token', {
        code: 'BAD_RESPONSE',
        correlationId,
      });
    }
    {
      const phone = data.user_id && args.phone ? args.phone : '';
      storeSession(data.cigarro_token, data.user_id, phone);
      // Handshake over a directly-authed client: the shared reactive client
      // still holds the pre-login (empty) auth on its live socket, so these
      // calls would go out unauthenticated until it re-auths (hence the
      // login-then-refresh dance).
      try {
        const u = await establishCustomerSession(data.cigarro_token, {
          phone: phone || undefined,
          name: args.name || undefined,
        });
        setUser(u);
        // Wake the reactive client only after the customer profile and
        // membership are ready, so mounted queries cannot race the bootstrap.
        notifyAuthChanged();
      } catch (error) {
        clearSession();
        notifyAuthChanged();
        logger.error('Customer session setup error', error);
        throw error;
      }
      try {
        if (await shouldTransferGuestData(data.user_id)) {
          await transferGuestDataToUser(data.user_id);
        }
      } catch (e) {
        logger.error('Guest data transfer error', e);
      }
      return { isNewUser: !!data.is_new_user };
    }
  };

  const signOut = async () => {
    try {
      clearSession();
      notifyAuthChanged();
      setUser(null);
    } catch (error) {
      logger.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, signInWithPhone, signOut, authDialog, requestAuth, closeAuthDialog }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Narrow accessor for dialog triggers (header, bottom nav, theme shells).
export function useAuthDialog() {
  const { authDialog, requestAuth, closeAuthDialog } = useAuth();
  return {
    open: authDialog.open,
    onSuccess: authDialog.onSuccess,
    requestAuth,
    closeAuthDialog,
  };
}
