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

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', Boolean(supabaseKey));

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('=== STEP 1: Checking exercises in DB ===');
  const { data: exercises, error: exErr } = await supabase.from('exercises').select('*');
  console.log('Exercises query:', { count: exercises?.length, error: exErr?.message });
  if (exercises) {
    console.log('Available exercises:', exercises.map(e => ({ id: e.id, code: e.exercise_code, name: e.name })));
  }

  console.log('\n=== STEP 2: Checking profiles in DB (anon query) ===');
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  console.log('Profiles query as anon/unauthenticated:', { count: profiles?.length, error: profErr?.message });

  console.log('\n=== STEP 3: Checking rehab_sessions in DB (anon query) ===');
  const { data: sessions, error: sessErr } = await supabase.from('rehab_sessions').select('*');
  console.log('Sessions query as anon/unauthenticated:', { count: sessions?.length, error: sessErr?.message });
}

diagnose();
