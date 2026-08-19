// Test Local On-Device TTS Engine & Fallback Matrix

async function runLocalTTSTests() {
  console.log('====================================================');
  console.log('    TESTING LOCAL ON-DEVICE TEXT-TO-SPEECH (TTS)    ');
  console.log('====================================================\n');

  let allPassed = true;

  // 1. Health check for local TTS
  console.log('1. Checking /api/physio-tts-health...');
  try {
    const hRes = await fetch('http://localhost:3000/api/physio-tts-health');
    const hData = await hRes.json();
    const pass = hData.status === 'AVAILABLE' && hData.isLocal === true && hData.cloudDependency === false;
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Provider: ${hData.provider} | isLocal: ${hData.isLocal}`);
    console.log(`   Supported Languages: ${JSON.stringify(hData.supportedLanguages)}\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 2. English Speech Synthesis Test
  console.log('2. Testing English Synthesis: "Your shoulder range of motion was 128 degrees."...');
  try {
    const enRes = await fetch('http://localhost:3000/api/physio-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Your shoulder range of motion was 128 degrees.',
        language: 'en',
      }),
    });
    const enData = await enRes.json();
    const pass = enRes.status === 200 && enData.success === true && Boolean(enData.audioBase64);
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Status: ${enRes.status} | Audio Size: ${enData.audioBase64?.length || 0} bytes`);
    console.log(`   Spoken Text: "${enData.spokenText}"\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 3. Hindi Voice Fallback Test
  console.log('3. Testing Hindi Voice (Expected Fallback Notice)...');
  try {
    const hiRes = await fetch('http://localhost:3000/api/physio-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'कंधे का व्यायाम कैसे करें?',
        language: 'hi',
      }),
    });
    const hiData = await hiRes.json();
    const expectedMsg =
      'Voice output is unavailable for this language on this device. Text response is available.';
    const pass = hiData.success === false && hiData.message === expectedMsg;
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Fallback message matched: ${pass}`);
    console.log(`   Message: "${hiData.message}"\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 4. Telugu Voice Fallback Test
  console.log('4. Testing Telugu Voice (Expected Fallback Notice)...');
  try {
    const teRes = await fetch('http://localhost:3000/api/physio-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'భుజం వ్యాయామం ఎలా చేయాలి?',
        language: 'te',
      }),
    });
    const teData = await teRes.json();
    const expectedMsg =
      'Voice output is unavailable for this language on this device. Text response is available.';
    const pass = teData.success === false && teData.message === expectedMsg;
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Fallback message matched: ${pass}`);
    console.log(`   Message: "${teData.message}"\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 5. Security & Sanitization Test (System prompts & markdown bold formatting)
  console.log('5. Testing Sanitization: Markdown bold and degrees normalization...');
  try {
    const secRes = await fetch('http://localhost:3000/api/physio-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '**Target ROM**: 165° | **Achieved**: 128°\n• Good arm elevation',
        language: 'en',
      }),
    });
    const secData = await secRes.json();
    const pass =
      secData.success === true &&
      !secData.spokenText.includes('**') &&
      secData.spokenText.includes('165 degrees') &&
      secData.spokenText.includes('128 degrees');
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Sanitized Spoken Text: "${secData.spokenText}"\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  console.log('====================================================');
  console.log('    LOCAL TTS VERIFICATION RESULT =', allPassed ? 'SUCCESS (ALL PASS)' : 'FAILED');
  console.log('====================================================');
}

runLocalTTSTests();
