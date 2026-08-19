import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin, ViteDevServer } from 'vite';

interface OllamaTagModel {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
}

interface OllamaTagsResponse {
  models?: OllamaTagModel[];
}

interface OllamaVersionResponse {
  version?: string;
}

import type { AssistantLanguage, PhysioAssistantContext } from '../src/types/assistant';

interface ChatRequestBody {
  message?: string;
  language?: AssistantLanguage | string;
  sessionContext?: PhysioAssistantContext;
}

import { checkSafetyGuard, RED_FLAG_SAFETY_RESPONSE } from '../src/engine/assistant/safetyGuard';
import { checkDomainGate, OUT_OF_DOMAIN_REFUSALS } from '../src/engine/assistant/domainGuard';
import { buildPhysioSystemPrompt, resolveLanguageObject } from '../src/engine/assistant/systemPrompt';

/**
 * Validate that response contains expected script for regional languages.
 */
function isResponseScriptConsistent(text: string, langCode: string): boolean {
  if (!text || text.trim().length === 0) return false;
  if (langCode === 'te') {
    // Telugu Unicode block: \u0C00-\u0C7F
    return /[\u0C00-\u0C7F]/.test(text);
  }
  if (langCode === 'hi') {
    // Devanagari Unicode block: \u0900-\u097F
    return /[\u0900-\u097F]/.test(text);
  }
  if (langCode === 'ta') {
    // Tamil Unicode block: \u0B80-\u0BFF
    return /[\u0B80-\u0BFF]/.test(text);
  }
  return true;
}

/**
 * Resolve local Ollama base URL and model from environment or fallback defaults.
 */
export function getOllamaConfig() {
  const baseUrl = (
    process.env.OLLAMA_BASE_URL ||
    process.env.VITE_OLLAMA_BASE_URL ||
    'http://127.0.0.1:11434'
  ).replace(/\/+$/, '');

  const configuredModel =
    process.env.OLLAMA_MODEL ||
    process.env.VITE_OLLAMA_MODEL ||
    '';

  return { baseUrl, configuredModel };
}

/**
 * Check connectivity and list models available in the local Ollama instance.
 */
export async function queryOllamaHealth() {
  const { baseUrl, configuredModel } = getOllamaConfig();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const [versionRes, tagsRes] = await Promise.all([
      fetch(`${baseUrl}/api/version`, { signal: controller.signal }).catch(() => null),
      fetch(`${baseUrl}/api/tags`, { signal: controller.signal }).catch(() => null),
    ]);

    clearTimeout(timeoutId);

    if (!versionRes || !versionRes.ok) {
      return {
        status: 'OFFLINE' as const,
        baseUrl,
        model: configuredModel,
        availableModels: [],
        message: 'Local Physio Assistant unavailable. Please start Ollama.',
      };
    }

    const versionData = (await versionRes.json().catch(() => ({}))) as OllamaVersionResponse;
    const tagsData = tagsRes && tagsRes.ok
      ? ((await tagsRes.json().catch(() => ({ models: [] }))) as OllamaTagsResponse)
      : { models: [] };

    const availableModels = (tagsData.models || []).map((m) => m.name);
    const activeModel = configuredModel || (availableModels.length > 0 ? availableModels[0] : '');

    return {
      status: 'CONNECTED' as const,
      baseUrl,
      version: versionData.version || 'unknown',
      model: activeModel,
      availableModels,
      message: availableModels.length === 0
        ? 'Ollama is connected, but no local models are installed yet. Set OLLAMA_MODEL in .env after pulling a model.'
        : `Connected to Ollama (${activeModel || 'No default model selected'}).`,
    };
  } catch {
    return {
      status: 'OFFLINE' as const,
      baseUrl,
      model: configuredModel,
      availableModels: [],
      message: 'Local Physio Assistant unavailable. Please start Ollama.',
    };
  }
}

/**
 * Helper to parse incoming JSON request stream.
 */
function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Request entity too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handle incoming physiotherapy chat request and forward to local Ollama instance.
 */
