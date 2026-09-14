import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { ConvexHttpClient } from 'convex/browser';
import { convex, convexUrl } from '../lib/convex/client';
import { api } from '../../convex/_generated/api';
import { getSession, getAccessToken, storeSession, clearSession, notifyAuthChanged } from '../lib/auth/session';
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

async function loadConvexUser(client: any = convex): Promise<User | null> {
  try {
    const profile = await client.query(api.userState.getMyProfile, {});
    if (!profile) return null;
    return {
      id: profile.userId,
      email: null,
      phone: profile.phone,
      name: profile.name || 'Customer',
      isAdmin: profile.isAdmin,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSession = async () => {
    try {
      // Own JWT only (auth cutover complete — no Supabase).
      if (getAccessToken()) {
        const u = await loadConvexUser();
        setUser(u);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    } catch (error) {
      logger.error('Session check error:', error);
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
      // Wake the reactive client so hooks use the new token from here on.
      notifyAuthChanged();
      // Handshake over a directly-authed client: the shared reactive client
      // still holds the pre-login (empty) auth on its live socket, so these
      // calls would go out unauthenticated until it re-auths (hence the
      // login-then-refresh dance).
      const handshake = new ConvexHttpClient(convexUrl);
      handshake.setAuth(data.cigarro_token);
      try {
        await handshake.mutation(api.userState.ensureMyProfile, {
          phone: phone || undefined,
          name: args.name || undefined,
        });
      } catch (e) {
        logger.error('Profile spine error', e);
      }
      const u = await loadConvexUser(handshake);
      if (!u) {
        clearSession();
        throw new Error('Profile unavailable — please try again');
      }
      setUser(u);
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
