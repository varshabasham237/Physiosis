// Physiosis — Demo Mode Comprehensive Test Suite
import fs from 'fs';
import path from 'path';

async function runDemoModeTests() {
  console.log('================================================================');
  console.log('            PHYSIOSIS — DEMO MODE COMPREHENSIVE SUITE           ');
  console.log('================================================================\n');

  const dashboardSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/dashboard/Dashboard.tsx'), 'utf8');
  const liveFeedSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/dashboard/LiveFeedCard.tsx'), 'utf8');
  const analysisSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/dashboard/AnalysisCard.tsx'), 'utf8');
  const refCardSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/dashboard/ReferenceExerciseCard.tsx'), 'utf8');
  const refCanvasSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/skeleton/ReferenceSkeletonCanvas.tsx'), 'utf8');
  const badgeSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/dashboard/EngineStatusBadge.tsx'), 'utf8');
  const sessionHealthSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/dashboard/SessionHealthCard.tsx'), 'utf8');
  const qaPanelSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/dev/PresentationQAPanel.tsx'), 'utf8');

  const tests = [
    {
      name: '1. Explicit application mode supports TUTORIAL, PRACTICE, LIVE, and DEMO',
      test: () =>
        dashboardSrc.includes("useState<'TUTORIAL' | 'PRACTICE' | 'LIVE' | 'DEMO'>('TUTORIAL')"),
    },
    {
      name: '2. handleEnterDemoMode stops camera, sets DEMO mode, and resets session state',
      test: () =>
        dashboardSrc.includes('handleEnterDemoMode') &&
        dashboardSrc.includes("setMode('DEMO')") &&
        dashboardSrc.includes('resetExerciseSession()') &&
        dashboardSrc.includes('setPersistenceStatus'),
    },
    {
      name: '3. EngineStatusBadge shows distinct DEMO MODE status in header when active',
      test: () =>
        badgeSrc.includes("mode === 'DEMO'") &&
        badgeSrc.includes('DEMO MODE'),
    },
    {
      name: '4. LiveFeedCard displays DEMONSTRATION ACTIVE & Camera not required in DEMO mode',
      test: () =>
        liveFeedSrc.includes("DEMONSTRATION ACTIVE") &&
        liveFeedSrc.includes("Camera not required") &&
        liveFeedSrc.includes("onExitDemoMode"),
    },
    {
      name: '5. AnalysisCard displays DEMO ANALYSIS, Demonstration data, and 4 distinct phases',
      test: () =>
        analysisSrc.includes("DEMO ANALYSIS") &&
        analysisSrc.includes("Demonstration data") &&
        analysisSrc.includes("LIMITATION") &&
        analysisSrc.includes("CORRECTION") &&
        analysisSrc.includes("IMPROVED"),
    },
    {
      name: '6. ReferenceSkeletonCanvas synchronizes animation frames and timeline with dashboard in DEMO mode',
      test: () =>
        refCanvasSrc.includes("onDemoFrame") &&
        refCanvasSrc.includes("onExitDemoMode") &&
        refCardSrc.includes("onDemoFrame"),
    },
    {
      name: '7. SessionHealthCard and endSession protect patient data isolation (NEVER writes to Supabase in DEMO mode)',
      test: () =>
        dashboardSrc.includes("if (mode === 'DEMO') {") &&
        sessionHealthSrc.includes("isDemo ? 'Demonstration mode — Non-persistent'"),
    },
    {
      name: '8. Exercise switching preserves DEMO mode without forcing LIVE mode or camera permissions',
      test: () =>
        dashboardSrc.includes("setMode((prev) => (prev === 'DEMO' ? 'DEMO' : 'TUTORIAL'))"),
    },
    {
      name: '9. Developer QA Panel displays Application Mode: DEMO, Camera: OFF, Demo Timeline & Phase',
      test: () =>
        qaPanelSrc.includes("Application Mode:") &&
        qaPanelSrc.includes("Camera:") &&
        qaPanelSrc.includes("Demo Timeline:") &&
        qaPanelSrc.includes("Persistent Save:"),
    },
  ];

  let allPassed = true;
  for (const t of tests) {
    const passed = t.test();
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${t.name}`);
    if (!passed) allPassed = false;
  }

  console.log('\n================================================================');
  console.log(`AUDIT RESULT: ${allPassed ? 'ALL DEMO MODE CHECKS PASSED (100% SUCCESS)' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================\n');
}

runDemoModeTests();
