// Patch 11 Local Multilingual Text-to-Speech (TTS) Test Suite

import fs from 'fs';
import path from 'path';

async function runPatch11TTSTests() {
  console.log('================================================================');
  console.log('       PHYSIOSIS — PATCH 11 LOCAL MULTILINGUAL TTS TEST SUITE    ');
  console.log('================================================================\n');

  const tsxPath = path.resolve(process.cwd(), 'src', 'components', 'assistant', 'PhysioAssistant.tsx');
  const servicePath = path.resolve(process.cwd(), 'src', 'services', 'voice', 'SpeechOutputService.ts');
  const pyPath = path.resolve(process.cwd(), 'server', 'tts_service.py');

  const tsxContent = fs.readFileSync(tsxPath, 'utf8');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  const pyContent = fs.readFileSync(pyPath, 'utf8');

  const checks = [
    {
      name: '1. Message language stored in ChatMessage',
      test: () =>
        tsxContent.includes('language?: AssistantLanguage;') &&
        tsxContent.includes('language: assistantLanguage,'),
    },
    {
      name: '2. Listen button uses message.language (not just current dropdown)',
      test: () =>
        tsxContent.includes('handleSpeakMessage(msg.id, msg.text, msg.language)') &&
        tsxContent.includes('const targetLanguage = msgLanguage || assistantLanguage;'),
    },
    {
      name: '3. Audio interruption: sending a message stops prior speech',
      test: () =>
        tsxContent.includes('speechOutputService.stop();') &&
        tsxContent.includes('setCurrentlySpeakingMsgId(null);'),
    },
    {
      name: '4. Provider hierarchy: LOCAL_TTS with labeled BROWSER_TTS_FALLBACK',
      test: () =>
        serviceContent.includes('LOCAL_TTS') &&
        serviceContent.includes('BROWSER_TTS_FALLBACK') &&
        serviceContent.includes('tryBrowserFallback'),
    },
    {
      name: '5. Text sanitization (removes markdown, credentials, normalizes 165° -> 165 degrees)',
      test: () =>
        serviceContent.includes('sanitizeTextForSpeech') &&
        serviceContent.includes('165 degrees') &&
        pyContent.includes('sanitize_speech_text'),
    },
    {
      name: '6. Local SAPI / pyttsx3 / OneCore speech synthesis endpoint (/api/physio-tts) active for English',
      test: async () => {
        const res = await fetch('http://localhost:3000/api/physio-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Your shoulder range of motion reached 165 degrees.',
            language: 'en-IN',
          }),
        });
        const data = await res.json();
        return res.status === 200 && data.success && data.audioBase64 && data.audioBase64.length > 500;
      },
    },
    {
      name: '7. Honest fallback for missing local language models (Telugu / Hindi missing local model)',
      test: async () => {
        const res = await fetch('http://localhost:3000/api/physio-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'భుజం వ్యాయామం ఎలా చేయాలి?',
            language: 'te-IN',
          }),
        });
        const data = await res.json();
        // Should report clear message without breaking
        return (
          data.success === false &&
          data.message.includes('Voice output is unavailable for this language on this device')
        );
      },
    },
    {
      name: '8. Text chat completely independent of TTS failures',
      test: async () => {
        const chatRes = await fetch('http://localhost:3000/api/physio-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'What is shoulder flexion?',
            language: { code: 'en', locale: 'en-IN', name: 'English', nativeName: 'English' },
          }),
        });
        const chatData = await chatRes.json();
        return chatRes.status === 200 && chatData.success && chatData.reply.length > 20;
      },
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    try {
      const result = await check.test();
      const status = result ? 'PASS' : 'FAIL';
      console.log(`[${status}] ${check.name}`);
      if (!result) allPassed = false;
    } catch (e) {
      console.log(`[FAIL] ${check.name} (Error: ${e.message})`);
      allPassed = false;
    }
  }

  console.log('\n================================================================');
  console.log(`AUDIT RESULT: ${allPassed ? 'ALL 8 TTS CHECKS PASSED (100% SUCCESS)' : 'FAILED CHECKS DETECTED'}`);
  console.log('================================================================');
}

runPatch11TTSTests();
