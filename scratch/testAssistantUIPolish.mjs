// Assistant UI/UX Polish Test Suite

import fs from 'fs';
import path from 'path';

async function runAssistantUIPolishTests() {
  console.log('================================================================');
  console.log('       PHYSIOSIS — ASSISTANT UI/UX POLISH TEST SUITE             ');
  console.log('================================================================\n');

  const tsxPath = path.resolve(process.cwd(), 'src', 'components', 'assistant', 'PhysioAssistant.tsx');
  const cssPath = path.resolve(process.cwd(), 'src', 'index.css');

  const tsxContent = fs.readFileSync(tsxPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  const checks = [
    {
      name: '1. Assistant Desktop Dimensions (440px width, 680px height)',
      test: () =>
        cssContent.includes('width: 440px;') &&
        cssContent.includes('height: 680px;') &&
        cssContent.includes('max-height: calc(100vh - 40px);'),
    },
    {
      name: '2. Panel Position & Dark Modern Medical-Tech Elevation',
      test: () =>
        cssContent.includes('bottom: 20px;') &&
        cssContent.includes('right: 20px;') &&
        cssContent.includes('position: fixed;') &&
        cssContent.includes('box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65)'),
    },
    {
      name: '3. Professional Header Hierarchy & Subtitle',
      test: () =>
        tsxContent.includes('PHYSIOSIS ASSISTANT') &&
        tsxContent.includes('Advisory rehabilitation support') &&
        tsxContent.includes('Ollama Online'),
    },
    {
      name: '4. High-Contrast Language Selector & Multi-State Voice Button',
      test: () =>
        cssContent.includes('.physio-chat__lang-selector') &&
        cssContent.includes('width: 140px;') &&
        tsxContent.includes('physio-chat__voice-header-btn') &&
        tsxContent.includes('Voice Off'),
    },
    {
      name: '5. Clean Horizontally Scrollable Suggested Questions Chips',
      test: () =>
        cssContent.includes('.quick-prompts__chips') &&
        cssContent.includes('overflow-x: auto;') &&
        cssContent.includes('border-radius: 999px;') &&
        cssContent.includes('font-size: 12px;'),
    },
    {
      name: '6. Flexible Conversation History & Readability (78% User, 88% Assistant, 13.5px font, 1.5 line-height)',
      test: () =>
        cssContent.includes('flex: 1 1 auto;') &&
        cssContent.includes('overflow-y: auto;') &&
        cssContent.includes('max-width: 78%;') &&
        cssContent.includes('max-width: 88%;') &&
        cssContent.includes('font-size: 13.5px;') &&
        cssContent.includes('line-height: 1.5;'),
    },
    {
      name: '7. Polished Amber Card for Out-of-Domain Blocked Questions',
      test: () =>
        tsxContent.includes('PHYSIOTHERAPY ONLY') &&
        cssContent.includes('.bubble__restricted-badge'),
    },
    {
      name: '8. Polished Emergency Card for Red-Flag Medical Symptoms',
      test: () =>
        tsxContent.includes('CLINICAL SAFETY NOTICE') &&
        cssContent.includes('.bubble__red-flag-badge'),
    },
    {
      name: '9. Thinking State Animation ("Physiosis is thinking…")',
      test: () =>
        tsxContent.includes('Physiosis is thinking…') &&
        cssContent.includes('.bubble--thinking'),
    },
    {
      name: '10. Large Input Bar (54px min-height, 42px height input, 42x42px Mic & Send buttons)',
      test: () =>
        cssContent.includes('min-height: 54px;') &&
        cssContent.includes('height: 42px;') &&
        cssContent.includes('width: 42px;') &&
        tsxContent.includes('placeholder=') &&
        tsxContent.includes('Ask about your exercise, movement, or session…'),
    },
    {
      name: '11. Advisory Disclaimer Footer',
      test: () =>
        tsxContent.includes('Advisory rehabilitation assistant. Not a diagnostic service.') &&
        cssContent.includes('.physio-chat__footer'),
    },
    {
      name: '12. Responsive Mobile/Tablet Breakpoint (Full viewport safety)',
      test: () =>
        cssContent.includes('@media (max-width: 768px)') &&
        cssContent.includes('width: calc(100vw - 24px);') &&
        cssContent.includes('height: calc(100vh - 24px);'),
    },
    {
      name: '13. Functional Verification: Chat Pipeline API test',
      test: async () => {
        const res = await fetch('http://localhost:3000/api/physio-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'How does shoulder abduction exercise help rotator cuff recovery?',
            language: { code: 'en', locale: 'en-IN', name: 'English', nativeName: 'English' },
          }),
        });
        const data = await res.json();
        return res.status === 200 && data.success && data.reply.length > 30;
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
  console.log(`AUDIT RESULT: ${allPassed ? 'ALL 13 UI/UX CHECKS PASSED (100% SUCCESS)' : 'FAILED CHECKS DETECTED'}`);
  console.log('================================================================');
}

runAssistantUIPolishTests();
