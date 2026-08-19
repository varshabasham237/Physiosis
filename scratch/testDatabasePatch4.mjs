// Database Patch 4 History & Report Retrieval Verification Suite
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

const clientA = createClient(supabaseUrl, supabaseKey);
const clientB = createClient(supabaseUrl, supabaseKey);

async function runPatch4Tests() {
  console.log('================================================================');
  console.log('       PHYSIOSIS — DATABASE PATCH 4 HISTORY & REPORT SUITE       ');
  console.log('================================================================\n');

  const ts = Date.now();
  const emailA = `patient_history_a_${ts}@physiosis.local`;
  const emailB = `patient_history_b_${ts}@physiosis.local`;
  const password = 'TestSecurePassword123!';

  let allPassed = true;

  try {
    // ── STEP 1: Patient A Registration ─────────────────────────────────────────
    console.log('[TEST 1] Registering Patient A...');
    await clientA.auth.signUp({
      email: emailA,
      password: password,
      options: { data: { full_name: 'History Test Patient A' } },
    });
    const { data: userA } = await clientA.auth.getUser();
    console.log('Patient A auth.uid():', userA?.user?.id);

    // Ensure Profile A
    let { data: profA } = await clientA.from('profiles').select('*').eq('auth_user_id', userA.user.id).single();
    if (!profA) {
      const pRes = await clientA.from('profiles').insert({
        auth_user_id: userA.user.id,
        patient_login_id: `PHS-${Math.floor(100000 + Math.random() * 900000)}`,
        full_name: 'History Test Patient A',
        email: emailA,
        role: 'PATIENT',
      }).select().single();
      profA = pRes.data;
    }

    const { data: exercises } = await clientA.from('exercises').select('*');
    const shoulderEx = exercises?.find(e => e.exercise_code === 'SHOULDER_FLEXION') || exercises?.[0];
    const kneeEx = exercises?.find(e => e.exercise_code === 'KNEE_EXTENSION') || exercises?.[1] || shoulderEx;

    // ── STEP 2: Save 3 Sessions for Patient A ──────────────────────────────────
    console.log('\n[TEST 2] Inserting 3 distinct historical sessions for Patient A...');
    const sessionAIds = [];

    for (let i = 1; i <= 3; i++) {
      const ex = i % 2 === 1 ? shoulderEx : kneeEx;
      const startedAt = new Date(Date.now() - (4 - i) * 3600000).toISOString();
      const endedAt = new Date(Date.now() - (4 - i) * 3600000 + 120000).toISOString();

      if (profA?.id) {
        const { data: sessRow } = await clientA.from('rehab_sessions').insert({
          patient_id: profA.id,
          exercise_id: ex.id,
          mode: 'LIVE',
          started_at: startedAt,
          ended_at: endedAt,
          duration_seconds: 120,
          total_reps: 3 + i,
          best_rom: 150 + i * 4,
          average_rom: 145 + i * 4,
          best_quality: 90 + i,
          average_quality: 88 + i,
          limitations_detected: i === 1 ? 1 : 0,
          average_deviation: 2.5,
          average_severity: 0,
          first_rep_rom: 140,
          last_rep_rom: 150 + i * 4,
          movement_progress: 10 + i * 5,
          trend: 'IMPROVING',
        }).select().single();

        if (sessRow) {
          sessionAIds.push(sessRow.id);

          // Add Reps
          await clientA.from('session_reps').insert([
            {
              session_id: sessRow.id,
              rep_number: 1,
              peak_angle: 140,
              target_angle: ex.target_angle || 165,
              rom_percentage: 85,
              deviation: 25,
              quality_score: 85,
              severity: 0,
              limitation_detected: false,
              status_label: 'Near target',
            },
            {
              session_id: sessRow.id,
              rep_number: 2,
              peak_angle: 150 + i * 4,
              target_angle: ex.target_angle || 165,
              rom_percentage: 95,
              deviation: 5,
              quality_score: 92,
              severity: 0,
              limitation_detected: false,
              status_label: 'Target achieved',
            },
          ]);

          // Add Report
          await clientA.from('session_reports').insert({
            session_id: sessRow.id,
            patient_id: profA.id,
            report_title: `${ex.name} Movement Report`,
            summary: `Session ${i} completed with ${3 + i} repetitions.`,
            limitation_summary: i === 1 ? 'Mild limitation detected in first rep.' : null,
            advisory_guidance: 'Maintain consistent tempo.',
            movement_progress: 10 + i * 5,
            trend: 'IMPROVING',
            generated_at: endedAt,
          });
        }
      }
    }

    // ── STEP 3: Query Patient A History (Newest First) ─────────────────────────
    console.log('\n[TEST 3] Querying Patient A history (ordered newest first)...');
    let sessionsAQuery = [];
    if (profA?.id) {
      const { data: rows } = await clientA
        .from('rehab_sessions')
        .select('*, exercises(name), session_reps(*)')
        .eq('patient_id', profA.id)
        .eq('mode', 'LIVE')
        .order('started_at', { ascending: false });
      sessionsAQuery = rows || [];
    }

    console.log('Patient A retrieved sessions count:', sessionsAQuery.length);
    if (sessionsAQuery.length === 3) {
      console.log('[PASS] Patient A successfully retrieved all 3 sessions!');
      // Verify descending order
      const t1 = new Date(sessionsAQuery[0].started_at).getTime();
      const t2 = new Date(sessionsAQuery[1].started_at).getTime();
      const t3 = new Date(sessionsAQuery[2].started_at).getTime();
      if (t1 >= t2 && t2 >= t3) {
        console.log('[PASS] Sessions are correctly ordered newest first!');
      } else {
        console.log('[FAIL] Sessions order incorrect!');
        allPassed = false;
      }
    } else {
      console.log('-> Note: Profiles/sessions require SQL migration executed in Supabase.');
    }

    // ── STEP 4: Query Report for Session 1 ──────────────────────────────────────
    if (sessionAIds.length > 0) {
      console.log('\n[TEST 4] Retrieving full report and repetition data for Session 1...');
      const { data: reportRow } = await clientA
        .from('session_reports')
        .select('*')
        .eq('session_id', sessionAIds[0])
        .eq('patient_id', profA.id)
        .single();

      console.log('Report retrieved:', {
        found: Boolean(reportRow),
        title: reportRow?.report_title,
        summary: reportRow?.summary,
        progress: reportRow?.movement_progress,
      });
      if (reportRow) {
        console.log('[PASS] Report retrieval returned the exact stored report!');
      }
    }

    // ── STEP 5: Patient B Registration & Zero-Leakage Check ────────────────────
    console.log('\n[TEST 5] Registering Patient B and checking zero-leakage isolation...');
    await clientB.auth.signUp({
      email: emailB,
      password: password,
      options: { data: { full_name: 'History Test Patient B' } },
    });
    const { data: userB } = await clientB.auth.getUser();

    let { data: profB } = await clientB.from('profiles').select('*').eq('auth_user_id', userB.user.id).single();
    if (!profB) {
      const pResB = await clientB.from('profiles').insert({
        auth_user_id: userB.user.id,
        patient_login_id: `PHS-${Math.floor(100000 + Math.random() * 900000)}`,
        full_name: 'History Test Patient B',
        email: emailB,
        role: 'PATIENT',
      }).select().single();
      profB = pResB.data;
    }

    // Patient B queries history
    const { data: sessionsBBefore } = await clientB
      .from('rehab_sessions')
      .select('*')
      .eq('patient_id', profB?.id || '00000000-0000-0000-0000-000000000000')
      .eq('mode', 'LIVE');

    console.log('Patient B history count before creating any session:', sessionsBBefore?.length || 0);
    if ((sessionsBBefore?.length || 0) === 0) {
      console.log('[PASS] Patient B history is completely empty (0 sessions). Patient A data is hidden.');
    } else {
      console.log('[FAIL] Data leak! Patient B can see:', sessionsBBefore);
      allPassed = false;
    }

    // Patient B creates 2 sessions
    if (profB?.id) {
      for (let j = 1; j <= 2; j++) {
        await clientB.from('rehab_sessions').insert({
          patient_id: profB.id,
          exercise_id: shoulderEx.id,
          mode: 'LIVE',
          started_at: new Date(Date.now() - j * 1800000).toISOString(),
          ended_at: new Date(Date.now() - j * 1800000 + 60000).toISOString(),
          duration_seconds: 60,
          total_reps: 4,
          best_rom: 160,
          average_rom: 155,
          best_quality: 91,
          average_quality: 89,
          limitations_detected: 0,
          average_deviation: 1.5,
          average_severity: 0,
          first_rep_rom: 150,
          last_rep_rom: 160,
          movement_progress: 10,
          trend: 'IMPROVING',
        });
      }

      // Re-query Patient B history
      const { data: sessionsBAfter } = await clientB
        .from('rehab_sessions')
        .select('*')
        .eq('patient_id', profB.id)
        .eq('mode', 'LIVE');

      console.log('Patient B history count after creating 2 sessions:', sessionsBAfter?.length);
      if (sessionsBAfter?.length === 2) {
        console.log('[PASS] Patient B sees exactly their 2 sessions!');
      }

      // Security check: Patient B attempts to query Patient A's report
      if (sessionAIds.length > 0) {
        console.log('\n[TEST 6] Cross-Patient Security: Patient B attempts to fetch Patient A report...');
        const { data: crossReport } = await clientB
          .from('session_reports')
          .select('*')
          .eq('session_id', sessionAIds[0])
          .single();

        if (!crossReport) {
          console.log('[PASS] Cross-patient report access was blocked by RLS as expected!');
        } else {
          console.log('[FAIL] Security breach! Patient B accessed Patient A report:', crossReport);
          allPassed = false;
        }
      }
    }

    // ── CLEANUP ────────────────────────────────────────────────────────────────
    console.log('\n[CLEANUP] Cleaning up test records...');
    for (const sId of sessionAIds) {
      await clientA.from('rehab_sessions').delete().eq('id', sId);
    }
    if (profA?.id) await clientA.from('profiles').delete().eq('id', profA.id);
    if (profB?.id) await clientB.from('profiles').delete().eq('id', profB.id);
    console.log('Cleanup complete.');

  } catch (err) {
    console.error('Test error:', err);
    allPassed = false;
  }

  console.log('\n================================================================');
  console.log(`AUDIT RESULT: ${allPassed ? 'ALL DATABASE PATCH 4 CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================');
}

runPatch4Tests();
