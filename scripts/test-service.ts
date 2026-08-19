import { physioAssistantService } from '../src/services/physioAssistantService';

// Polyfill window fetch relative URLs for Node.js test environment
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.startsWith('/')) {
    input = `http://localhost:3000${input}`;
  }
  return originalFetch(input, init);
};

async function testService() {
  console.log('Testing physioAssistantService.checkOllamaHealth()...');
  const health = await physioAssistantService.checkOllamaHealth();
  console.log('Health Result:', health);

  console.log('\nTesting physioAssistantService.sendPhysioChatMessage()...');
  const chat = await physioAssistantService.sendPhysioChatMessage({
    message: 'What is a warm-up before a shoulder mobility exercise?',
    sessionContext: {
      exerciseName: 'Shoulder Abduction',
      stage: 'Warm-up',
    },
  });
  console.log('Chat Result:', chat);
}

testService();
