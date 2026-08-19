/**
 * AuthContext.tsx
 * React Context providing authenticated patient state, profile data,
 * login, registration, and logout operations.
 *
 * Automatically restores valid Supabase sessions on browser refresh.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { ProfileRow } from '../types/database';
import { authService, type SignUpParams, type SignInParams } from '../services/authService';
import { patientService } from '../services/patientService';
import { isSupabaseConfigured } from '../lib/supabase';

interface SignUpResponse {
  error: Error | null;
  patientId?: string;
  emailConfirmationRequired?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: ProfileRow | null;
  isAuthenticated: boolean;
  loading: boolean;
  isBackendConfigured: boolean;
  signIn: (params: SignInParams) => Promise<{ error: Error | null }>;
  signUp: (params: SignUpParams) => Promise<SignUpResponse>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fallback demo profile when running in local demonstration mode without Supabase credentials
const DEMO_PROFILE: ProfileRow = {
  id: 'demo-patient-001',
  auth_user_id: 'demo-auth-001',
  patient_login_id: 'PHS-100001',
  full_name: 'Demo Patient',
  email: 'demo@physiosis.local',
  phone: null,
  role: 'PATIENT',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isBackendConfigured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper to fetch/ensure profile from database
  const fetchProfile = useCallback(async (authUserId: string) => {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) return;

      const { profile: ensuredProfile } = await patientService.ensureProfile(currentUser);
      if (ensuredProfile) {
        setProfile(ensuredProfile);
      } else {
        const { profile: fetchedProfile } = await patientService.getProfile(authUserId);
        if (fetchedProfile) {
          setProfile(fetchedProfile);
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Profile fetch warning:', err);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    if (!isBackendConfigured) {
      // Local fallback for quick unconfigured demo
      setLoading(false);
      return;
    }

    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const session = await authService.getSession();
        if (session && session.user && isMounted) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('[AuthContext] Session initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: subscription } = authService.onAuthStateChange(async (_event, session: Session | null) => {
      if (!isMounted) return;
      if (session && session.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      if (subscription?.subscription) {
        subscription.subscription.unsubscribe();
      }
    };
  }, [isBackendConfigured, fetchProfile]);

  const signIn = async (params: SignInParams): Promise<{ error: Error | null }> => {
    if (!isBackendConfigured) {
      // Allow demo bypass when unconfigured
      setUser({ id: 'demo-auth-001', email: params.email } as User);
      setProfile({ ...DEMO_PROFILE, email: params.email });
      return { error: null };
    }

    setLoading(true);
    const { data, error } = await authService.signIn(params);
    setLoading(false);

    if (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }

    if (data?.user) {
      setUser(data.user);
      await fetchProfile(data.user.id);
    }

    return { error: null };
  };

  const signUp = async (params: SignUpParams): Promise<SignUpResponse> => {
    if (!isBackendConfigured) {
      const demoId = 'PHS-100001';
      setUser({ id: 'demo-auth-001', email: params.email } as User);
      setProfile({
        ...DEMO_PROFILE,
        full_name: params.fullName,
        email: params.email,
        patient_login_id: demoId,
      });
      return { error: null, patientId: demoId, emailConfirmationRequired: false };
    }

    setLoading(true);
    const { data, error } = await authService.signUp(params);
    setLoading(false);

    if (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }

    if (data?.session && data?.user) {
      setUser(data.user);
      await fetchProfile(data.user.id);
      return {
        error: null,
        patientId: profile?.patient_login_id || 'PHS-100001',
        emailConfirmationRequired: false,
      };
    }

    if (data?.user && data.emailConfirmationRequired) {
      return {
        error: null,
        emailConfirmationRequired: true,
      };
    }

    return { error: null, patientId: 'PHS-100001', emailConfirmationRequired: false };
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
    const { error } = await authService.resetPassword(email);
    return { error: error ? (error instanceof Error ? error : new Error('Failed to reset password.')) : null };
  };

  const refreshProfile = async (): Promise<void> => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAuthenticated,
        loading,
        isBackendConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
