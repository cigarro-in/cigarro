import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase/client';
import { AdminUser } from '../types/admin';
import { securityManager } from '../utils/security';
import { auditLogger } from '../utils/audit-logger';

interface AdminAuthState {
  user: User | null;
  adminProfile: AdminUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
  error: string | null;
}

interface AdminAuthContext extends AdminAuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  checkAdminAccess: () => Promise<boolean>;
}

export function useAdminAuth(): AdminAuthContext {
  const [authState, setAuthState] = useState<AdminAuthState>({
    user: null,
    adminProfile: null,
    isLoading: true,
    isAdmin: false,
    hasAccess: false,
    error: null
  });

  // Initialize auth state
  useEffect(() => {
    initializeAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await loadAdminProfile(session.user);
          await auditLogger.logSecurityEvent('admin_login', {
            user_id: session.user.id,
            email: session.user.email
          });
        } else if (event === 'SIGNED_OUT') {
          setAuthState(prev => ({
            ...prev,
            user: null,
            adminProfile: null,
            isAdmin: false,
            hasAccess: false,
            error: null
          }));
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const initializeAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }
      
      if (session?.user) {
        await loadAdminProfile(session.user);
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to initialize authentication'
      }));
    }
  };

  const loadAdminProfile = async (user: User) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      const adminProfile: AdminUser = {
        id: user.id,
        email: user.email || '',
        full_name: profile?.full_name,
        is_admin: profile?.is_admin || false,
        is_active: profile?.is_active || false,
        last_sign_in_at: user.last_sign_in_at,
        created_at: user.created_at || '',
        updated_at: profile?.updated_at || ''
      };

      const hasAccess = adminProfile.is_admin && adminProfile.is_active;

      setAuthState(prev => ({
        ...prev,
        user,
        adminProfile,
        isAdmin: adminProfile.is_admin,
        hasAccess,
        isLoading: false,
        error: null
      }));

      // Log admin access attempt
      if (adminProfile.is_admin) {
        await auditLogger.logSecurityEvent('admin_access', {
          user_id: user.id,
          has_access: hasAccess,
          reason: hasAccess ? 'valid_admin' : 'inactive_admin'
        });
      }

    } catch (error) {
      console.error('Error loading admin profile:', error);
      setAuthState(prev => ({
        ...prev,
        user,
        adminProfile: null,
        isAdmin: false,
        hasAccess: false,
        isLoading: false,
        error: 'Failed to load admin profile'
      }));
    }
  };

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // Security check: Rate limiting
      const rateLimitCheck = await securityManager.checkRateLimit(`admin_login_${email}`);
      if (!rateLimitCheck.allowed) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Validate email format
      if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      // Validate password strength
      if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password
      });

      if (error) {
        // Log failed login attempt
        await auditLogger.logSecurityEvent('admin_login_failed', {
          email,
          error: error.message,
          ip_address: await getClientIP()
        });
        
        throw error;
      }

      if (!data.user) {
        throw new Error('Login failed - no user data received');
      }

      // User will be loaded via auth state change listener
      
    } catch (error: any) {
      console.error('Sign in error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed'
      }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // Log admin logout
      if (authState.user) {
        await auditLogger.logSecurityEvent('admin_logout', {
          user_id: authState.user.id
        });
      }

      // Sign out from all sessions (global scope)
      const { error } = await supabase.auth.signOut({ scope: 'global' });

      if (error) {
        throw error;
      }

      // Clear all local storage related to auth
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();

      // Clear state
      setAuthState({
        user: null,
        adminProfile: null,
        isLoading: false,
        isAdmin: false,
        hasAccess: false,
        error: null
      });

      // Force reload to clear any cached data
      window.location.href = '/';

    } catch (error: any) {
      console.error('Sign out error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Logout failed'
      }));
      throw error;
    }
  }, [authState.user]);

  const refreshAuth = useCallback(async (): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (session?.user) {
        await loadAdminProfile(session.user);
      } else {
        setAuthState(prev => ({
          ...prev,
          user: null,
          adminProfile: null,
          isAdmin: false,
          hasAccess: false,
          isLoading: false
        }));
      }
    } catch (error: any) {
      console.error('Refresh auth error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to refresh authentication'
      }));
    }
  }, []);

  const checkAdminAccess = useCallback(async (): Promise<boolean> => {
    try {
      if (!authState.user) {
        return false;
      }

      // Re-check admin status from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin, is_active')
        .eq('id', authState.user.id)
        .single();

      if (error || !profile) {
        return false;
      }

      const hasAccess = profile.is_admin && profile.is_active;

      // Update state if access status changed
      if (hasAccess !== authState.hasAccess) {
        setAuthState(prev => ({
          ...prev,
          isAdmin: profile.is_admin,
          hasAccess,
          adminProfile: prev.adminProfile ? {
            ...prev.adminProfile,
            is_admin: profile.is_admin,
            is_active: profile.is_active
          } : null
        }));

        // Log access status change
        await auditLogger.logSecurityEvent('admin_access_changed', {
          user_id: authState.user.id,
          new_access: hasAccess,
          previous_access: authState.hasAccess
        });
      }

      return hasAccess;

    } catch (error) {
      console.error('Error checking admin access:', error);
      return false;
    }
  }, [authState.user, authState.hasAccess, authState.adminProfile]);

  return {
    ...authState,
    signIn,
    signOut,
    refreshAuth,
    checkAdminAccess
  };
}

// Helper function to get client IP (placeholder for now)
async function getClientIP(): Promise<string> {
  try {
    // In a real implementation, you might want to use a service to get the IP
    // For now, we'll return a placeholder
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// Export a custom hook for components that require admin access
export function useRequireAdmin() {
  const auth = useAdminAuth();
  
  useEffect(() => {
    if (!auth.isLoading && !auth.hasAccess) {
      // Redirect to login or show access denied
      console.warn('Admin access required but not available');
    }
  }, [auth.isLoading, auth.hasAccess]);

  return auth;
}

// Export hook for admin route protection
export function useAdminGuard() {
  const auth = useAdminAuth();
  
  const isAuthorized = auth.hasAccess && !auth.isLoading;
  const isLoading = auth.isLoading;
  const shouldRedirect = !auth.isLoading && !auth.hasAccess;
  
  return {
    isAuthorized,
    isLoading,
    shouldRedirect,
    user: auth.user,
    adminProfile: auth.adminProfile,
    error: auth.error
  };
}