export async function handlePhysioChatRequest(
  reqBody: ChatRequestBody
): Promise<{ statusCode: number; payload: Record<string, any> }> {
  const userMessage = reqBody.message?.trim();
  if (!userMessage) {
    return {
      statusCode: 400,
      payload: {
        success: false,
        reply: 'Please provide a valid message.',
        error: 'EMPTY_MESSAGE',
        model: 'none',
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── 0. Authoritative Language Resolution ─────────────────────────────────
  const assistantLang = resolveLanguageObject(reqBody.language);

  // ── 1. Deterministic Clinical Red-Flag Safety Classifier ─────────────────
  // Intercept acute emergencies and high-risk symptoms immediately
  const safetyCheck = checkSafetyGuard(userMessage);
  if (safetyCheck.isRedFlag) {
    return {
      statusCode: 200,
      payload: {
        success: true,
        reply: RED_FLAG_SAFETY_RESPONSE,
        model: 'safety-guard',
        isRedFlag: true,
        category: safetyCheck.category,
        reason: safetyCheck.reason,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── 2. Deterministic Domain Gate Pre-Check (Localized Refusal) ───────────
  // Intercept and reject out-of-domain queries immediately without calling Ollama
  const domainCheck = checkDomainGate(userMessage, reqBody.sessionContext, assistantLang);
  if (!domainCheck.isAllowed) {
    return {
      statusCode: 200,
      payload: {
        success: true,
        reply: domainCheck.refusalMessage || OUT_OF_DOMAIN_REFUSALS[assistantLang.code] || OUT_OF_DOMAIN_REFUSALS.en,
        model: 'domain-guard',
        isOutOfDomain: true,
        reason: domainCheck.reason,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── 3. Local Ollama Health & Model Verification ──────────────────────────
  const { baseUrl, configuredModel } = getOllamaConfig();
  const health = await queryOllamaHealth();

  if (health.status !== 'CONNECTED') {
    return {
      statusCode: 503,
      payload: {
        success: false,
        reply: 'Local assistant unavailable. Please check Ollama.',
        error: 'OLLAMA_OFFLINE',
        model: configuredModel || 'none',
        timestamp: new Date().toISOString(),
      },
    };
  }

  const modelToUse =
    configuredModel ||
    (health.availableModels?.length > 0 ? health.availableModels[0] : health.model);

  if (!modelToUse) {
    return {
      statusCode: 503,
      payload: {
        success: false,
        reply: 'Local assistant unavailable. Please check Ollama.',
        error: 'NO_MODEL_CONFIGURED',
        model: 'none',
        availableModels: health.availableModels,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ── 4. Compose Authoritative Non-Diagnostic System Prompt ───────────────
  const systemPrompt = buildPhysioSystemPrompt(reqBody.sessionContext, assistantLang);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const ollamaResponse = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelToUse,
        system: systemPrompt,
        prompt: userMessage,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!ollamaResponse.ok) {
      return {
        statusCode: ollamaResponse.status,
        payload: {
          success: false,
          reply: 'Local assistant unavailable. Please check Ollama.',
          error: 'OLLAMA_API_ERROR',
          model: modelToUse,
          timestamp: new Date().toISOString(),
        },
      };
    }

    const data = (await ollamaResponse.json()) as { response?: string };
    let finalReply = data.response || '';

    // ── 5. Response Language Validation & Single Retry (Requirement 9) ───────
    // If obvious language mismatch is detected for regional languages, retry Ollama ONCE
    if (
      (assistantLang.code === 'te' || assistantLang.code === 'hi' || assistantLang.code === 'ta') &&
      !isResponseScriptConsistent(finalReply, assistantLang.code)
    ) {
      try {
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 45000);

        const retryPrompt = `Your previous response was not in the required language (${assistantLang.name}). Rewrite the same answer in ${assistantLang.name} (${assistantLang.nativeName}) script only. Do not add new information.\n\nOriginal question: "${userMessage}"\nPrevious answer: "${finalReply}"`;

        const retryRes = await fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelToUse,
            system: systemPrompt,
            prompt: retryPrompt,
            stream: false,
          }),
          signal: retryController.signal,
        });

        clearTimeout(retryTimeoutId);

        if (retryRes.ok) {
          const retryData = (await retryRes.json()) as { response?: string };
          if (retryData.response && retryData.response.trim().length > 0) {
            finalReply = retryData.response;
          }
        }
      } catch {
        // Fallback to initial response if retry timed out or failed
      }
    }

    return {
      statusCode: 200,
      payload: {
        success: true,
        reply: finalReply,
        model: modelToUse,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      payload: {
        success: false,
        reply: 'Local assistant unavailable. Please check Ollama.',
        error: err?.message || 'UNKNOWN_ERROR',
        model: modelToUse,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

interface STTRequestBody {
  audioBase64?: string;
  language?: string;
  modelSize?: string;
}

export async function handleLocalSTTRequest(
  reqBody: STTRequestBody
): Promise<{ statusCode: number; payload: Record<string, any> }> {
  if (!reqBody.audioBase64) {
    return {
      statusCode: 400,
      payload: {
        success: false,
        error: 'EMPTY_AUDIO',
        message: 'No audio data provided.',
      },
    };
  }

  // Create temporary local audio file
  const tempDir = os.tmpdir();
  const tempFileName = `physio_stt_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`;
  const tempFilePath = path.join(tempDir, tempFileName);

  try {
    const audioBuffer = Buffer.from(reqBody.audioBase64, 'base64');
    fs.writeFileSync(tempFilePath, audioBuffer);

    const scriptPath = path.resolve(process.cwd(), 'server', 'stt_service.py');
    const model = reqBody.modelSize || 'tiny';
    const langArgs = reqBody.language ? ['--language', reqBody.language] : [];

    const resultJson = await new Promise<string>((resolve, reject) => {
      const child = spawn('python', [
        scriptPath,
        '--audio',
        tempFilePath,
        '--model',
        model,
        ...langArgs,
      ]);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`STT process exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });

    // Parse JSON result from python stdout (find valid JSON line)
    const lines = resultJson.trim().split('\n');
    let parsed: any = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        parsed = JSON.parse(lines[i]);
        break;
      } catch {}
    }

    if (!parsed) {
      throw new Error(`Failed to parse STT output: ${resultJson}`);
    }

    return {
      statusCode: parsed.success ? 200 : 500,
      payload: parsed,
    };
  } catch (err: any) {
    return {
      statusCode: 503,
      payload: {
        success: false,
        error: 'LOCAL_STT_UNAVAILABLE',
        message: 'Local voice input is unavailable on this device.',
        details: err?.message,
      },
    };
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {}
  }
}

interface TTSRequestBody {
  text?: string;
  language?: string;
}

export async function handleLocalTTSRequest(
  reqBody: TTSRequestBody
): Promise<{ statusCode: number; payload: Record<string, any> }> {
  if (!reqBody.text) {
    return {
      statusCode: 400,
      payload: {
        success: false,
        error: 'EMPTY_TEXT',
        message: 'No text provided for speech synthesis.',
      },
    };
  }

  const scriptPath = path.resolve(process.cwd(), 'server', 'tts_service.py');
  const lang = reqBody.language || 'en';

  try {
    const resultJson = await new Promise<string>((resolve, reject) => {
      const child = spawn('python', [
        scriptPath,
        '--text',
        reqBody.text || '',
        '--language',
        lang,
      ]);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`TTS process exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });

    const lines = resultJson.trim().split('\n');
    let parsed: any = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        parsed = JSON.parse(lines[i]);
        break;
      } catch {}
    }

    if (!parsed) {
      throw new Error(`Failed to parse TTS output: ${resultJson}`);
    }

    return {
      statusCode: parsed.success ? 200 : 200,
      payload: parsed,
    };
  } catch (err: any) {
    return {
      statusCode: 503,
      payload: {
        success: false,
        error: 'LOCAL_TTS_UNAVAILABLE',
        message: 'Voice output is unavailable for this language on this device. Text response is available.',
        details: err?.message,
      },
    };
  }
}

/**
 * Vite Dev Server Plugin to mount /api/physio-chat, /api/physio-health, /api/physio-stt, and /api/physio-tts
 */
export function ollamaDevServerPlugin(): Plugin {
  return {
    name: 'vite-plugin-physio-ollama-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url?.split('?')[0];

        // 1. Health check endpoint
        if (url === '/api/physio-health' || url === '/api/ollama-status') {
          if (req.method === 'GET') {
            const health = await queryOllamaHealth();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(health));
            return;
          }
        }

        // 2. Chat endpoint
        if (url === '/api/physio-chat') {
          if (req.method === 'POST') {
            try {
              const body = await parseJsonBody<ChatRequestBody>(req);
              const result = await handlePhysioChatRequest(body);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = result.statusCode;
              res.end(JSON.stringify(result.payload));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  success: false,
                  reply: 'Local assistant unavailable. Please check Ollama.',
                  error: err?.message,
                  timestamp: new Date().toISOString(),
                })
              );
            }
            return;
          } else {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
        }

        // 3. Local Speech-to-Text endpoint (Patch C: Local Whisper STT)
        if (url === '/api/physio-stt') {
          if (req.method === 'POST') {
            try {
              const body = await parseJsonBody<STTRequestBody>(req);
              const result = await handleLocalSTTRequest(body);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = result.statusCode;
              res.end(JSON.stringify(result.payload));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 503;
              res.end(
                JSON.stringify({
                  success: false,
                  message: 'Local voice input is unavailable on this device.',
                  error: err?.message,
                })
              );
            }
            return;
          } else {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
        }

        // 4. Local STT health status endpoint
        if (url === '/api/physio-stt-health') {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                status: 'AVAILABLE',
                provider: 'faster-whisper',
                model: 'tiny',
                isLocal: true,
                cloudDependency: false,
              })
            );
            return;
          }
        }

        // 5. Local Text-to-Speech endpoint (Patch D: Local TTS)
        if (url === '/api/physio-tts') {
          if (req.method === 'POST') {
            try {
              const body = await parseJsonBody<TTSRequestBody>(req);
              const result = await handleLocalTTSRequest(body);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = result.statusCode;
              res.end(JSON.stringify(result.payload));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 503;
              res.end(
                JSON.stringify({
                  success: false,
                  message: 'Voice output is unavailable for this language on this device. Text response is available.',
                  error: err?.message,
                })
              );
            }
            return;
          } else {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
        }

        // 6. Local TTS health / voices endpoint
        if (url === '/api/physio-tts-health') {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                status: 'AVAILABLE',
                provider: 'local-pyttsx3-sapi',
                isLocal: true,
                cloudDependency: false,
                supportedLanguages: ['en', 'en-IN', 'en-US', 'en-GB'],
              })
            );
            return;
          }
        }

        next();
      });
    },
  };
}
