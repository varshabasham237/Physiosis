import { queryOllamaHealth, handlePhysioChatRequest, getOllamaConfig } from '../server/ollama';

async function runDevConnectionTest() {
  console.log('==================================================');
  console.log('PHYSIOSIS — OLLAMA DEV CONNECTION TEST');
  console.log('==================================================\n');

  const { baseUrl, configuredModel } = getOllamaConfig();
  console.log(`Configured Base URL: ${baseUrl}`);
  console.log(`Configured Model: ${configuredModel || '(not set)'}\n`);

  const health = await queryOllamaHealth();

  console.log('OLLAMA:');
  console.log(health.status);
  console.log('');
  console.log('MODEL:');
  console.log(health.model || '(none installed)');
  console.log('');
  console.log(`AVAILABLE MODELS: [${health.availableModels.join(', ')}]`);
  console.log(`STATUS MESSAGE: ${health.message}`);
  console.log('--------------------------------------------------\n');

  // Test physiotherapy query via backend handler
  console.log('TESTING PROXY CHAT ENDPOINT (/api/physio-chat)...');
  const sampleQuestion = 'What is a warm-up before a shoulder mobility exercise?';
  console.log(`Question: "${sampleQuestion}"\n`);

  const chatResponse = await handlePhysioChatRequest({
    message: sampleQuestion,
    sessionContext: {
      exerciseName: 'Shoulder Abduction',
      stage: 'Warm-up',
    },
  });

  console.log(`Chat Endpoint Status Code: ${chatResponse.statusCode}`);
  console.log('Chat Endpoint Response:');
  console.log(JSON.stringify(chatResponse.payload, null, 2));
  console.log('\n==================================================');
}

runDevConnectionTest();
