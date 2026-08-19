// Test Local STT Backend & End-to-End Voice Pipeline

import fs from 'fs';
import path from 'path';

async function runLocalSTTTests() {
  console.log('====================================================');
  console.log('    TESTING LOCAL ON-DEVICE FASTER-WHISPER STT      ');
  console.log('====================================================\n');

  let allPassed = true;

  // 1. Health check for local STT
  console.log('1. Checking /api/physio-stt-health...');
  try {
    const hRes = await fetch('http://localhost:3000/api/physio-stt-health');
    const hData = await hRes.json();
    const pass = hData.status === 'AVAILABLE' && hData.isLocal === true && hData.cloudDependency === false;
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Provider: ${hData.provider} | isLocal: ${hData.isLocal} | Model: ${hData.model}\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 2. Synthesize audio buffer and test local STT endpoint
  console.log('2. Testing POST /api/physio-stt with audio buffer...');
  try {
    // Generate valid 16kHz 1-channel PCM WAV header + 0.5s audio data
    const sampleRate = 16000;
    const numSamples = 16000; // 1 second
    const buffer = Buffer.alloc(44 + numSamples * 2);
    
    // RIFF chunk
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);
    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // audioFormat (1 for PCM)
    buffer.writeUInt16LE(1, 22); // numChannels (1)
    buffer.writeUInt32LE(sampleRate, 24); // sampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28); // byteRate
    buffer.writeUInt16LE(2, 32); // blockAlign
    buffer.writeUInt16LE(16, 34); // bitsPerSample
    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);

    const base64Audio = buffer.toString('base64');

    const sttRes = await fetch('http://localhost:3000/api/physio-stt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: base64Audio,
        language: 'en',
        modelSize: 'tiny',
      }),
    });

    const sttData = await sttRes.json();
    const pass = sttRes.status === 200 && sttData.success === true;
    if (!pass) allPassed = false;
    console.log(`   [${pass ? 'PASS' : 'FAIL'}] Status: ${sttRes.status} | Success: ${sttData.success} | Duration: ${sttData.duration}s\n`);
  } catch (err) {
    allPassed = false;
    console.log(`   [ERROR] ${err.message}\n`);
  }

  // 3. End-to-End Voice Flow: Spoken transcript through Domain Guard & Ollama
  console.log('3. Testing E2E Pipeline: Local Transcript -> Domain Guard -> Ollama...');
  const voiceTestCases = [
    {
      name: 'English Spoken Question',
      transcript: 'What does my shoulder ROM mean?',
      language: 'English',
      expectedAction: 'FORWARD_TO_OLLAMA',
    },
    {
      name: 'Hindi Spoken Question',
      transcript: 'कंधे के व्यायाम में दर्द क्यों हो रहा है?',
      language: 'Hindi',
      expectedAction: 'FORWARD_TO_OLLAMA',
    },
    {
      name: 'Telugu Spoken Question',
      transcript: 'భుజం వ్యాయామం ఎలా చేయాలి?',
      language: 'Telugu',
      expectedAction: 'FORWARD_TO_OLLAMA',
    },
    {
      name: 'Non-Physiotherapy Spoken Question',
      transcript: 'Write Python code for a calculator.',
      language: 'English',
      expectedAction: 'BLOCKED_BY_DOMAIN_GUARD',
    },
  ];

  for (const tc of voiceTestCases) {
    try {
      const chatRes = await fetch('http://localhost:3000/api/physio-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: tc.transcript,
          language: tc.language,
        }),
      });

      const chatData = await chatRes.json();
      let actualAction = 'UNKNOWN';

      if (chatData.model === 'domain-guard') {
        actualAction = 'BLOCKED_BY_DOMAIN_GUARD';
      } else if (chatData.success && chatData.model === 'llama3.2:1b') {
        actualAction = 'FORWARD_TO_OLLAMA';
      }

      const pass = actualAction === tc.expectedAction;
      if (!pass) allPassed = false;

      console.log(`   [${pass ? 'PASS' : 'FAIL'}] ${tc.name}: "${tc.transcript}"`);
      console.log(`          Action: ${actualAction} (Expected: ${tc.expectedAction}) | Model: ${chatData.model}`);
      if (actualAction === 'FORWARD_TO_OLLAMA') {
        console.log(`          Ollama Reply: "${chatData.reply.slice(0, 80)}..."`);
      }
    } catch (err) {
      allPassed = false;
      console.log(`   [ERROR] ${tc.name}: ${err.message}`);
    }
  }

  console.log('\n====================================================');
  console.log('   LOCAL STT & VOICE PIPELINE RESULT =', allPassed ? 'SUCCESS (ALL PASS)' : 'FAILED');
  console.log('====================================================');
}

runLocalSTTTests();
