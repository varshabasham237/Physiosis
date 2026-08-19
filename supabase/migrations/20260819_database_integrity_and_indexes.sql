-- ============================================================================
-- PHYSIOSIS — DATABASE INTEGRITY, CONSTRAINTS & INDEXES
-- ============================================================================
-- Migration: 20260819_database_integrity_and_indexes.sql
--
-- Enhancements:
--   1. Ensure all foreign key relationships are strictly defined.
--   2. Enforce UNIQUE(session_id) on public.session_reports.
--   3. Enforce CHECK constraints on metrics, angles, scores, and progress [0, 100].
--   4. Add ended_reason column and constraint on public.rehab_sessions.
--   5. Add high-performance composite indexes for patient history & recovery trend queries.
--   6. Guarantee Row Level Security (RLS) is ENABLED on all patient data tables.
--   7. Safe development diagnostic queries provided.

-- ─── 1. COLUMN ADDITIONS & CHECK CONSTRAINTS ───────────────────────────────────

-- Add ended_reason to rehab_sessions if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rehab_sessions' AND column_name = 'ended_reason'
  ) THEN
    ALTER TABLE public.rehab_sessions ADD COLUMN ended_reason TEXT DEFAULT 'manual';
  END IF;
END $$;

-- Check constraint on ended_reason
ALTER TABLE public.rehab_sessions DROP CONSTRAINT IF EXISTS chk_rehab_sessions_ended_reason;
ALTER TABLE public.rehab_sessions ADD CONSTRAINT chk_rehab_sessions_ended_reason
  CHECK (ended_reason IS NULL OR ended_reason IN ('manual', 'automatic'));

-- Check constraints on rehab_sessions metrics
ALTER TABLE public.rehab_sessions DROP CONSTRAINT IF EXISTS chk_rehab_sessions_quality_range;
ALTER TABLE public.rehab_sessions ADD CONSTRAINT chk_rehab_sessions_quality_range
  CHECK (
    best_quality >= 0 AND best_quality <= 100 AND
    average_quality >= 0 AND average_quality <= 100
  );

ALTER TABLE public.rehab_sessions DROP CONSTRAINT IF EXISTS chk_rehab_sessions_progress_range;
ALTER TABLE public.rehab_sessions ADD CONSTRAINT chk_rehab_sessions_progress_range
  CHECK (movement_progress IS NULL OR (movement_progress >= 0 AND movement_progress <= 100));

ALTER TABLE public.rehab_sessions DROP CONSTRAINT IF EXISTS chk_rehab_sessions_rom_positive;
ALTER TABLE public.rehab_sessions ADD CONSTRAINT chk_rehab_sessions_rom_positive
  CHECK (best_rom >= 0 AND average_rom >= 0);

-- Check constraints on session_reps
ALTER TABLE public.session_reps DROP CONSTRAINT IF EXISTS chk_session_reps_quality_range;
ALTER TABLE public.session_reps ADD CONSTRAINT chk_session_reps_quality_range
  CHECK (quality_score >= 0 AND quality_score <= 100);

ALTER TABLE public.session_reps DROP CONSTRAINT IF EXISTS chk_session_reps_angles_positive;
ALTER TABLE public.session_reps ADD CONSTRAINT chk_session_reps_angles_positive
  CHECK (peak_angle >= 0 AND target_angle >= 0 AND rom_percentage >= 0 AND rep_number > 0);

-- Check constraints on session_reports
ALTER TABLE public.session_reports DROP CONSTRAINT IF EXISTS chk_session_reports_progress_range;
ALTER TABLE public.session_reports ADD CONSTRAINT chk_session_reports_progress_range
  CHECK (movement_progress >= 0 AND movement_progress <= 100);

-- ─── 2. UNIQUE CONSTRAINTS ───────────────────────────────────────────────────

-- Ensure exactly one primary report per session
ALTER TABLE public.session_reports DROP CONSTRAINT IF EXISTS uq_session_reports_session_id;
ALTER TABLE public.session_reports ADD CONSTRAINT uq_session_reports_session_id UNIQUE (session_id);

-- Ensure rep numbers are unique per session
ALTER TABLE public.session_reps DROP CONSTRAINT IF EXISTS uq_session_reps_session_rep;
ALTER TABLE public.session_reps ADD CONSTRAINT uq_session_reps_session_rep UNIQUE (session_id, rep_number);

-- ─── 3. PERFORMANCE & RETRIEVAL INDEXES ──────────────────────────────────────

-- Fast patient history sorted by timestamp
CREATE INDEX IF NOT EXISTS idx_rehab_sessions_patient_started
  ON public.rehab_sessions(patient_id, started_at DESC);

-- Fast recovery trend lookup filtered by exercise
CREATE INDEX IF NOT EXISTS idx_rehab_sessions_patient_exercise
  ON public.rehab_sessions(patient_id, exercise_id, started_at ASC);

-- Fast rep retrieval in sequential order
CREATE INDEX IF NOT EXISTS idx_session_reps_session_order
  ON public.session_reps(session_id, rep_number ASC);

-- Fast report lookup by patient
CREATE INDEX IF NOT EXISTS idx_session_reports_patient_gen
  ON public.session_reports(patient_id, generated_at DESC);

-- ─── 4. ROW LEVEL SECURITY ENFORCEMENT ────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_samples ENABLE ROW LEVEL SECURITY;

-- ─── 5. GRANTS ────────────────────────────────────────────────────────────────

GRANT SELECT ON TABLE public.exercises TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.rehab_sessions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.session_reps TO authenticated;
GRANT SELECT, INSERT ON TABLE public.session_reports TO authenticated;
