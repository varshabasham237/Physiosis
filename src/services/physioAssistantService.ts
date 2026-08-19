/**
 * physioAssistantService.ts
 * Frontend service layer for interacting with the local Physiosis Physiotherapy Assistant proxy.
 *
 * Rules:
 *   - Never calls Ollama or any cloud LLM directly from the browser
 *   - Communicates solely through the local proxy endpoint (/api/physio-chat, /api/physio-health)
 *   - Safely catches and handles all network/offline errors without crashing Physiosis
 */

import type {
  AssistantLanguage,
  PhysioAssistantRequest,
  PhysioAssistantResponse,
  PhysioAssistantContext,
  OllamaConnectionStatus,
} from '../types/assistant';

import { checkDomainGate, OUT_OF_DOMAIN_REFUSAL_MESSAGE } from '../engine/assistant/domainGuard';
import {
  buildPhysioAssistantContext,
  type ResolveAssistantContextParams,
} from '../engine/assistant/contextResolver';

export const physioAssistantService = {
  /**
   * Resolve a privacy-safe PhysioAssistantContext from active state and history.
   */
  resolveContext(params: ResolveAssistantContextParams): PhysioAssistantContext {
    return buildPhysioAssistantContext(params);
  },

  /**
   * Health check for local Ollama availability and model configuration.
   */
  async checkOllamaHealth(): Promise<OllamaConnectionStatus> {
    try {
      const response = await fetch('/api/physio-health', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          status: 'OFFLINE',
          baseUrl: 'http://localhost:11434',
          model: '',
          availableModels: [],
          message: 'Local Physio Assistant unavailable. Please start Ollama.',
        };
      }

      const data = (await response.json()) as OllamaConnectionStatus;
      return data;
    } catch {
      return {
        status: 'OFFLINE',
        baseUrl: 'http://localhost:11434',
        model: '',
        availableModels: [],
        message: 'Local Physio Assistant unavailable. Please start Ollama.',
      };
    }
  },

  /**
   * Send a physiotherapy question or session context to the local assistant.
   * Deterministically intercepts out-of-domain queries locally before network transmission.
   */
  async sendPhysioChatMessage(
    request: PhysioAssistantRequest
  ): Promise<PhysioAssistantResponse> {
    // 1. Client-Side Deterministic Domain Pre-Check (Language-Aware)
    const domainCheck = checkDomainGate(request.message, request.sessionContext, request.language);
    if (!domainCheck.isAllowed) {
      return {
        success: true,
        reply: domainCheck.refusalMessage || OUT_OF_DOMAIN_REFUSAL_MESSAGE,
        model: 'domain-guard',
        isOutOfDomain: true,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch('/api/physio-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data) {
        return {
          success: false,
          reply: data?.reply || 'Local Physio Assistant unavailable. Please start Ollama.',
          model: data?.model || 'unknown',
          timestamp: new Date().toISOString(),
          error: data?.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: data.success ?? true,
        reply: data.reply || '',
        model: data.model || 'local-ollama',
        timestamp: data.timestamp || new Date().toISOString(),
        isRedFlag: data.isRedFlag,
        isOutOfDomain: data.isOutOfDomain,
        category: data.category,
        error: data.error,
      };
    } catch (err: any) {
      return {
        success: false,
        reply: 'Local Physio Assistant unavailable. Please start Ollama.',
        model: 'unknown',
        timestamp: new Date().toISOString(),
        error: err?.message || 'NETWORK_ERROR',
      };
    }
  },

  /**
   * Convenience wrapper that automatically resolves session context from live state.
   */
  async sendSessionAwareMessage(
    message: string,
    contextParams: ResolveAssistantContextParams,
    language?: AssistantLanguage | string
  ): Promise<PhysioAssistantResponse> {
    const sessionContext = buildPhysioAssistantContext(contextParams);
    return this.sendPhysioChatMessage({
      message,
      sessionContext,
      language,
    });
  },
};
