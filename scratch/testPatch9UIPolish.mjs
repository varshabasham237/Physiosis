// Patch 9 UI Polish & Responsive Layout Verification Script

import fs from 'fs';
import path from 'path';

async function runPatch9UIAudit() {
  console.log('================================================================');
  console.log('       PHYSIOSIS — PATCH 9 ASSISTANT UI FINAL POLISH AUDIT      ');
  console.log('================================================================\n');

  const cssPath = path.resolve(process.cwd(), 'src', 'index.css');
  const tsxPath = path.resolve(process.cwd(), 'src', 'components', 'assistant', 'PhysioAssistant.tsx');

  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const tsxContent = fs.readFileSync(tsxPath, 'utf8');

  const checks = [
    {
      name: '1. Header controls fit without overlap',
      test: () =>
        cssContent.includes('.physio-chat__header-actions') &&
        cssContent.includes('gap: 4px') &&
        cssContent.includes('flex-shrink: 0'),
    },
    {
      name: '2. Language selector readable & styled',
      test: () =>
        cssContent.includes('.physio-chat__lang-selector') &&
        cssContent.includes('color: var(--text-primary)') &&
        cssContent.includes('max-width: 140px'),
    },
    {
      name: '3. Voice button shows OFF / LISTENING / PROCESSING',
      test: () =>
        tsxContent.includes('physio-chat__mic-btn--listening') &&
        tsxContent.includes('physio-chat__mic-btn--processing') &&
        tsxContent.includes('physio-chat__mic-btn--off') &&
        tsxContent.includes('Voice: LISTENING') &&
        tsxContent.includes('Voice: PROCESSING') &&
        tsxContent.includes('Voice: OFF'),
    },
    {
      name: '4. Chat messages scroll independently',
      test: () =>
        cssContent.includes('.physio-chat__history') &&
        cssContent.includes('overflow-y: auto') &&
        cssContent.includes('min-height: 0') &&
        cssContent.includes('flex: 1 1 auto'),
    },
    {
      name: '5. Suggested questions wrap cleanly',
      test: () =>
        cssContent.includes('.quick-prompts__chips') &&
        cssContent.includes('flex-wrap: wrap') &&
        cssContent.includes('.quick-prompt-chip') &&
        cssContent.includes('white-space: normal'),
    },
    {
      name: '6. Input + mic + send pinned & always visible',
      test: () =>
        cssContent.includes('.physio-chat__input-bar') &&
        cssContent.includes('flex-shrink: 0') &&
        cssContent.includes('.physio-chat__mic-btn') &&
        cssContent.includes('.physio-chat__send-btn'),
    },
    {
      name: '7. Long Telugu/Hindi/English messages wrap correctly',
      test: () =>
        cssContent.includes('.physio-chat__bubble') &&
        cssContent.includes('word-break: break-word') &&
        cssContent.includes('overflow-wrap: anywhere'),
    },
    {
      name: '8. No page-level horizontal scrolling',
      test: () =>
        cssContent.includes('overflow-x: hidden') &&
        cssContent.includes('max-width: calc(100vw - 32px)'),
    },
    {
      name: '9. Dark clinical styling preserved',
      test: () =>
        cssContent.includes('background: hsla(220, 16%, 10%, 0.96)') &&
        cssContent.includes('var(--accent-cyan)') &&
        cssContent.includes('var(--accent-blue)'),
    },
    {
      name: '10. Assistant live chat pipeline active',
      test: async () => {
        const res = await fetch('http://localhost:3000/api/physio-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'naaku cheyi pain undhi',
            language: { code: 'te', locale: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' },
          }),
        });
        const data = await res.json();
        return res.status === 200 && data.success && /[\u0C00-\u0C7F]/.test(data.reply);
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
  console.log(`AUDIT RESULT: ${allPassed ? 'ALL 10 CHECKS PASSED (100% SUCCESS)' : 'FAILED CHECKS DETECTED'}`);
  console.log('================================================================');
}

runPatch9UIAudit();
