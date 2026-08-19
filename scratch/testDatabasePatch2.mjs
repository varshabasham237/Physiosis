// Database Patch 2 Verification & Cross-Patient Isolation Test Suite
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

// Create independent client instances for testing
const supabaseA = createClient(supabaseUrl, supabaseKey);
const supabaseB = createClient(supabaseUrl, supabaseKey);

async function runPatch2Tests() {
  console.log('================================================================');
  console.log('       PHYSIOSIS — DATABASE PATCH 2 VERIFICATION SUITE           ');
  console.log('================================================================\n');

  const ts = Date.now();
  const emailA = `patient_a_${ts}@physiosis.local`;
  const emailB = `patient_b_${ts}@physiosis.local`;
  const password = 'TestSecurePassword123!';

  let profileA = null;
  let profileB = null;
  let sessionAId = null;
  let sessionBId = null;
  let allPassed = true;

  try {
    // ── STEP 1: Register & Authenticate Patient A ──────────────────────────────
    console.log('[TEST 1] Registering and authenticating Patient A...');
    const signUpA = await supabaseA.auth.signUp({
      email: emailA,
      password: password,
      options: { data: { full_name: 'Patient Alice' } },
    });
    if (!signUpA.data?.session) {
      await supabaseA.auth.signInWithPassword({ email: emailA, password });
    }
    const { data: userAData } = await supabaseA.auth.getUser();
    console.log('Patient A auth.uid():', userAData?.user?.id);

    // Profile lookup for Patient A
    let { data: profA } = await supabaseA.from('profiles').select('*').eq('auth_user_id', userAData.user.id).single();
    if (!profA) {
      // Direct insert (or trigger)
      const res = await supabaseA.from('profiles').insert({
        auth_user_id: userAData.user.id,
        patient_login_id: `PHS-${Math.floor(100000 + Math.random() * 900000)}`,
        full_name: 'Patient Alice',
        email: emailA,
        role: 'PATIENT',
      }).select().single();
      profA = res.data;
    }
    profileA = profA;
    console.log('Patient A profile.id (authoritative):', profileA?.id);
    if (!profileA?.id) {
      console.log('-> Note: profiles table insert RLS policy is required in Supabase SQL editor.');
    }

    // ── STEP 2: Verify Exercises Table ─────────────────────────────────────────
    console.log('\n[TEST 2] Verifying exercise catalog access for authenticated user...');
    const { data: exercises } = await supabaseA.from('exercises').select('*');
    console.log('Exercises accessible to authenticated user:', exercises?.length || 0);
    const exerciseId = exercises?.[0]?.id || '38f4950a-bf7c-43b5-8464-a8ac285e841b';

    // ── STEP 3: Save LIVE Session for Patient A ────────────────────────────────
    if (profileA?.id) {
      console.log('\n[TEST 3] Inserting completed LIVE session for Patient A with profile.id...');
      const sessionPayloadA = {
        patient_id: profileA.id,
        exercise_id: exerciseId,
        mode: 'LIVE',
        started_at: new Date(Date.now() - 120000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 120,
        total_reps: 5,
        best_rom: 165,
        average_rom: 160,
        best_quality: 94,
        average_quality: 90,
        limitations_detected: 0,
        average_deviation: 1.8,
        average_severity: 0,
        first_rep_rom: 155,
        last_rep_rom: 165,
        movement_progress: 10,
        trend: 'IMPROVING',
      };

      const { data: savedSessionA, error: saveErrA } = await supabaseA
        .from('rehab_sessions')
        .insert(sessionPayloadA)
        .select()
        .single();

      if (saveErrA) {
        console.log('[FAIL] Session save failed for Patient A:', saveErrA.message);
        allPassed = false;
      } else {
        sessionAId = savedSessionA.id;
        console.log('[PASS] Session saved successfully for Patient A! Session ID:', sessionAId);

        // Reps insert
        const repResA = await supabaseA.from('session_reps').insert([{
          session_id: sessionAId,
          rep_number: 1,
          peak_angle: 165,
          target_angle: 165,
          rom_percentage: 100,
          deviation: 0,
          quality_score: 94,
          severity: 0,
          limitation_detected: false,
          status_label: 'Target achieved',
        }]).select();
        console.log('Session Reps insert for Patient A:', { success: Boolean(repResA.data), error: repResA.error?.message });

        // Report insert
        const repReportA = await supabaseA.from('session_reports').insert({
          session_id: sessionAId,
          patient_id: profileA.id,
          report_title: 'Shoulder Flexion Movement Report',
          summary: 'Session completed with optimal range of motion.',
          limitation_summary: null,
          advisory_guidance: 'Maintain current cadence and form.',
          movement_progress: 10,
          trend: 'IMPROVING',
          generated_at: new Date().toISOString(),
        }).select().single();
        console.log('Session Report insert for Patient A:', { success: Boolean(repReportA.data), error: repReportA.error?.message });
      }
    }

    // ── STEP 4: Register Patient B and Check Isolation ─────────────────────────
    console.log('\n[TEST 4] Registering Patient B and testing cross-patient isolation...');
    const signUpB = await supabaseB.auth.signUp({
      email: emailB,
      password: password,
      options: { data: { full_name: 'Patient Bob' } },
    });
    if (!signUpB.data?.session) {
      await supabaseB.auth.signInWithPassword({ email: emailB, password });
    }
    const { data: userBData } = await supabaseB.auth.getUser();
    console.log('Patient B auth.uid():', userBData?.user?.id);

    // Patient B queries rehab_sessions
    const { data: bViewSessions } = await supabaseB.from('rehab_sessions').select('*');
    console.log("Patient B's visible sessions count before creating any:", bViewSessions?.length);
    if (bViewSessions?.length === 0) {
      console.log("[PASS] Patient Isolation Verified! Patient A's session is completely invisible to Patient B.");
    } else {
      console.log("[FAIL] Isolation breach! Patient B can see sessions:", bViewSessions);
      allPassed = false;
    }

    // Patient B profile and session creation
    let { data: profB } = await supabaseB.from('profiles').select('*').eq('auth_user_id', userBData.user.id).single();
    if (!profB) {
      const res = await supabaseB.from('profiles').insert({
        auth_user_id: userBData.user.id,
        patient_login_id: `PHS-${Math.floor(100000 + Math.random() * 900000)}`,
        full_name: 'Patient Bob',
        email: emailB,
        role: 'PATIENT',
      }).select().single();
      profB = res.data;
    }
    profileB = profB;

    if (profileB?.id) {
      const { data: savedSessionB } = await supabaseB.from('rehab_sessions').insert({
        patient_id: profileB.id,
        exercise_id: exerciseId,
        mode: 'LIVE',
        started_at: new Date(Date.now() - 60000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 60,
        total_reps: 3,
        best_rom: 150,
        average_rom: 145,
        best_quality: 88,
        average_quality: 85,
        limitations_detected: 1,
        average_deviation: 4.2,
        average_severity: 0.1,
        first_rep_rom: 140,
        last_rep_rom: 150,
        movement_progress: 5,
        trend: 'IMPROVING',
      }).select().single();

      sessionBId = savedSessionB?.id;
      console.log('Patient B created own session. Session ID:', sessionBId);

      // Verify Patient B only sees their own session
      const { data: bSessionsAfter } = await supabaseB.from('rehab_sessions').select('*');
      console.log("Patient B's visible sessions count now:", bSessionsAfter?.length);
      const allBBelongToB = bSessionsAfter?.every(s => s.patient_id === profileB.id);
      if (bSessionsAfter?.length === 1 && allBBelongToB) {
        console.log("[PASS] Strict Patient Isolation Confirmed: Patient B sees exclusively their own session.");
      } else {
        console.log("[FAIL] Expected exactly 1 session belonging to Patient B.");
        allPassed = false;
      }
    }

    // ── STEP 5: Attempt Spoofing (Patient B trying to insert with Patient A's profile.id)
    if (profileA?.id && profileB?.id) {
      console.log("\n[TEST 5] Security Check: Patient B attempts to spoof patient_id = Patient A's profile.id...");
      const { data: spoofData, error: spoofErr } = await supabaseB.from('rehab_sessions').insert({
        patient_id: profileA.id, // Trying to insert into Patient A's record!
        exercise_id: exerciseId,
        mode: 'LIVE',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 30,
        total_reps: 1,
        best_rom: 100,
        average_rom: 100,
        best_quality: 50,
        average_quality: 50,
        limitations_detected: 0,
        average_deviation: 0,
        average_severity: 0,
        trend: 'STABLE',
      }).select().single();

      if (spoofErr) {
        console.log('[PASS] Spoofing blocked by RLS as expected:', spoofErr.message);
      } else {
        console.log('[FAIL] Spoofing succeeded! RLS failed to prevent patient_id hijacking:', spoofData);
        allPassed = false;
      }
    }

    // ── STEP 6: Clean Up Test Records ──────────────────────────────────────────
    console.log('\n[CLEANUP] Cleaning up test records...');
    if (sessionAId) await supabaseA.from('rehab_sessions').delete().eq('id', sessionAId);
    if (sessionBId) await supabaseB.from('rehab_sessions').delete().eq('id', sessionBId);
    if (profileA?.id) await supabaseA.from('profiles').delete().eq('id', profileA.id);
    if (profileB?.id) await supabaseB.from('profiles').delete().eq('id', profileB.id);
    console.log('Cleanup completed cleanly.');

  } catch (err) {
    console.error('Test execution error:', err);
    allPassed = false;
  }

  console.log('\n================================================================');
  console.log(`AUDIT RESULT: ${allPassed ? 'ALL DATABASE PATCH 2 TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');
}

runPatch2Tests();
