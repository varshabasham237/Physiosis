// Patch 8 Local Multilingual Speech-to-Text & Voice Pipeline Test Suite

async function runPatch8Tests() {
  console.log('================================================================');
  console.log('      PHYSIOSIS — PATCH 8 LOCAL MULTILINGUAL STT TEST SUITE     ');
  console.log('================================================================\n');

  const teluguLang = { code: 'te', locale: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' };
  const hindiLang = { code: 'hi', locale: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' };
  const englishLang = { code: 'en', locale: 'en-IN', name: 'English', nativeName: 'English' };

  const testResults = [];
  const hasTeluguChars = (text) => /[\u0C00-\u0C7F]/.test(text);
  const hasHindiChars = (text) => /[\u0900-\u097F]/.test(text);

  // ── TEST 1: Telugu Speech ("నాకు చేతిలో నొప్పి ఉంది") ────────────────────────
  console.log('1. TEST 1 — Telugu Speech ("నాకు చేతిలో నొప్పి ఉంది")...');
  try {
    const transcript = "నాకు చేతిలో నొప్పి ఉంది";
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: transcript,
        language: teluguLang,
      }),
    });
    const data = await res.json();
    const isTelugu = hasTeluguChars(data.reply);
    const passed = res.status === 200 && isTelugu;
    testResults.push({ name: 'TEST 1 (Telugu Native Speech)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Telugu script detected: ${isTelugu}`);
    console.log(`   Reply: "${data.reply?.slice(0, 90)}..."\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST 1', passed: false, error: err.message });
  }

  // ── TEST 2: Telugu Latin Speech ("naaku cheyi pain undhi") ──────────────────
  console.log('2. TEST 2 — Telugu Latin Speech ("naaku cheyi pain undhi")...');
  try {
    const transcript = "naaku cheyi pain undhi";
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: transcript,
        language: teluguLang,
      }),
    });
    const data = await res.json();
    const isTelugu = hasTeluguChars(data.reply);
    const passed = res.status === 200 && isTelugu;
    testResults.push({ name: 'TEST 2 (Telugu Latin Speech)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Telugu script detected: ${isTelugu}`);
    console.log(`   Reply: "${data.reply?.slice(0, 90)}..."\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST 2', passed: false, error: err.message });
  }

  // ── TEST 3: Hindi Speech ("मेरे कंधे की गति कम है") ──────────────────────────
  console.log('3. TEST 3 — Hindi Speech ("मेरे कंधे की गति कम है")...');
  try {
    const transcript = "मेरे कंधे की गति कम है, इसका क्या मतलब है?";
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: transcript,
        language: hindiLang,
      }),
    });
    const data = await res.json();
    const isHindi = hasHindiChars(data.reply);
    const passed = res.status === 200 && isHindi;
    testResults.push({ name: 'TEST 3 (Hindi Speech)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Hindi Devanagari script detected: ${isHindi}`);
    console.log(`   Reply: "${data.reply?.slice(0, 90)}..."\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST 3', passed: false, error: err.message });
  }

  // ── TEST 4: English Speech ("What does my shoulder ROM mean?") ─────────────
  console.log('4. TEST 4 — English Speech ("What does my shoulder ROM mean?")...');
  try {
    const transcript = "What does my shoulder ROM mean?";
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: transcript,
        language: englishLang,
      }),
    });
    const data = await res.json();
    const passed = res.status === 200 && data.success && data.reply?.length > 20;
    testResults.push({ name: 'TEST 4 (English Speech)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] English reply generated`);
    console.log(`   Reply: "${data.reply?.slice(0, 90)}..."\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST 4', passed: false, error: err.message });
  }

  // ── TEST 5: Unrelated Question in Telugu ("Tell me a movie joke.") ─────────
  console.log('5. TEST 5 — Unrelated Voice Question in Telugu ("Tell me a movie joke.")...');
  try {
    const transcript = "Tell me a movie joke.";
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: transcript,
        language: teluguLang,
      }),
    });
    const data = await res.json();
    const expectedTeluguRefusal = 'నేను ఫిజియోథెరపీ, పునరావాస వ్యాయామాలు, కదలిక విశ్లేషణ మరియు ఫిజియోసిస్ సెషన్ సమాచారంలో మాత్రమే సహాయం చేయగలను.';
    const isExactTeluguRefusal = data.reply === expectedTeluguRefusal;
    const passed = data.model === 'domain-guard' && isExactTeluguRefusal;
    testResults.push({ name: 'TEST 5 (Voice Out-of-Domain Refusal in Telugu)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Telugu domain refusal matched: ${isExactTeluguRefusal}`);
    console.log(`   Refusal: "${data.reply}"\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST 5', passed: false, error: err.message });
  }

  // ── TEST 6: Simulated Poor Audio / Empty Speech ─────────────────────────────
  console.log('6. TEST 6 — Simulated Poor Audio / Empty Speech...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-stt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: '',
        language: 'te-IN',
      }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.success === false && data.error === 'EMPTY_AUDIO';
    testResults.push({ name: 'TEST 6 (Empty/Poor Audio Handling)', passed, data });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Proper 400 error caught with EMPTY_AUDIO: ${passed}`);
    console.log(`   Message: "${data.message}"\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST 6', passed: false, error: err.message });
  }

  // ── TEST 7: STT CLI / Engine Direct Verification ───────────────────────────
  console.log('7. TEST 7 — Faster-Whisper Local CLI & Language Parameter Verification...');
  try {
    const { execSync } = await import('child_process');
    const pythonOut = execSync('python server/stt_service.py --help', { encoding: 'utf8' });
    const hasLanguageArg = pythonOut.includes('--language');
    const hasModelArg = pythonOut.includes('--model');
    const passed = hasLanguageArg && hasModelArg;
    testResults.push({ name: 'TEST 7 (Local faster-whisper CLI Verification)', passed });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Local STT CLI arguments verified (--language, --model)\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST 7', passed: false, error: err.message });
  }

  console.log('================================================================');
  const allPassed = testResults.every((t) => t.passed);
  console.log(`SUMMARY: ${allPassed ? 'ALL TESTS PASSED (100% SUCCESS)' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');
}

runPatch8Tests();
