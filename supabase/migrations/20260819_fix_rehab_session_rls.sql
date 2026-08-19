-- ============================================================================
-- PHYSIOSIS — FIX PATIENT OWNERSHIP AND RLS POLICIES SAFELY
-- ============================================================================
-- Migration: 20260819_fix_rehab_session_rls.sql
--
-- Security principles:
--   1. Preserve Row Level Security on all patient tables.
--   2. Authoritative ownership chain:
--        auth.uid() -> public.profiles.auth_user_id -> public.profiles.id -> rehab_sessions.patient_id
--   3. Authenticated patients can insert and read their own profile row.
--   4. Authenticated patients can insert and read only their own rehab_sessions, reps, and reports.
--   5. Patients cannot modify or delete historical clinical sessions.

-- 1. Ensure public.profiles has an explicit INSERT policy for authenticated users
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

-- Ensure public.profiles SELECT and UPDATE policies exist
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- 2. Rehab Sessions RLS Policies
DROP POLICY IF EXISTS "Patients can read own sessions" ON public.rehab_sessions;
CREATE POLICY "Patients can read own sessions"
  ON public.rehab_sessions FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Patients can insert own sessions" ON public.rehab_sessions;
CREATE POLICY "Patients can insert own sessions"
  ON public.rehab_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

-- 3. Session Repetitions RLS Policies
DROP POLICY IF EXISTS "Patients can read own session reps" ON public.session_reps;
CREATE POLICY "Patients can read own session reps"
  ON public.session_reps FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT rs.id FROM public.rehab_sessions rs
      JOIN public.profiles p ON rs.patient_id = p.id
      WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Patients can insert own session reps" ON public.session_reps;
CREATE POLICY "Patients can insert own session reps"
  ON public.session_reps FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT rs.id FROM public.rehab_sessions rs
      JOIN public.profiles p ON rs.patient_id = p.id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- 4. Session Reports RLS Policies
DROP POLICY IF EXISTS "Patients can read own session reports" ON public.session_reports;
CREATE POLICY "Patients can read own session reports"
  ON public.session_reports FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Patients can insert own session reports" ON public.session_reports;
CREATE POLICY "Patients can insert own session reports"
  ON public.session_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

-- 5. Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.rehab_sessions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.session_reps TO authenticated;
GRANT SELECT, INSERT ON TABLE public.session_reports TO authenticated;
GRANT SELECT ON TABLE public.exercises TO authenticated;
