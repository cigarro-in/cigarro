import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabase/client';
import { transferGuestDataToUser, shouldTransferGuestData } from '../utils/userDataTransfer';
import { logger } from '../utils/logger';

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const refreshUserData = async (authUser: any) => {
    try {
      // Get user profile from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
        
      if (profileError) {
        // If profile doesn't exist, create a basic user object from session
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
          isAdmin: authUser.user_metadata?.isAdmin || false
        });
      } else if (profile) {
        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          isAdmin: profile.is_admin
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
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session?.user) {
        await refreshUserData(session.user);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      // Log error securely without exposing sensitive information
      logger.error('Session check error:', error);
      setIsLoading(false);
    } finally {
      setIsInitialized(true);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Get user profile from profiles table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
          
        if (profileError) {
          logger.warn('Profile fetch error after signin:', profileError);
          // If profile doesn't exist, create it
          const newUser = {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
            isAdmin: data.user.user_metadata?.isAdmin || false
          };
          
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              is_admin: newUser.isAdmin
            });
            
          if (insertError) {
            logger.error('Failed to create profile on sign-in:', insertError);
            // Even if creation fails, set user from auth data
            setUser(newUser);
          } else {
            setUser(newUser);
          }
        } else if (profile) {
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            isAdmin: profile.is_admin
          });
        }
      }
    } catch (error: any) {
      logger.error('Sign in error:', error);
      // Pass the error message through for better handling in the UI
      throw new Error(error?.message || 'Failed to sign in');
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const payload = {
        email,
        password,
        options: {
          data: {
            name,
            isAdmin: false,
          }
        }
      };

      const { data, error } = await supabase.auth.signUp(payload);

      if (error) throw error;

      if (data.user && data.session) {
        // The profile will be created automatically by the trigger
        // Wait a moment for the trigger to complete, then get the profile
        setTimeout(async () => {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user!.id)
            .single();
            
          let newUser: User;
          if (profileError) {
            // Use the data we have from signup
            newUser = {
              id: data.user!.id,
              email: data.user!.email || '',
              name: name || data.user!.email?.split('@')[0] || 'User',
              isAdmin: false // Always false for new signups
            };
          } else if (profile) {
            newUser = {
              id: profile.id,
              email: profile.email,
              name: profile.name,
              isAdmin: profile.is_admin
            };
          } else {
            return; // No profile data available
          }

          setUser(newUser);

          // Transfer guest data to new user account
          try {
            const shouldTransfer = await shouldTransferGuestData(newUser.id);
            if (shouldTransfer) {
              await transferGuestDataToUser(newUser.id);
            }
          } catch (error) {
            logger.error('Error during guest data transfer:', error);
            // Don't throw error as user account creation was successful
          }
        }, 1500); // Increased timeout slightly
      }
    } catch (error: any) {
      logger.error('Sign up error:', error);
      // Pass the error message through for better handling in the UI
      throw new Error(error?.message || 'Failed to create account');
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) throw error;
      
      // The actual user session will be handled by the auth state change listener
      // after the OAuth redirect completes
    } catch (error: any) {
      logger.error('Google sign in error:', error);
      throw new Error(error?.message || 'Failed to sign in with Google');
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      logger.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signInWithGoogle, signOut }}>
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
