// Verification Script for Physiosis Assistant Patch B

async function runPatchBVerification() {
  console.log('====================================================');
  console.log('   PHYSIOSIS — PATCH B VERIFICATION TEST SUITE      ');
  console.log('====================================================\n');

  let allPassed = true;
  const mockContext = {
    exercise: 'Shoulder Flexion',
    targetROM: 165,
    currentROM: 128,
    bestROM: 135,
    averageROM: 124,
    repetitions: 4,
    movementQuality: 82,
    limitations: ['limited_rom_flexion'],
    suggestions: ['Raise your arm higher towards ceiling'],
    trend: 'improving',
  };

  // 1. Normal Physiotherapy Question
  console.log('1. Testing Normal Physiotherapy Question...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What does limited shoulder range of motion mean?' }),
    });
    const data = await res.json();
    const pass = res.status === 200 && data.success && data.reply.length > 20;
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Status: ${res.status} | Model: ${data.model}`);
    console.log(`   Reply excerpt: "${data.reply.slice(0, 90)}..."\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 2. Out-of-Domain Question: "Who won yesterday's match?"
  console.log("2. Testing Out-of-Domain Question: 'Who won yesterday\\'s match?'...");
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Who won yesterday's match?" }),
    });
    const data = await res.json();
    const expectedRefusal =
      'I can only help with physiotherapy, rehabilitation exercises, movement analysis, and Physiosis session information.';
    const pass = data.reply === expectedRefusal && data.model === 'domain-guard';
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Blocked before Ollama: ${pass} | Model: ${data.model}`);
    console.log(`   Refusal: "${data.reply}"\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 3. Session Question: "How many repetitions did I complete?"
  console.log('3. Testing Session Question: "How many repetitions did I complete?"...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'How many repetitions did I complete?',
        sessionContext: mockContext,
      }),
    });
    const data = await res.json();
    const pass = res.status === 200 && data.reply.includes('4');
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Uses Context Reps (4): ${pass} | Model: ${data.model}`);
    console.log(`   Reply: "${data.reply.slice(0, 100)}..."\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 4. Session Question: "Why was my ROM low?"
  console.log('4. Testing Session Question: "Why was my ROM low?"...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Why was my ROM low?',
        sessionContext: mockContext,
      }),
    });
    const data = await res.json();
    const pass = res.status === 200 && data.success;
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Status: ${res.status} | Model: ${data.model}`);
    console.log(`   Reply excerpt: "${data.reply.slice(0, 100)}..."\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 5. Empty Input Handling
  console.log('5. Testing Empty Input...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    });
    const data = await res.json();
    const pass = res.status === 400 && data.error === 'EMPTY_MESSAGE';
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Status: ${res.status} | Empty Handled: ${pass}\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 6. Multilingual: Hindi
  console.log('6. Testing Multilingual (Hindi): "कंधे के व्यायाम के लाभ क्या हैं?"...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'कंधे के व्यायाम के लाभ क्या हैं?',
        language: 'Hindi',
      }),
    });
    const data = await res.json();
    const pass = res.status === 200 && data.success;
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Status: ${res.status} | Model: ${data.model}`);
    console.log(`   Reply excerpt: "${data.reply.slice(0, 80)}..."\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 7. Multilingual: Telugu
  console.log('7. Testing Multilingual (Telugu): "భుజం వ్యాయామం ఎలా చేయాలి?"...');
  try {
    const res = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'భుజం వ్యాయామం ఎలా చేయాలి?',
        language: 'Telugu',
      }),
    });
    const data = await res.json();
    const pass = res.status === 200 && data.success;
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Status: ${res.status} | Model: ${data.model}`);
    console.log(`   Reply excerpt: "${data.reply.slice(0, 80)}..."\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  console.log('====================================================');
  console.log('  PATCH B COMPLETE VERIFICATION RESULT =', allPassed ? 'SUCCESS (ALL PASS)' : 'FAILED');
  console.log('====================================================');
}

runPatchBVerification();
