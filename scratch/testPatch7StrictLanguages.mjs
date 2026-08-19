// Patch 7 Strict Multilingual Language Test Suite

async function runPatch7Tests() {
  console.log('================================================================');
  console.log('      PHYSIOSIS — PATCH 7 STRICT MULTILINGUAL TEST SUITE        ');
  console.log('================================================================\n');

  const teluguLang = { code: 'te', locale: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' };
  const hindiLang = { code: 'hi', locale: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' };
  const englishLang = { code: 'en', locale: 'en-IN', name: 'English', nativeName: 'English' };

  const testResults = [];

  // Helper to check Telugu Unicode characters
  const hasTeluguChars = (text) => /[\u0C00-\u0C7F]/.test(text);
  // Helper to check Hindi/Devanagari Unicode characters
  const hasHindiChars = (text) => /[\u0900-\u097F]/.test(text);

  // ── TEST A: Telugu with transliterated pain statement ──────────────────────
  console.log('1. TEST A — Telugu ("naaku cheyi pain undhi")...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'naaku cheyi pain undhi',
        language: teluguLang,
      }),
    });
    const data = await res.json();
    const isTelugu = hasTeluguChars(data.reply);
    const passed = res.status === 200 && isTelugu;
    testResults.push({ name: 'TEST A (Telugu: naaku cheyi pain undhi)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Telugu script detected: ${isTelugu}`);
    console.log(`   Reply: "${data.reply?.slice(0, 90)}..."\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST A', passed: false, error: err.message });
  }

  // ── TEST B: Telugu Transliteration movement question ──────────────────────
  console.log('2. TEST B — Telugu Transliteration ("shoulder ni ela move cheyali")...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'shoulder ni ela move cheyali',
        language: teluguLang,
      }),
    });
    const data = await res.json();
    const isTelugu = hasTeluguChars(data.reply);
    const passed = res.status === 200 && isTelugu;
    testResults.push({ name: 'TEST B (Telugu Transliteration: shoulder ni ela move cheyali)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Telugu script detected: ${isTelugu}`);
    console.log(`   Reply: "${data.reply?.slice(0, 90)}..."\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST B', passed: false, error: err.message });
  }

  // ── TEST C: Hindi query ───────────────────────────────────────────────────
  console.log('3. TEST C — Hindi ("मेरे कंधे की गति कम है, इसका क्या मतलब है?")...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'मेरे कंधे की गति कम है, इसका क्या मतलब है?',
        language: hindiLang,
      }),
    });
    const data = await res.json();
    const isHindi = hasHindiChars(data.reply);
    const passed = res.status === 200 && isHindi;
    testResults.push({ name: 'TEST C (Hindi: गति कम)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Hindi Devanagari script detected: ${isHindi}`);
    console.log(`   Reply: "${data.reply?.slice(0, 90)}..."\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST C', passed: false, error: err.message });
  }

  // ── TEST D: English query ─────────────────────────────────────────────────
  console.log('4. TEST D — English ("What does limited shoulder ROM mean?")...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What does limited shoulder ROM mean?',
        language: englishLang,
      }),
    });
    const data = await res.json();
    const passed = res.status === 200 && data.success && data.reply?.length > 20;
    testResults.push({ name: 'TEST D (English: limited shoulder ROM)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] English reply generated`);
    console.log(`   Reply: "${data.reply?.slice(0, 90)}..."\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST D', passed: false, error: err.message });
  }

  // ── TEST E: Restricted Out-of-Domain in Telugu ────────────────────────────
  console.log('5. TEST E — Restricted Question in Telugu ("Tell me a movie joke.")...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Tell me a movie joke.',
        language: teluguLang,
      }),
    });
    const data = await res.json();
    const expectedTeluguRefusal = 'నేను ఫిజియోథెరపీ, పునరావాస వ్యాయామాలు, కదలిక విశ్లేషణ మరియు ఫిజియోసిస్ సెషన్ సమాచారంలో మాత్రమే సహాయం చేయగలను.';
    const isExactTeluguRefusal = data.reply === expectedTeluguRefusal;
    const passed = data.model === 'domain-guard' && isExactTeluguRefusal;
    testResults.push({ name: 'TEST E (Restricted Out-of-Domain Refusal in Telugu)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Telugu domain refusal matched: ${isExactTeluguRefusal}`);
    console.log(`   Refusal: "${data.reply}"\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST E', passed: false, error: err.message });
  }

  // ── TEST F: Session-Aware in Telugu ───────────────────────────────────────
  console.log('6. TEST F — Session-Aware Question in Telugu ("na session ela undi?")...');
  try {
    const mockContext = {
      exercise: 'Shoulder Flexion',
      targetROM: 165,
      currentROM: 128,
      bestROM: 135,
      repetitions: 4,
      movementQuality: 82,
    };
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'na session ela undi?',
        language: teluguLang,
        sessionContext: mockContext,
      }),
    });
    const data = await res.json();
    const isTelugu = hasTeluguChars(data.reply);
    const passed = res.status === 200 && isTelugu;
    testResults.push({ name: 'TEST F (Session-Aware in Telugu)', passed, reply: data.reply });
    console.log(`   [${passed ? 'PASS' : 'FAIL'}] Telugu script detected: ${isTelugu}`);
    console.log(`   Reply: "${data.reply?.slice(0, 90)}..."\n`);
  } catch (err) {
    console.log(`   [FAIL] Error: ${err.message}\n`);
    testResults.push({ name: 'TEST F', passed: false, error: err.message });
  }

  console.log('================================================================');
  const allPassed = testResults.every((t) => t.passed);
  console.log(`SUMMARY: ${allPassed ? 'ALL TESTS PASSED (100% SUCCESS)' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');
}

runPatch7Tests();
