import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { ConvexHttpClient } from 'convex/browser';
import { supabase } from '../lib/supabase/client';
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

async function refreshLegacyUserData(authUser: any, setUser: (u: User | null) => void) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profile) {
      setUser({
        id: profile.id,
        email: profile.email || null,
        phone: profile.phone || authUser.phone || null,
        name: profile.name || authUser.user_metadata?.name || 'Customer',
        isAdmin: !!profile.is_admin,
      });
    } else {
      setUser({
        id: authUser.id,
        email: authUser.email || null,
        phone: authUser.phone || null,
        name: authUser.user_metadata?.name || 'Customer',
        isAdmin: !!authUser.user_metadata?.isAdmin,
      });
    }
  } catch (error) {
    logger.error('User data refresh error:', error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void checkSession();
    // Legacy Supabase listener stays during the soak (dual-client).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !getAccessToken()) {
        void refreshLegacyUserData(session.user, setUser).finally(() => setIsLoading(false));
      } else if (!session && !getAccessToken()) {
        setUser(null);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSession = async () => {
    try {
      // Ours first (Phase 2); Supabase fallback during the soak.
      if (getAccessToken()) {
        const u = await loadConvexUser();
        if (u) {
          setUser(u);
          setIsLoading(false);
          return;
        }
        // Token Convex won't accept yet (config deploy lag) — fall through
        // to the Supabase session instead of signing the user out.
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await refreshLegacyUserData(session.user, setUser);
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

    // Phase 2 path: server minted our JWT (sub = stable userId).
    if (data.cigarro_token && data.user_id) {
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
      if (u) {
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
      // Convex rejected our token (trust config not deployed yet) — drop it
      // and fall through to the legacy Supabase session so login still works.
      clearSession();
    }

    // Legacy fallback (dual-issuer soak / JWT env not set).
    if (!data.token_hash || !data.email) {
      throw new Error('Invalid server response — missing token_hash/email');
    }
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    } as any);
    if (verifyErr) {
      // eslint-disable-next-line no-console
      console.error('[signInWithPhone] verifyOtp error:', verifyErr);
      throw verifyErr;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await refreshLegacyUserData(session.user, setUser);

      try {
        if (await shouldTransferGuestData(session.user.id)) {
          await transferGuestDataToUser(session.user.id);
        }
      } catch (e) {
        logger.error('Guest data transfer error', e);
      }
    }

    return { isNewUser: !!data.is_new_user };
  };

  const signOut = async () => {
    try {
      clearSession();
      notifyAuthChanged();
      await supabase.auth.signOut();
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
