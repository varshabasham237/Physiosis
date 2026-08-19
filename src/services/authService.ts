/**
 * authService.ts
 * Supabase Authentication service layer for patient authentication,
 * registration, password resets, and session management.
 *
 * Security:
 *   - No passwords stored in custom tables
 *   - All credentials managed by Supabase Auth (bcrypt/argon2)
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: 'PATIENT' | 'THERAPIST' | 'ADMIN';
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface SignUpResult {
  user: User | null;
  session: Session | null;
  emailConfirmationRequired: boolean;
}

export interface AuthResponse<T = unknown> {
  data: T | null;
  error: AuthError | Error | null;
}

export const authService = {
  /**
   * Register a new patient account with Supabase Auth.
   * Attaches fullName and role to raw_user_meta_data so the database trigger
   * automatically creates the public.profiles record with a unique patient_login_id.
   */
  async signUp({
    email,
    password,
    fullName,
    phone,
    role = 'PATIENT',
  }: SignUpParams): Promise<AuthResponse<SignUpResult>> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'),
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone?.trim() || null,
            role,
          },
        },
      });

      if (error) {
        return { data: null, error };
      }

      // Check if user already exists (Supabase returns empty identities array for existing users when email confirmation is on)
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        return {
          data: null,
          error: new Error('An account with this email address already exists. Please sign in.'),
        };
      }

      const emailConfirmationRequired = !data.session;

      return {
        data: {
          user: data.user,
          session: data.session,
          emailConfirmationRequired,
        },
        error: null,
      };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('An unexpected error occurred during registration.'),
      };
    }
  },

  /**
   * Sign in an existing patient using email and password.
   */
  async signIn({ email, password }: SignInParams): Promise<AuthResponse<{ user: User | null; session: Session | null }>> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'),
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) return { data: null, error };
      return { data, error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('An unexpected error occurred during sign in.'),
      };
    }
  },

  /**
   * Sign out the active patient and clear authentication tokens.
   */
  async signOut(): Promise<AuthResponse<void>> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: null };
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { data: null, error };
      return { data: undefined, error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Failed to sign out.'),
      };
    }
  },

  /**
   * Send a password reset email to the patient.
   */
  async resetPassword(email: string): Promise<AuthResponse<void>> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured.'),
      };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) return { data: null, error };
      return { data: undefined, error: null };
    } catch (err: unknown) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Failed to send password reset email.'),
      };
    }
  },

  /**
   * Get the active session if present.
   */
  async getSession(): Promise<Session | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data } = await supabase.auth.getSession();
      return data.session;
    } catch {
      return null;
    }
  },

  /**
   * Get the current authenticated user.
   */
  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data } = await supabase.auth.getUser();
      return data.user;
    } catch {
      return null;
    }
  },

  /**
   * Listen to authentication state changes.
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (!isSupabaseConfigured()) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
  },
};
