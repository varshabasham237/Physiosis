/**
 * patientService.ts
 * Patient profile management service.
 *
 * Enforces security:
 *   - Only queries profiles using authenticated user ID or RLS-protected queries
 *   - Fetches unique Patient Login ID (e.g. PHS-100001)
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ProfileRow, ProfileUpdate } from '../types/database';

export const patientService = {
  /**
   * Fetch the profile row associated with the authenticated user ID.
   */
  async getProfile(authUserId: string): Promise<{ profile: ProfileRow | null; error: Error | null }> {
    if (!isSupabaseConfigured() || !authUserId) {
      return { profile: null, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', authUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { profile: null, error: null };
        }
        return { profile: null, error: new Error(error.message) };
      }

      return { profile: data as unknown as ProfileRow, error: null };
    } catch (err: unknown) {
      return {
        profile: null,
        error: err instanceof Error ? err : new Error('Failed to fetch patient profile.'),
      };
    }
  },

  /**
   * Ensure a profile row exists for the authenticated user.
   * If missing, creates a default profile row securely under the user's auth_user_id.
   */
  async ensureProfile(authUser: { id: string; email?: string; user_metadata?: Record<string, any> }): Promise<{ profile: ProfileRow | null; error: Error | null }> {
    if (!isSupabaseConfigured() || !authUser?.id) {
      return { profile: null, error: null };
    }

    // 1. Check if profile already exists
    const { profile } = await this.getProfile(authUser.id);
    if (profile) {
      return { profile, error: null };
    }

    // 2. If profile is not found in database, insert one for this authenticated user
    try {
      const generatedId = 'PHS-' + Math.floor(100000 + Math.random() * 900000);
      const fullName = authUser.user_metadata?.full_name || 'Patient';
      const role = authUser.user_metadata?.role || 'PATIENT';
      const phone = authUser.user_metadata?.phone || null;

      const { data, error: insertErr } = await (supabase.from('profiles') as any)
        .insert({
          auth_user_id: authUser.id,
          patient_login_id: generatedId,
          full_name: fullName,
          email: authUser.email || '',
          phone,
          role,
        })
        .select()
        .single();

      if (insertErr) {
        // If conflict or created concurrently, retry getProfile
        const { profile: refetched } = await this.getProfile(authUser.id);
        if (refetched) return { profile: refetched, error: null };
        return { profile: null, error: new Error(insertErr.message) };
      }

      return { profile: data as unknown as ProfileRow, error: null };
    } catch (err: unknown) {
      return {
        profile: null,
        error: err instanceof Error ? err : new Error('Failed to ensure profile.'),
      };
    }
  },

  /**
   * Update profile fields (full_name, phone, etc.).
   */
  async updateProfile(authUserId: string, updates: ProfileUpdate): Promise<{ profile: ProfileRow | null; error: Error | null }> {
    if (!isSupabaseConfigured() || !authUserId) {
      return { profile: null, error: new Error('Supabase not configured.') };
    }

    try {
      const { data, error } = await (supabase
        .from('profiles') as any)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('auth_user_id', authUserId)
        .select()
        .single();

      if (error) return { profile: null, error: new Error(error.message) };
      return { profile: data as unknown as ProfileRow, error: null };
    } catch (err: unknown) {
      return {
        profile: null,
        error: err instanceof Error ? err : new Error('Failed to update profile.'),
      };
    }
  },
};
