-- ============================================================================
-- PHYSIOSIS — TRANSACTIONAL SESSION + REPORT SAVE RPC
-- ============================================================================
-- Migration: 20260819_transactional_session_save_rpc.sql
--
-- Security & Transaction Rules:
--   1. Operates within an ACID transaction.
--   2. Authoritatively resolves patient_id := profiles.id where profiles.auth_user_id = auth.uid().
--   3. Caller cannot specify or spoof patient_id.
--   4. Validates existence of auth.uid(), profiles record, and exercise UUID.
--   5. Atomically inserts rehab_sessions -> session_reps -> session_reports.
--   6. Provides idempotency: if p_client_session_id is supplied and already exists,
--      returns existing session/report without duplicate writes.
--   7. Any failure rolls back all three table writes.

CREATE OR REPLACE FUNCTION public.save_physiosis_session(
  p_exercise_id UUID,
  p_mode TEXT DEFAULT 'LIVE',
  p_started_at TIMESTAMPTZ DEFAULT NOW(),
  p_ended_at TIMESTAMPTZ DEFAULT NOW(),
  p_duration_seconds INTEGER DEFAULT 0,
  p_total_reps INTEGER DEFAULT 0,
  p_best_rom NUMERIC DEFAULT 0,
  p_average_rom NUMERIC DEFAULT 0,
  p_best_quality NUMERIC DEFAULT 0,
  p_average_quality NUMERIC DEFAULT 0,
  p_limitations_detected INTEGER DEFAULT 0,
  p_average_deviation NUMERIC DEFAULT 0,
  p_average_severity NUMERIC DEFAULT 0,
  p_first_rep_rom NUMERIC DEFAULT NULL,
  p_last_rep_rom NUMERIC DEFAULT NULL,
  p_movement_progress NUMERIC DEFAULT 0,
  p_trend TEXT DEFAULT 'STABLE',
  p_reps JSONB DEFAULT '[]'::JSONB,
  p_report JSONB DEFAULT '{}'::JSONB,
  p_client_session_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_uid UUID;
  v_patient_id UUID;
  v_session_id UUID;
  v_report_id UUID;
  v_rep RECORD;
  v_existing_session RECORD;
  v_exercise_exists BOOLEAN;
  v_reps_count INTEGER := 0;
BEGIN
  -- 1. Verify Authenticated Supabase User
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Patient session not authenticated.';
  END IF;

  -- 2. Validate Session Metrics
  IF p_duration_seconds <= 0 OR p_total_reps <= 0 THEN
    RAISE EXCEPTION 'INVALID_SESSION: Session must have duration_seconds > 0 and total_reps > 0.';
  END IF;

  IF p_mode NOT IN ('LIVE', 'DEMO') THEN
    RAISE EXCEPTION 'INVALID_SESSION: Mode must be LIVE or DEMO.';
  END IF;

  -- 3. Verify Exercise Exists
  SELECT EXISTS(SELECT 1 FROM public.exercises WHERE id = p_exercise_id) INTO v_exercise_exists;
  IF NOT v_exercise_exists THEN
    RAISE EXCEPTION 'EXERCISE_NOT_FOUND: Exercise reference not found in database.';
  END IF;

  -- 4. Authoritative Patient Profile Resolution
  SELECT id INTO v_patient_id
  FROM public.profiles
  WHERE auth_user_id = v_auth_uid
  LIMIT 1;

  -- If profile is missing, automatically ensure/create it for the authenticated user
  IF v_patient_id IS NULL THEN
    INSERT INTO public.profiles (
      auth_user_id,
      patient_login_id,
      full_name,
      email,
      role
    )
    VALUES (
      v_auth_uid,
      'PHS-' || NEXTVAL('public.patient_login_seq')::TEXT,
      'Patient',
      COALESCE((SELECT email FROM auth.users WHERE id = v_auth_uid), ''),
      'PATIENT'
    )
    RETURNING id INTO v_patient_id;
  END IF;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: Patient profile could not be resolved.';
  END IF;

  -- 5. Idempotency Check: if client session ID was provided and already exists, return existing
  IF p_client_session_id IS NOT NULL THEN
    SELECT id INTO v_existing_session
    FROM public.rehab_sessions
    WHERE id = p_client_session_id AND patient_id = v_patient_id;

    IF v_existing_session IS NOT NULL THEN
      SELECT id INTO v_report_id
      FROM public.session_reports
      WHERE session_id = p_client_session_id;

      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'session_id', p_client_session_id,
        'report_id', v_report_id,
        'patient_id', v_patient_id,
        'reps_count', p_total_reps
      );
    END IF;
  END IF;

  -- 6. STEP 1 OF TRANSACTION: Insert into rehab_sessions
  INSERT INTO public.rehab_sessions (
    id,
    patient_id,
    exercise_id,
    mode,
    started_at,
    ended_at,
    duration_seconds,
    total_reps,
    best_rom,
    average_rom,
    best_quality,
    average_quality,
    limitations_detected,
    average_deviation,
    average_severity,
    first_rep_rom,
    last_rep_rom,
    movement_progress,
    trend
  )
  VALUES (
    COALESCE(p_client_session_id, uuid_generate_v4()),
    v_patient_id,
    p_exercise_id,
    p_mode,
    p_started_at,
    p_ended_at,
    p_duration_seconds,
    p_total_reps,
    p_best_rom,
    p_average_rom,
    p_best_quality,
    p_average_quality,
    p_limitations_detected,
    p_average_deviation,
    p_average_severity,
    p_first_rep_rom,
    p_last_rep_rom,
    p_movement_progress,
    COALESCE(p_trend, 'STABLE')
  )
  RETURNING id INTO v_session_id;

  -- 7. STEP 2 OF TRANSACTION: Insert all session_reps
  IF p_reps IS NOT NULL AND jsonb_array_length(p_reps) > 0 THEN
    FOR v_rep IN SELECT * FROM jsonb_to_recordset(p_reps) AS x(
      rep_number INTEGER,
      peak_angle NUMERIC,
      target_angle NUMERIC,
      rom_percentage NUMERIC,
      deviation NUMERIC,
      quality_score NUMERIC,
      severity NUMERIC,
      limitation_detected BOOLEAN,
      status_label TEXT
    )
    LOOP
      INSERT INTO public.session_reps (
        session_id,
        rep_number,
        peak_angle,
        target_angle,
        rom_percentage,
        deviation,
        quality_score,
        severity,
        limitation_detected,
        status_label
      )
      VALUES (
        v_session_id,
        v_rep.rep_number,
        v_rep.peak_angle,
        v_rep.target_angle,
        v_rep.rom_percentage,
        v_rep.deviation,
        v_rep.quality_score,
        COALESCE(v_rep.severity, 0),
        COALESCE(v_rep.limitation_detected, FALSE),
        COALESCE(v_rep.status_label, 'Below reference')
      );
      v_reps_count := v_reps_count + 1;
    END LOOP;
  END IF;

  -- 8. STEP 3 OF TRANSACTION: Insert session_reports
  IF p_report IS NOT NULL AND p_report != '{}'::JSONB THEN
    INSERT INTO public.session_reports (
      session_id,
      patient_id,
      report_title,
      summary,
      limitation_summary,
      advisory_guidance,
      movement_progress,
      trend,
      generated_at
    )
    VALUES (
      v_session_id,
      v_patient_id,
      COALESCE(p_report->>'report_title', 'Session Movement Report'),
      COALESCE(p_report->>'summary', 'Session completed.'),
      p_report->>'limitation_summary',
      COALESCE(p_report->>'advisory_guidance', 'Continue regular rehabilitation exercises.'),
      COALESCE((p_report->>'movement_progress')::NUMERIC, p_movement_progress),
      COALESCE(p_report->>'trend', p_trend, 'STABLE'),
      COALESCE((p_report->>'generated_at')::TIMESTAMPTZ, NOW())
    )
    RETURNING id INTO v_report_id;
  END IF;

  -- 9. Return structured success payload
  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'report_id', v_report_id,
    'patient_id', v_patient_id,
    'reps_count', v_reps_count
  );
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.save_physiosis_session TO authenticated;
