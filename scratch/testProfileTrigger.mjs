// Forensic test: Check profiles table RLS and trigger behavior
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

async function testProfileInsert() {
  console.log('=== Testing with authenticated user ===');
  const testEmail = `patient_audit_${Date.now()}@physiosis.local`;
  const testPassword = 'TestPassword123!';

  const signUpRes = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: 'Audit Patient',
        role: 'PATIENT',
      },
    },
  });

  console.log('User signed up. auth.uid():', signUpRes.data?.user?.id);

  // 1. Check if profile exists
  const { data: p1, error: p1Err } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', signUpRes.data?.user?.id);

  console.log('Checking profile after signup:', { count: p1?.length, profile: p1, error: p1Err?.message });

  // 2. Try inserting a profile directly from authenticated client
  console.log('\nAttempting direct client insert into public.profiles:');
  const insertProfRes = await supabase.from('profiles').insert({
    auth_user_id: signUpRes.data?.user?.id,
    patient_login_id: `PHS-${Math.floor(100000 + Math.random() * 900000)}`,
    full_name: 'Audit Patient',
    email: testEmail,
    role: 'PATIENT',
  }).select().single();

  console.log('Direct profile insert result:', {
    success: Boolean(insertProfRes.data),
    profile: insertProfRes.data,
    error: insertProfRes.error ? { code: insertProfRes.error.code, message: insertProfRes.error.message, details: insertProfRes.error.details } : null,
  });

  // 3. If direct profile insert succeeded or failed, test rehab_sessions insert
  if (insertProfRes.data) {
    const { data: exercises } = await supabase.from('exercises').select('id').limit(1).single();
    console.log('\nAttempting session insert with genuine profile.id:', insertProfRes.data.id);
    const sessionRes = await supabase.from('rehab_sessions').insert({
      patient_id: insertProfRes.data.id,
      exercise_id: exercises.id,
      mode: 'LIVE',
      started_at: new Date(Date.now() - 60000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: 60,
      total_reps: 5,
      best_rom: 165,
      average_rom: 160,
      best_quality: 90,
      average_quality: 85,
      limitations_detected: 0,
      average_deviation: 2,
      average_severity: 0,
      first_rep_rom: 155,
      last_rep_rom: 165,
      movement_progress: 10,
      trend: 'IMPROVING',
    }).select().single();

    console.log('Session insert result with genuine profile.id:', {
      success: Boolean(sessionRes.data),
      error: sessionRes.error ? { code: sessionRes.error.code, message: sessionRes.error.message } : null,
    });

    // Cleanup
    if (sessionRes.data) {
      await supabase.from('rehab_sessions').delete().eq('id', sessionRes.data.id);
    }
    await supabase.from('profiles').delete().eq('id', insertProfRes.data.id);
  }
}

testProfileInsert();
