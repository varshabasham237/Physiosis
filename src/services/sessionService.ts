/**
 * sessionService.ts
 * Database service for saving and retrieving patient rehabilitation sessions,
 * repetition records, and generated reports from Supabase PostgreSQL.
 *
 * Rules:
 *   - Only LIVE sessions are stored in patient history (DEMO mode is excluded)
 *   - Uses Row Level Security so patients only access their own records
 *   - Maps database rows back to clean PhysiosisSession objects
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { PhysiosisSession, RepResult } from '../engine/session/SessionTypes';
import type {
  RehabSessionInsert,
  SessionRepInsert,
  SessionReportInsert,
  RehabSessionRow,
  SessionRepRow,
  SessionReportRow,
} from '../types/database';
import { generateAdvisoryGuidance } from '../engine/session/SessionAnalytics';
import { calculateSessionProgress, generateSessionOverviewText } from '../engine/session/SessionProgress';
import { patientService } from './patientService';

export const sessionService = {
  /**
   * Look up exercise UUID by name or code.
   */
  async getExerciseId(exerciseName: string): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      const code = exerciseName.toUpperCase().replace(/[\s-]+/g, '_');
      const cleanName = exerciseName.replace(/-/g, ' ');
      const { data, error } = await supabase
        .from('exercises')
        .select('id')
        .or(`exercise_code.eq.${code},name.ilike.%${cleanName}%`)
        .limit(1)
        .single();

      if (error || !data) return null;
      return (data as { id: string }).id;
    } catch {
      return null;
    }
  },

  /**
   * Save a completed LIVE session along with all repetition rows and generated report.
   * Authoritatively determines the patient profile from the authenticated Supabase user.
   */
  async saveRehabSessionWithRepsAndReport(
    session: PhysiosisSession,
    _optionalPatientProfileId?: string
  ): Promise<{
    sessionRow: RehabSessionRow | null;
    reportRow: SessionReportRow | null;
    error: Error | null;
  }> {
    if (!isSupabaseConfigured()) {
      return {
        sessionRow: null,
        reportRow: null,
        error: new Error('Supabase is not configured. Set environment variables to enable database saving.'),
      };
    }

    if (!session || session.totalReps <= 0 || session.durationSeconds <= 0) {
      return {
        sessionRow: null,
        reportRow: null,
        error: new Error('Invalid session: must have at least 1 completed repetition.'),
      };
    }

    try {
      // 1. Authoritative Auth Check: retrieve authenticated user from Supabase session
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        return {
          sessionRow: null,
          reportRow: null,
          error: new Error('Your patient session has expired. Please sign in again.'),
        };
      }

      // 2. Authoritative Profile Resolution: retrieve/ensure profile by auth_user_id
      const { profile, error: profileErr } = await patientService.ensureProfile(authData.user);
      if (profileErr || !profile || !profile.id) {
        return {
          sessionRow: null,
          reportRow: null,
          error: new Error('Patient profile could not be verified. Please sign in again.'),
        };
      }

      const authoritativePatientId = profile.id;

      // 3. Resolve and verify exercise UUID exists in database
      let exerciseId = await this.getExerciseId(session.exercise);
      if (!exerciseId) {
        const { data: firstEx } = await supabase.from('exercises').select('id').limit(1).single();
        if (firstEx) {
          exerciseId = (firstEx as { id: string }).id;
        } else {
          return {
            sessionRow: null,
            reportRow: null,
            error: new Error(`Exercise reference '${session.exercise}' not found in database.`),
          };
        }
      }

      // Calculate progress and overview metrics
      const progressResult = calculateSessionProgress(session);
      const overviewSummary = generateSessionOverviewText(session);
      const guidance = generateAdvisoryGuidance(session);

      const repsPayload = (session.reps || []).map((r) => ({
        rep_number: r.repNumber,
        peak_angle: r.peakAngle,
        target_angle: r.targetAngle,
        rom_percentage: r.romPercentage,
        deviation: r.deviation,
        quality_score: r.qualityScore,
        severity: r.severity || 0,
        limitation_detected: Boolean(r.limitationDetected),
        status_label: r.statusLabel || 'Below reference',
      }));

      const reportPayload = {
        report_title: `${session.exercise} Movement Report`,
        summary: overviewSummary,
        limitation_summary:
          session.limitationsDetected > 0
            ? `Observed peak: ${session.bestROM}° vs reference ${session.reps[0]?.targetAngle ?? 165}°. Limitation detected in ${session.limitationsDetected} repetitions.`
            : null,
        advisory_guidance: guidance,
        movement_progress: progressResult.progressPercentage,
        trend: progressResult.trend,
        generated_at: new Date().toISOString(),
      };

      const isClientUUID =
        typeof session.id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.id);

      const rpcParams = {
        p_exercise_id: exerciseId,
        p_mode: 'LIVE',
        p_started_at: new Date(session.startedAt).toISOString(),
        p_ended_at: new Date(session.endedAt).toISOString(),
        p_duration_seconds: session.durationSeconds,
        p_total_reps: session.totalReps,
        p_best_rom: session.bestROM,
        p_average_rom: session.averageROM,
        p_best_quality: session.bestScore,
        p_average_quality: session.averageScore,
        p_limitations_detected: session.limitationsDetected,
        p_average_deviation: session.averageDeviation,
        p_average_severity: session.averageSeverity,
        p_first_rep_rom: session.firstRepROM,
        p_last_rep_rom: session.lastRepROM,
        p_movement_progress: progressResult.progressPercentage,
        p_trend: progressResult.trend,
        p_reps: repsPayload,
        p_report: reportPayload,
        p_client_session_id: isClientUUID ? session.id : null,
      };

      // 4. Primary Transactional Path: Call PostgreSQL RPC 'save_physiosis_session'
      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)(
        'save_physiosis_session',
        rpcParams
      );

      if (!rpcErr && rpcData?.success) {
        const createdSessionRow: RehabSessionRow = {
          id: rpcData.session_id,
          patient_id: rpcData.patient_id,
          exercise_id: exerciseId,
          mode: 'LIVE',
          started_at: rpcParams.p_started_at,
          ended_at: rpcParams.p_ended_at,
          duration_seconds: rpcParams.p_duration_seconds,
          total_reps: rpcParams.p_total_reps,
          best_rom: rpcParams.p_best_rom,
          average_rom: rpcParams.p_average_rom,
          best_quality: rpcParams.p_best_quality,
          average_quality: rpcParams.p_average_quality,
          limitations_detected: rpcParams.p_limitations_detected,
          average_deviation: rpcParams.p_average_deviation,
          average_severity: rpcParams.p_average_severity,
          first_rep_rom: rpcParams.p_first_rep_rom,
          last_rep_rom: rpcParams.p_last_rep_rom,
          movement_progress: rpcParams.p_movement_progress,
          trend: rpcParams.p_trend as any,
          created_at: new Date().toISOString(),
        };

        const createdReportRow: SessionReportRow = {
          id: rpcData.report_id,
          session_id: rpcData.session_id,
          patient_id: rpcData.patient_id,
          report_title: reportPayload.report_title,
          summary: reportPayload.summary,
          limitation_summary: reportPayload.limitation_summary,
          advisory_guidance: reportPayload.advisory_guidance,
          movement_progress: reportPayload.movement_progress,
          trend: reportPayload.trend as any,
          generated_at: reportPayload.generated_at,
          created_at: new Date().toISOString(),
        };

        return {
          sessionRow: createdSessionRow,
          reportRow: createdReportRow,
          error: null,
        };
      }

      // Map specific PostgreSQL validation exceptions
      if (rpcErr) {
        const msg = rpcErr.message || '';
        if (msg.includes('AUTH_REQUIRED')) {
          return {
            sessionRow: null,
            reportRow: null,
            error: new Error('Your patient session has expired. Please sign in again.'),
          };
        }
        if (msg.includes('PROFILE_NOT_FOUND')) {
          return {
            sessionRow: null,
            reportRow: null,
            error: new Error('Patient profile could not be verified. Please sign in again.'),
          };
        }
        if (msg.includes('EXERCISE_NOT_FOUND')) {
          return {
            sessionRow: null,
            reportRow: null,
            error: new Error('Selected exercise was not found in database.'),
          };
        }
        if (msg.includes('INVALID_SESSION')) {
          return {
            sessionRow: null,
            reportRow: null,
            error: new Error('Session data is incomplete or invalid.'),
          };
        }

        // 5. Fallback Path: If RPC function is not installed on remote database, use direct insert
        const isRpcMissing =
          msg.includes('function') &&
          (msg.includes('does not exist') || msg.includes('42883') || msg.includes('PGRST202'));

        if (isRpcMissing) {
          console.info('[sessionService] RPC not found on remote database, using direct insert fallback.');
          const sessionInsert: RehabSessionInsert = {
            id: isClientUUID ? session.id : undefined,
            patient_id: authoritativePatientId,
            exercise_id: exerciseId,
            mode: 'LIVE',
            started_at: rpcParams.p_started_at,
            ended_at: rpcParams.p_ended_at,
            duration_seconds: session.durationSeconds,
            total_reps: session.totalReps,
            best_rom: session.bestROM,
            average_rom: session.averageROM,
            best_quality: session.bestScore,
            average_quality: session.averageScore,
            limitations_detected: session.limitationsDetected,
            average_deviation: session.averageDeviation,
            average_severity: session.averageSeverity,
            first_rep_rom: session.firstRepROM,
            last_rep_rom: session.lastRepROM,
            movement_progress: progressResult.progressPercentage,
            trend: progressResult.trend,
            ended_reason: session.endedReason || 'manual',
          };

          const { data: createdSession, error: sessionErr } = await (supabase
            .from('rehab_sessions') as any)
            .insert(sessionInsert)
            .select()
            .single();

          if (sessionErr || !createdSession) {
            return {
              sessionRow: null,
              reportRow: null,
              error: new Error(sessionErr?.message || 'Failed to save session.'),
            };
          }

          const sessionRow = createdSession as RehabSessionRow;

          if (session.reps && session.reps.length > 0) {
            const repsInsert: SessionRepInsert[] = session.reps.map((r) => ({
              session_id: sessionRow.id,
              rep_number: r.repNumber,
              peak_angle: r.peakAngle,
              target_angle: r.targetAngle,
              rom_percentage: r.romPercentage,
              deviation: r.deviation,
              quality_score: r.qualityScore,
              severity: r.severity,
              limitation_detected: r.limitationDetected,
              status_label: r.statusLabel,
            }));
            await (supabase.from('session_reps') as any).insert(repsInsert);
          }

          const reportInsert: SessionReportInsert = {
            session_id: sessionRow.id,
            patient_id: authoritativePatientId,
            report_title: reportPayload.report_title,
            summary: reportPayload.summary,
            limitation_summary: reportPayload.limitation_summary,
            advisory_guidance: reportPayload.advisory_guidance,
            movement_progress: reportPayload.movement_progress,
            trend: reportPayload.trend,
            generated_at: reportPayload.generated_at,
          };

          const { data: createdReport, error: reportErr } = await (supabase
            .from('session_reports') as any)
            .insert(reportInsert)
            .select()
            .single();

          return {
            sessionRow,
            reportRow: (createdReport as unknown as SessionReportRow) || null,
            error: reportErr ? new Error(reportErr.message) : null,
          };
        }

        return {
          sessionRow: null,
          reportRow: null,
          error: new Error(msg || 'Failed to save session.'),
        };
      }

      return {
        sessionRow: null,
        reportRow: null,
        error: new Error('Unexpected response while saving session.'),
      };
    } catch (err: unknown) {
      return {
        sessionRow: null,
        reportRow: null,
        error: err instanceof Error ? err : new Error('Unexpected error while saving session.'),
      };
    }
  },

  /**
   * Fetch all previous LIVE sessions for the currently authenticated patient.
   * Resolves auth.uid() -> profiles.id authoritatively and orders newest first.
   */
  async getCurrentPatientSessions(): Promise<{ sessions: PhysiosisSession[]; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { sessions: [], error: null };
    }

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        return { sessions: [], error: null };
      }

      const { profile } = await patientService.getProfile(authData.user.id);
      if (!profile || !profile.id) {
        return { sessions: [], error: null };
      }

      const { data, error } = await supabase
        .from('rehab_sessions')
        .select(`
          *,
          exercises ( id, name, exercise_code ),
          session_reps ( * )
        `)
        .eq('patient_id', profile.id)
        .eq('mode', 'LIVE')
        .order('started_at', { ascending: false });

      if (error) {
        return { sessions: [], error: new Error(error.message) };
      }

      if (!data || data.length === 0) return { sessions: [], error: null };

      // Map rows back to PhysiosisSession format
      const formattedSessions: PhysiosisSession[] = data.map((row: any) => {
        const reps: RepResult[] = (row.session_reps || [])
          .sort((a: SessionRepRow, b: SessionRepRow) => a.rep_number - b.rep_number)
          .map((r: SessionRepRow) => ({
            repNumber: r.rep_number,
            peakAngle: Number(r.peak_angle),
            targetAngle: Number(r.target_angle),
            romPercentage: Number(r.rom_percentage),
            deviation: Number(r.deviation),
            qualityScore: Number(r.quality_score),
            limitationDetected: Boolean(r.limitation_detected),
            severity: Number(r.severity || 0),
            statusLabel: (r.status_label as any) || 'Below reference',
            timestampMs: new Date(r.created_at).getTime(),
          }));

        return {
          id: row.id,
          startedAt: new Date(row.started_at).getTime(),
          endedAt: new Date(row.ended_at).getTime(),
          durationSeconds: row.duration_seconds,
          exercise: row.exercises?.name || 'Shoulder Flexion',
          exerciseId: row.exercises?.id || row.exercise_id,
          patientId: profile.patient_login_id,
          endedReason: (row.duration_seconds >= 120 ? 'automatic' : 'manual') as any,
          totalReps: row.total_reps,
          bestROM: Number(row.best_rom),
          averageROM: Number(row.average_rom),
          bestScore: Number(row.best_quality || 0),
          averageScore: Number(row.average_quality || 0),
          limitationsDetected: row.limitations_detected || 0,
          averageDeviation: Number(row.average_deviation || 0),
          averageSeverity: Number(row.average_severity || 0),
          firstRepROM: row.first_rep_rom ? Number(row.first_rep_rom) : null,
          lastRepROM: row.last_rep_rom ? Number(row.last_rep_rom) : null,
          improvementDegrees:
            row.first_rep_rom && row.last_rep_rom
              ? Number(row.last_rep_rom) - Number(row.first_rep_rom)
              : null,
          movementProgress: row.movement_progress ? Number(row.movement_progress) : null,
          trend: row.trend || null,
          reps,
        };
      });

      return { sessions: formattedSessions, error: null };
    } catch (err: unknown) {
      return {
        sessions: [],
        error: err instanceof Error ? err : new Error('Failed to retrieve patient session history.'),
      };
    }
  },

  /**
   * Fetch a specific session, reps, and report belonging strictly to the authenticated patient.
   */
  async getCurrentPatientSessionReport(sessionId: string): Promise<{
    session: PhysiosisSession | null;
    report: SessionReportRow | null;
    error: Error | null;
  }> {
    if (!isSupabaseConfigured() || !sessionId) {
      return { session: null, report: null, error: null };
    }

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        return {
          session: null,
          report: null,
          error: new Error('Your patient session has expired. Please sign in again.'),
        };
      }

      const { profile } = await patientService.getProfile(authData.user.id);
      if (!profile || !profile.id) {
        return {
          session: null,
          report: null,
          error: new Error('Patient profile could not be verified.'),
        };
      }

      // Query session strictly matching authenticated patient_id
      const { data: sessionRow, error: sessionErr } = await supabase
        .from('rehab_sessions')
        .select(`
          *,
          exercises ( id, name, exercise_code ),
          session_reps ( * )
        `)
        .eq('id', sessionId)
        .eq('patient_id', profile.id)
        .single();

      if (sessionErr || !sessionRow) {
        return {
          session: null,
          report: null,
          error: new Error(sessionErr?.message || 'Report unavailable for this session.'),
        };
      }

      // Query report strictly matching authenticated patient_id and session_id
      const { data: reportRow, error: reportErr } = await supabase
        .from('session_reports')
        .select('*')
        .eq('session_id', sessionId)
        .eq('patient_id', profile.id)
        .maybeSingle();

      const reps: RepResult[] = ((sessionRow as any).session_reps || [])
        .sort((a: SessionRepRow, b: SessionRepRow) => a.rep_number - b.rep_number)
        .map((r: SessionRepRow) => ({
          repNumber: r.rep_number,
          peakAngle: Number(r.peak_angle),
          targetAngle: Number(r.target_angle),
          romPercentage: Number(r.rom_percentage),
          deviation: Number(r.deviation),
          qualityScore: Number(r.quality_score),
          limitationDetected: Boolean(r.limitation_detected),
          severity: Number(r.severity || 0),
          statusLabel: (r.status_label as any) || 'Below reference',
          timestampMs: new Date(r.created_at).getTime(),
        }));

      const row = sessionRow as any;
      const formattedSession: PhysiosisSession = {
        id: row.id,
        startedAt: new Date(row.started_at).getTime(),
        endedAt: new Date(row.ended_at).getTime(),
        durationSeconds: row.duration_seconds,
        exercise: row.exercises?.name || 'Shoulder Flexion',
        exerciseId: row.exercises?.id || row.exercise_id,
        patientId: profile.patient_login_id,
        endedReason: (row.duration_seconds >= 120 ? 'automatic' : 'manual') as any,
        totalReps: row.total_reps,
        bestROM: Number(row.best_rom),
        averageROM: Number(row.average_rom),
        bestScore: Number(row.best_quality || 0),
        averageScore: Number(row.average_quality || 0),
        limitationsDetected: row.limitations_detected || 0,
        averageDeviation: Number(row.average_deviation || 0),
        averageSeverity: Number(row.average_severity || 0),
        firstRepROM: row.first_rep_rom ? Number(row.first_rep_rom) : null,
        lastRepROM: row.last_rep_rom ? Number(row.last_rep_rom) : null,
        improvementDegrees:
          row.first_rep_rom && row.last_rep_rom
            ? Number(row.last_rep_rom) - Number(row.first_rep_rom)
            : null,
        movementProgress: row.movement_progress ? Number(row.movement_progress) : null,
        trend: row.trend || null,
        reps,
      };

      return {
        session: formattedSession,
        report: (reportRow as unknown as SessionReportRow) || null,
        error: reportErr && reportErr.code !== 'PGRST116' ? new Error(reportErr.message) : null,
      };
    } catch (err: unknown) {
      return {
        session: null,
        report: null,
        error: err instanceof Error ? err : new Error('Failed to load session report.'),
      };
    }
  },

  /**
   * Fetch all previous LIVE sessions for the authenticated patient.
   * (Maintained for signature compatibility)
   */
  async getPatientSessions(_patientProfileId?: string): Promise<{ sessions: PhysiosisSession[]; error: Error | null }> {
    return this.getCurrentPatientSessions();
  },
};
