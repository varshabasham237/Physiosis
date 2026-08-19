// Deep Forensic Audit of Supabase Auth, Profiles, and Rehab Sessions RLS
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runForensicAudit() {
  console.log('================================================================');
  console.log('     PHYSIOSIS — SUPABASE AUTH & RLS FORENSIC AUDIT             ');
  console.log('================================================================\n');

  // Test sign in or create test user
  const testEmail = `patient_audit_${Date.now()}@physiosis.local`;
  const testPassword = 'TestPassword123!';
  const testFullName = 'Forensic Test Patient';

  console.log(`[1] Attempting to signUp test user: ${testEmail}...`);
  const signUpRes = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: testFullName,
        role: 'PATIENT',
      },
    },
  });

  console.log('SignUp result:', {
    user_id: signUpRes.data?.user?.id,
    user_email: signUpRes.data?.user?.email,
    has_session: Boolean(signUpRes.data?.session),
    identities: signUpRes.data?.user?.identities?.length,
    error: signUpRes.error?.message,
  });

  let user = signUpRes.data?.user;
  let session = signUpRes.data?.session;

  if (!session) {
    console.log('\n[2] No session returned from signUp (email confirmation may be enabled or auto-sign in required). Attempting signInWithPassword...');
    const signInRes = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    console.log('SignIn result:', {
      user_id: signInRes.data?.user?.id,
      has_session: Boolean(signInRes.data?.session),
      error: signInRes.error?.message,
    });
    user = signInRes.data?.user || user;
    session = signInRes.data?.session;
  }

  if (!user || !session) {
    console.log('\n[!] Could not get active authenticated session with new user. Checking if there is an existing test patient...');
    // Try a known test user if any
    const existingSignIn = await supabase.auth.signInWithPassword({
      email: 'demo@physiosis.local',
      password: 'DemoPassword123!',
    });
    console.log('Existing demo user sign in:', {
      user_id: existingSignIn.data?.user?.id,
      has_session: Boolean(existingSignIn.data?.session),
      error: existingSignIn.error?.message,
    });
    user = existingSignIn.data?.user;
    session = existingSignIn.data?.session;
  }

  const { data: authUserData, error: authUserErr } = await supabase.auth.getUser();
  console.log('\n=== CURRENT AUTHENTICATED USER STATE ===');
  console.log('auth.uid():', authUserData?.user?.id || 'NULL');
  console.log('user.id:', authUserData?.user?.id || 'NULL');
  console.log('user.email:', authUserData?.user?.email || 'NULL');
  console.log('user.user_metadata:', authUserData?.user?.user_metadata);

  console.log('\n=== STEP 4: Querying public.profiles for auth_user_id ===');
  const { data: profileData, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserData?.user?.id)
    .single();

  console.log('Profile Query Result:', {
    found: Boolean(profileData),
    profile: profileData,
    error: profileErr ? { code: profileErr.code, message: profileErr.message, details: profileErr.details } : null,
  });

  console.log('\n=== STEP 5: Querying public.exercises ===');
  const { data: exercises, error: exErr } = await supabase.from('exercises').select('*');
  console.log('Exercises Query Result:', {
    count: exercises?.length,
    exercises: exercises,
    error: exErr?.message,
  });

  if (profileData && exercises && exercises.length > 0) {
    console.log('\n=== STEP 6: Testing rehab_sessions insert with PROFILES.ID ===');
    const testSessionPayload = {
      patient_id: profileData.id, // Using profiles.id
      exercise_id: exercises[0].id,
      mode: 'LIVE',
      started_at: new Date(Date.now() - 60000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: 60,
      total_reps: 5,
      best_rom: 165,
      average_rom: 160,
      best_quality: 95,
      average_quality: 90,
      limitations_detected: 0,
      average_deviation: 2.1,
      average_severity: 0,
      first_rep_rom: 155,
      last_rep_rom: 165,
      movement_progress: 10,
      trend: 'IMPROVING',
    };

    console.log('Payload using profiles.id:', testSessionPayload);
    const insertRes1 = await supabase.from('rehab_sessions').insert(testSessionPayload).select().single();
    console.log('Insert with profiles.id result:', {
      success: Boolean(insertRes1.data),
      session_id: insertRes1.data?.id,
      error: insertRes1.error ? { code: insertRes1.error.code, message: insertRes1.error.message } : null,
    });

    console.log('\n=== STEP 7: Testing rehab_sessions insert with AUTH_USER_ID (to reproduce mismatch) ===');
    const wrongPayload = {
      ...testSessionPayload,
      patient_id: authUserData.user.id, // Using auth.uid() instead of profiles.id
    };
    console.log('Payload using auth_user_id (wrong):', wrongPayload);
    const insertRes2 = await supabase.from('rehab_sessions').insert(wrongPayload).select().single();
    console.log('Insert with auth_user_id result:', {
      success: Boolean(insertRes2.data),
      error: insertRes2.error ? { code: insertRes2.error.code, message: insertRes2.error.message } : null,
    });

    if (insertRes1.data) {
      console.log('\n=== STEP 8: Testing session_reps & session_reports insert ===');
      const repsPayload = [{
        session_id: insertRes1.data.id,
        rep_number: 1,
        peak_angle: 165,
        target_angle: 165,
        rom_percentage: 100,
        deviation: 0,
        quality_score: 95,
        severity: 0,
        limitation_detected: false,
        status_label: 'Target achieved',
      }];
      const repRes = await supabase.from('session_reps').insert(repsPayload).select();
      console.log('Reps Insert result:', { success: Boolean(repRes.data), error: repRes.error?.message });

      const reportPayload = {
        session_id: insertRes1.data.id,
        patient_id: profileData.id,
        report_title: 'Forensic Audit Report',
        summary: 'Test summary',
        limitation_summary: null,
        advisory_guidance: 'Test guidance',
        movement_progress: 10,
        trend: 'IMPROVING',
        generated_at: new Date().toISOString(),
      };
      const repReportRes = await supabase.from('session_reports').insert(reportPayload).select().single();
      console.log('Report Insert result:', { success: Boolean(repReportRes.data), error: repReportRes.error?.message });

      // Clean up test data
      console.log('\n=== STEP 9: Cleaning up test session row ===');
      const delRes = await supabase.from('rehab_sessions').delete().eq('id', insertRes1.data.id);
      console.log('Cleanup result:', { error: delRes.error?.message });
    }
  } else if (!profileData) {
    console.log('\n[!] CRITICAL: No profile row was found for auth_user_id:', authUserData?.user?.id);
  }
}

runForensicAudit();
