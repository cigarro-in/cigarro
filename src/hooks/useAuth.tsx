import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabase/client';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void refreshUserData(session.user);
      } else {
        setUser(null);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshUserData = async (authUser: any) => {
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
    } finally {
      setIsLoading(false);
    }
  };

  const checkSession = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await refreshUserData(session.user);
      } else {
        setIsLoading(false);
      }
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

    const { error: setErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (setErr) throw setErr;

    // Force a profile refresh so consumers see the fresh user state
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await refreshUserData(session.user);

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
