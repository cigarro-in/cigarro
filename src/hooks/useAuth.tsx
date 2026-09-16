import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
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
    const res = await fetch('/api/auth/phone-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Phone verification failed');
    }

    // Own JWT (auth cutover complete — the server always mints one).
    if (!data.cigarro_token || !data.user_id) {
      throw new Error('Invalid server response — missing token');
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
    <AuthContext.Provider value={{ user, isLoading, signInWithPhone, signOut }}>
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
