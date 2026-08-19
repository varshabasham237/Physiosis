/**
 * reportService.ts
 * Service for retrieving generated session reports from Supabase.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { SessionReportRow } from '../types/database';

export const reportService = {
  /**
   * Fetch a report by its associated session UUID.
   */
  async getReportBySessionId(sessionId: string): Promise<{ report: SessionReportRow | null; error: Error | null }> {
    if (!isSupabaseConfigured() || !sessionId) {
      return { report: null, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('session_reports')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) return { report: null, error: new Error(error.message) };
      return { report: data as SessionReportRow, error: null };
    } catch (err: unknown) {
      return {
        report: null,
        error: err instanceof Error ? err : new Error('Failed to fetch session report.'),
      };
    }
  },

  /**
   * Fetch all reports for the authenticated patient.
   */
  async getPatientReports(patientProfileId?: string): Promise<{ reports: SessionReportRow[]; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { reports: [], error: null };
    }

    try {
      let resolvedProfileId = patientProfileId;
      if (!resolvedProfileId) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('auth_user_id', authData.user.id)
            .single();
          resolvedProfileId = (profile as unknown as { id: string } | null)?.id;
        }
      }

      if (!resolvedProfileId) {
        return { reports: [], error: null };
      }

      const { data, error } = await supabase
        .from('session_reports')
        .select('*')
        .eq('patient_id', resolvedProfileId)
        .order('generated_at', { ascending: false });

      if (error) return { reports: [], error: new Error(error.message) };
      return { reports: (data as SessionReportRow[]) || [], error: null };
    } catch (err: unknown) {
      return {
        reports: [],
        error: err instanceof Error ? err : new Error('Failed to fetch patient reports.'),
      };
    }
  },
};
