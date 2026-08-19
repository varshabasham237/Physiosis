-- ============================================================================
-- PHYSIOSIS — FIX SIGNUP PROFILE TRIGGER & PATIENT ID GENERATION
-- ============================================================================
-- Migration: 20260818_fix_signup_profile_trigger.sql
-- Purpose:
--   1. Ensure patient_login_seq exists and has permissions
--   2. Explicitly set search_path = public on trigger functions
--   3. Create/update public.handle_new_user() with SECURITY DEFINER
--   4. Re-bind trigger to auth.users

-- 1. Ensure sequence exists and grant usage
CREATE SEQUENCE IF NOT EXISTS public.patient_login_seq START WITH 100001 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.patient_login_seq TO postgres, authenticated, service_role, anon;

-- 2. Robust Patient ID generator function with explicit search_path
CREATE OR REPLACE FUNCTION public.generate_patient_login_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_val BIGINT;
BEGIN
  v_next_val := NEXTVAL('public.patient_login_seq');
  RETURN 'PHS-' || v_next_val::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_patient_login_id() TO postgres, authenticated, service_role, anon;

-- 3. Automatic Profile Creation Trigger Function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_role TEXT;
  v_patient_id TEXT;
BEGIN
  -- Extract metadata provided during signUp()
  v_full_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Patient');
  v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  v_role := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''), 'PATIENT');
  
  -- Generate unique Patient Login ID
  v_patient_id := public.generate_patient_login_id();

  -- Insert profile for new auth user (avoids duplicate if already exists)
  INSERT INTO public.profiles (
    auth_user_id,
    patient_login_id,
    full_name,
    email,
    phone,
    role
  )
  VALUES (
    NEW.id,
    v_patient_id,
    v_full_name,
    COALESCE(NEW.email, ''),
    v_phone,
    v_role
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 4. Re-attach trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Grant proper permissions on public tables
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.exercises TO authenticated, anon;
