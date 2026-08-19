-- ============================================================================
-- PHYSIOSIS REHABILITATION ENGINE — SUPABASE DATABASE MIGRATION
-- ============================================================================
-- Schema: Profiles, Exercises, Rehab Sessions, Session Reps, Movement Samples, Session Reports
-- Security: Row Level Security (RLS) enabled on all tables, auth.uid() bound

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. PATIENT ID SEQUENCE ──────────────────────────────────────────────────
-- Generates human-readable patient identifiers: PHS-100001, PHS-100002, etc.
CREATE SEQUENCE IF NOT EXISTS patient_login_seq START WITH 100001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_patient_login_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PHS-' || NEXTVAL('patient_login_seq')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ─── 2. PROFILES TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_login_id TEXT UNIQUE NOT NULL DEFAULT generate_patient_login_id(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'PATIENT' CHECK (role IN ('PATIENT', 'THERAPIST', 'ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. EXERCISES TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_angle NUMERIC NOT NULL,
  category TEXT NOT NULL,
  plane TEXT NOT NULL DEFAULT 'Sagittal Plane',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. REHAB SESSIONS TABLE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rehab_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  mode TEXT NOT NULL DEFAULT 'LIVE' CHECK (mode IN ('LIVE', 'DEMO')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  total_reps INTEGER NOT NULL CHECK (total_reps > 0),
  best_rom NUMERIC NOT NULL,
  average_rom NUMERIC NOT NULL,
  best_quality NUMERIC NOT NULL DEFAULT 0,
  average_quality NUMERIC NOT NULL DEFAULT 0,
  limitations_detected INTEGER NOT NULL DEFAULT 0,
  average_deviation NUMERIC NOT NULL DEFAULT 0,
  average_severity NUMERIC NOT NULL DEFAULT 0,
  first_rep_rom NUMERIC,
  last_rep_rom NUMERIC,
  movement_progress NUMERIC DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'STABLE' CHECK (trend IN ('IMPROVING', 'STABLE', 'DECLINING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. SESSION REPETITIONS TABLE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_reps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.rehab_sessions(id) ON DELETE CASCADE,
  rep_number INTEGER NOT NULL,
  peak_angle NUMERIC NOT NULL,
  target_angle NUMERIC NOT NULL,
  rom_percentage NUMERIC NOT NULL,
  deviation NUMERIC NOT NULL,
  quality_score NUMERIC NOT NULL,
  severity NUMERIC NOT NULL DEFAULT 0,
  limitation_detected BOOLEAN NOT NULL DEFAULT FALSE,
  status_label TEXT NOT NULL DEFAULT 'Below reference',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. MOVEMENT SAMPLES TABLE (Optional sampled metrics, 2-5Hz) ─────────────
CREATE TABLE IF NOT EXISTS public.movement_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.rehab_sessions(id) ON DELETE CASCADE,
  timestamp_ms BIGINT NOT NULL,
  angle NUMERIC NOT NULL,
  rom_percentage NUMERIC NOT NULL,
  quality_score NUMERIC NOT NULL,
  severity NUMERIC NOT NULL DEFAULT 0,
  movement_state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. SESSION REPORTS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID UNIQUE NOT NULL REFERENCES public.rehab_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_title TEXT NOT NULL DEFAULT 'Session Movement Report',
  summary TEXT NOT NULL,
  limitation_summary TEXT,
  advisory_guidance TEXT NOT NULL,
  movement_progress NUMERIC NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'STABLE' CHECK (trend IN ('IMPROVING', 'STABLE', 'DECLINING')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. THERAPIST ASSIGNMENTS (Preparation for future expansion) ─────────────
CREATE TABLE IF NOT EXISTS public.therapist_patient_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(therapist_id, patient_id)
);

-- ─── 9. PERFORMANCE INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_patient_login_id ON public.profiles(patient_login_id);
CREATE INDEX IF NOT EXISTS idx_rehab_sessions_patient_id ON public.rehab_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_rehab_sessions_exercise_id ON public.rehab_sessions(exercise_id);
CREATE INDEX IF NOT EXISTS idx_rehab_sessions_created_at ON public.rehab_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_reps_session_id ON public.session_reps(session_id);
CREATE INDEX IF NOT EXISTS idx_session_reports_patient_id ON public.session_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_session_reports_session_id ON public.session_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_movement_samples_session_id ON public.movement_samples(session_id);

-- ─── 10. SEED EXERCISE METADATA ──────────────────────────────────────────────
INSERT INTO public.exercises (exercise_code, name, description, target_angle, category, plane, difficulty)
VALUES
  ('SHOULDER_FLEXION', 'Shoulder Flexion', 'Controlled elevation of the arm forward through the sagittal plane, measuring range of motion.', 165, 'Upper Body', 'Sagittal Plane', 'beginner'),
  ('KNEE_EXTENSION', 'Seated Knee Extension', 'Controlled extension of the lower leg forward while seated, assessing knee joint range of motion.', 170, 'Lower Body', 'Sagittal Plane', 'beginner'),
  ('STRAIGHT_LEG_RAISE', 'Straight-Leg Raise', 'Controlled elevation of the straight leg from a supine posture, measuring hip active range of motion.', 45, 'Lower Body', 'Sagittal Plane', 'beginner')
ON CONFLICT (exercise_code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  target_angle = EXCLUDED.target_angle,
  category = EXCLUDED.category,
  plane = EXCLUDED.plane,
  difficulty = EXCLUDED.difficulty;

-- ─── 11. AUTOMATIC PROFILE CREATION TRIGGER ───────────────────────────────────
-- Automatically inserts a public.profiles row when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_patient_id TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Patient');
  v_patient_id := generate_patient_login_id();

  INSERT INTO public.profiles (auth_user_id, patient_login_id, full_name, email, role)
  VALUES (
    NEW.id,
    v_patient_id,
    v_full_name,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'PATIENT')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fallback if duplicate login ID occurs
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 12. ROW LEVEL SECURITY (RLS) POLICIES ───────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_patient_assignments ENABLE ROW LEVEL SECURITY;

-- 12.1 Exercises: All authenticated users can read exercises
CREATE POLICY "Authenticated users can read exercises"
  ON public.exercises FOR SELECT
  TO authenticated
  USING (true);

-- 12.2 Profiles: Users can read and update their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- 12.3 Rehab Sessions: Patients can read and create their own sessions
CREATE POLICY "Patients can read own sessions"
  ON public.rehab_sessions FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can insert own sessions"
  ON public.rehab_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

-- 12.4 Session Reps: Patients can read and insert reps for their own sessions
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

-- 12.5 Movement Samples: Patients can read and insert samples for their own sessions
CREATE POLICY "Patients can read own movement samples"
  ON public.movement_samples FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT rs.id FROM public.rehab_sessions rs
      JOIN public.profiles p ON rs.patient_id = p.id
      WHERE p.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can insert own movement samples"
  ON public.movement_samples FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT rs.id FROM public.rehab_sessions rs
      JOIN public.profiles p ON rs.patient_id = p.id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- 12.6 Session Reports: Patients can read and insert their own reports
CREATE POLICY "Patients can read own session reports"
  ON public.session_reports FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can insert own session reports"
  ON public.session_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );
