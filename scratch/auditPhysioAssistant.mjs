// Comprehensive Diagnostic & Audit Script for Physiosis Assistant

async function performAudit() {
  console.log('====================================================');
  console.log('     PHYSIOSIS ASSISTANT — COMPLETE AUDIT SCRIPT    ');
  console.log('====================================================\n');

  // 1. Direct Ollama Service Health Check
  console.log('--- 1. DIRECT OLLAMA DAEMON CHECK (http://localhost:11434) ---');
  let directOllamaOk = false;
  let installedModels = [];
  try {
    const vRes = await fetch('http://localhost:11434/api/version');
    const vData = await vRes.json();
    console.log('Ollama Version:', vData.version);

    const tRes = await fetch('http://localhost:11434/api/tags');
    const tData = await tRes.json();
    installedModels = (tData.models || []).map((m) => m.name);
    console.log('Installed Local Models:', installedModels.length > 0 ? installedModels : 'NONE (0 models installed)');
    directOllamaOk = true;
  } catch (err) {
    console.log('Ollama Daemon Connection Error:', err.message);
  }

  // 2. Vite Proxy Health Check (/api/physio-health)
  console.log('\n--- 2. VITE PROXY HEALTH CHECK (http://localhost:3000/api/physio-health) ---');
  let proxyHealth = null;
  try {
    const hRes = await fetch('http://localhost:3000/api/physio-health');
    proxyHealth = await hRes.json();
    console.log('Proxy Health Response:', JSON.stringify(proxyHealth, null, 2));
  } catch (err) {
    console.log('Proxy Health Error:', err.message);
  }

  // 3. Test Text Chat: Normal In-Domain Question
  console.log('\n--- 3. TEST TEXT CHAT: NORMAL IN-DOMAIN QUERY ---');
  const normalQuery = 'What does limited shoulder range of motion mean?';
  console.log('Input:', normalQuery);
  try {
    const chatRes = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: normalQuery }),
    });
    const chatData = await chatRes.json();
    console.log('HTTP Status:', chatRes.status);
    console.log('Response Body:', JSON.stringify(chatData, null, 2));
  } catch (err) {
    console.log('Text Chat Error:', err.message);
  }

  // 4. Test Out-of-Domain Query: Python Calculator
  console.log('\n--- 4. TEST OUT-OF-DOMAIN QUERY (DOMAIN GUARD) ---');
  const oodQuery = 'Write Python code for a calculator.';
  console.log('Input:', oodQuery);
  try {
    const oodRes = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: oodQuery }),
    });
    const oodData = await oodRes.json();
    console.log('HTTP Status:', oodRes.status);
    console.log('Response Body:', JSON.stringify(oodData, null, 2));
  } catch (err) {
    console.log('Domain Guard Error:', err.message);
  }

  // 5. Test Red-Flag Query
  console.log('\n--- 5. TEST RED-FLAG QUERY (SAFETY GUARD) ---');
  const redFlagQuery = 'I have sudden severe chest pain and cannot breathe.';
  console.log('Input:', redFlagQuery);
  try {
    const rfRes = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: redFlagQuery }),
    });
    const rfData = await rfRes.json();
    console.log('HTTP Status:', rfRes.status);
    console.log('Response Body:', JSON.stringify(rfData, null, 2));
  } catch (err) {
    console.log('Safety Guard Error:', err.message);
  }

  // 6. Test Session Context Grounding
  console.log('\n--- 6. TEST SESSION CONTEXT GROUNDING ---');
  const sessionQuery = 'What was my last shoulder ROM?';
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
  console.log('Input:', sessionQuery);
  console.log('Context Injected:', JSON.stringify(mockContext, null, 2));
  try {
    const scRes = await fetch('http://localhost:3000/api/physio-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: sessionQuery,
        sessionContext: mockContext,
      }),
    });
    const scData = await scRes.json();
    console.log('HTTP Status:', scRes.status);
    console.log('Response Body:', JSON.stringify(scData, null, 2));
  } catch (err) {
    console.log('Session Context Error:', err.message);
  }

  // 7. Test Multilingual Routing (English, Hindi, Telugu)
  console.log('\n--- 7. TEST MULTILINGUAL ROUTING ---');
  const languagesToTest = [
    { lang: 'English', query: 'How can I improve my movement range?' },
    { lang: 'Hindi', query: 'कंधे का व्यायाम कैसे सुधारें?' },
    { lang: 'Telugu', query: 'భుజం వ్యాయామం ఎలా చేయాలి?' },
  ];

  for (const item of languagesToTest) {
    console.log(`Testing Language: ${item.lang} | Query: "${item.query}"`);
    try {
      const langRes = await fetch('http://localhost:3000/api/physio-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: item.query,
          language: item.lang,
          sessionContext: mockContext,
        }),
      });
      const langData = await langRes.json();
      console.log(`  -> Status: ${langRes.status} | Model: ${langData.model} | isAllowed: ${!langData.isOutOfDomain}`);
      if (langData.reply) {
        console.log(`  -> Reply excerpt: ${langData.reply.slice(0, 100)}...`);
      }
    } catch (err) {
      console.log(`  -> Error: ${err.message}`);
    }
  }

  // 8. Test Suggested Prompts
  console.log('\n--- 8. TEST ALL 4 SUGGESTED PROMPTS ---');
  const suggestedPrompts = [
    'What does my ROM mean?',
    'Why was this rep limited?',
    'How can I improve my movement?',
    'What happened in my last session?',
  ];

  for (const prompt of suggestedPrompts) {
    try {
      const spRes = await fetch('http://localhost:3000/api/physio-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          sessionContext: mockContext,
        }),
      });
      const spData = await spRes.json();
      console.log(`Prompt: "${prompt}" -> Status: ${spRes.status} | Model: ${spData.model}`);
    } catch (err) {
      console.log(`Prompt: "${prompt}" -> Error: ${err.message}`);
    }
  }

  console.log('\n====================================================');
  console.log('               AUDIT SCRIPT COMPLETED               ');
  console.log('====================================================');
}

performAudit();
