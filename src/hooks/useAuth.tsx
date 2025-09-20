import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../utils/supabase/client';
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session?.user) {
        // Get user profile from profiles table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (profileError) {
          logger.warn('Profile fetch error:', profileError);
          // If profile doesn't exist, create a basic user object from session
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            isAdmin: session.user.user_metadata?.isAdmin || false
          });
        } else if (profile) {
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            isAdmin: profile.is_admin
          });
        }
      }
    } catch (error) {
      // Log error securely without exposing sensitive information
      logger.error('Session check error:', error);
    } finally {
      setIsLoading(false);
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            isAdmin: false, // Always set to false - admin accounts cannot be created through signup
          }
        }
      });

      if (error) throw error;

      if (data.user) {
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
            logger.warn('Profile fetch error after signup:', profileError);
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
              logger.info('Transferring guest data to new user account');
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
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
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
