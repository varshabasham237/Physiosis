/**
 * SpeechOutputService.ts
 * Local Multilingual Text-to-Speech (TTS) Service Provider.
 *
 * Architecture:
 * - Priority: LOCAL_TTS (Primary: On-Device SAPI / pyttsx3 / Piper backend)
 *             -> BROWSER_TTS_FALLBACK (Secondary: window.speechSynthesis if local model is missing)
 *             -> TEXT_ONLY (Honest graceful fallback without breaking text chat).
 * - Zero Cloud APIs: Never sends voice/audio/text to third-party cloud speech services.
 * - Stores message language: Old responses are spoken in their own language when "Listen" is clicked.
 * - Sanitizes clinical text: Removes raw markdown headers, bolding, bullet points, and expands degrees ("165°" -> "165 degrees").
 * - Clean Interruption: Clicking "Stop" or generating a new response halts any currently playing audio immediately.
 */

import type { AssistantLanguage } from '../../types/assistant';

export type TTSProviderType = 'LOCAL_TTS' | 'BROWSER_TTS_FALLBACK' | 'NONE';

export interface TTSState {
  isSpeaking: boolean;
  currentMessageId: string | null;
  provider: TTSProviderType;
  language?: string;
}

export interface TTSResult {
  success: boolean;
  provider?: TTSProviderType;
  message?: string;
  error?: string;
}

class SpeechOutputServiceImpl {
  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentMessageId: string | null = null;
  private activeProvider: TTSProviderType = 'NONE';
  private onStateChangeListeners: ((state: TTSState) => void)[] = [];

  /**
   * Check if a voice model or synthesizer is available for the given language.
   */
  public isAvailable(language?: string | AssistantLanguage): boolean {
    const langCode = this.normalizeLangCode(language);

    // 1. Check local backend support (English SAPI / OneCore is available on-device)
    if (langCode.startsWith('en')) {
      return true;
    }

    // 2. Check browser speech synthesis voices if available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const voices = window.speechSynthesis.getVoices() || [];
        const hasBrowserVoice = voices.some((v) => {
          const vLang = (v.lang || '').toLowerCase();
          return vLang.startsWith(langCode) || (langCode === 'te' && vLang.includes('te')) || (langCode === 'hi' && vLang.includes('hi'));
        });
        if (hasBrowserVoice) return true;
      } catch {}
    }

    return false;
  }

  /**
   * Alias for isAvailable.
   */
  public isSupported(language?: string | AssistantLanguage): boolean {
    return this.isAvailable(language);
  }

  /**
   * Get list of currently supported language codes.
   */
  public getAvailableLanguages(): readonly string[] {
    const supported = ['en', 'en-IN', 'en-US', 'en-GB'];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const voices = window.speechSynthesis.getVoices() || [];
        if (voices.some((v) => v.lang.toLowerCase().startsWith('hi'))) supported.push('hi', 'hi-IN');
        if (voices.some((v) => v.lang.toLowerCase().startsWith('te'))) supported.push('te', 'te-IN');
      } catch {}
    }
    return supported;
  }

  /**
   * Get the current active provider name.
   */
  public getProviderName(): TTSProviderType {
    return this.activeProvider;
  }

  /**
   * Register a state change listener.
   */
  public onStateChange(listener: (state: TTSState) => void): () => void {
    this.onStateChangeListeners.push(listener);
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== listener);
    };
  }

  private notifyStateChange(isSpeaking: boolean, messageId: string | null = null, provider: TTSProviderType = 'NONE', language?: string) {
    this.currentMessageId = isSpeaking ? messageId : null;
    this.activeProvider = isSpeaking ? provider : 'NONE';
    const state: TTSState = {
      isSpeaking,
      currentMessageId: this.currentMessageId,
      provider: this.activeProvider,
      language,
    };
    this.onStateChangeListeners.forEach((listener) => {
      try {
        listener(state);
      } catch {}
    });
  }

  /**
   * Stop any currently playing audio or speech synthesis immediately.
   */
  public stop(): void {
    // 1. Stop HTML5 audio playback
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }

    // 2. Stop browser speech synthesis
    if (this.currentUtterance || (typeof window !== 'undefined' && 'speechSynthesis' in window)) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      this.currentUtterance = null;
    }

    this.notifyStateChange(false, null, 'NONE');
  }

  /**
   * Speak a text message using Local TTS (or Browser TTS Fallback).
   */
  public async speak(
    text: string,
    language?: string | AssistantLanguage,
    messageId?: string
  ): Promise<TTSResult> {
    // Always stop previous speech first to prevent overlapping audio
    this.stop();

    if (!text || !text.trim()) {
      return { success: false, error: 'EMPTY_TEXT', message: 'No text to speak.' };
    }

    const langCode = this.normalizeLangCode(language);
    const localeCode = this.normalizeLocaleCode(language);
    const sanitizedText = this.sanitizeTextForSpeech(text);

    // ── ATTEMPT 1: Local On-Device TTS Endpoint (/api/physio-tts) ───────────
    try {
      const res = await fetch('/api/physio-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sanitizedText,
          language: langCode,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success && data?.audioBase64) {
        this.notifyStateChange(true, messageId || null, 'LOCAL_TTS', localeCode);

        const audioUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        return new Promise<TTSResult>((resolve) => {
          audio.onended = () => {
            this.notifyStateChange(false, null, 'NONE');
            this.currentAudio = null;
            resolve({ success: true, provider: 'LOCAL_TTS' });
          };

          audio.onerror = () => {
            this.notifyStateChange(false, null, 'NONE');
            this.currentAudio = null;
            resolve(this.tryBrowserFallback(sanitizedText, localeCode, messageId));
          };

          audio.play().catch(() => {
            this.notifyStateChange(false, null, 'NONE');
            this.currentAudio = null;
            resolve(this.tryBrowserFallback(sanitizedText, localeCode, messageId));
          });
        });
      }
    } catch {
      // Local TTS endpoint failed or unreachable -> try fallback
    }

    // ── ATTEMPT 2: Browser TTS Fallback (Clearly Labeled) ───────────────────
    return this.tryBrowserFallback(sanitizedText, localeCode, messageId);
  }

  /**
   * Browser Speech Synthesis Fallback (Labeled as BROWSER_TTS_FALLBACK)
   */
  private tryBrowserFallback(text: string, localeCode: string, messageId?: string): Promise<TTSResult> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.resolve({
        success: false,
        provider: 'NONE',
        error: 'TTS_UNAVAILABLE',
        message: 'Voice output is unavailable for this language on this device. Text response is available.',
      });
    }

    const synth = window.speechSynthesis;
    const voices = synth.getVoices() || [];
    const cleanPrefix = localeCode.split('-')[0].toLowerCase();

    // Find matched voice
    const matchedVoice =
      voices.find((v) => (v.lang || '').toLowerCase() === localeCode.toLowerCase()) ||
      voices.find((v) => (v.lang || '').toLowerCase().startsWith(cleanPrefix)) ||
      (cleanPrefix === 'en' ? voices.find((v) => (v.lang || '').toLowerCase().startsWith('en')) : null);

    if (!matchedVoice && cleanPrefix !== 'en') {
      return Promise.resolve({
        success: false,
        provider: 'NONE',
        error: 'TTS_MODEL_MISSING',
        message: 'Voice output is unavailable for this language on this device. Text response is available.',
      });
    }

    return new Promise<TTSResult>((resolve) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = matchedVoice ? matchedVoice.lang : localeCode;
        if (matchedVoice) utterance.voice = matchedVoice;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        this.currentUtterance = utterance;
        this.notifyStateChange(true, messageId || null, 'BROWSER_TTS_FALLBACK', localeCode);

        utterance.onend = () => {
          this.notifyStateChange(false, null, 'NONE');
          this.currentUtterance = null;
          resolve({ success: true, provider: 'BROWSER_TTS_FALLBACK' });
        };

        utterance.onerror = () => {
          this.notifyStateChange(false, null, 'NONE');
          this.currentUtterance = null;
          resolve({
            success: false,
            provider: 'NONE',
            error: 'TTS_SYNTHESIS_FAILED',
            message: 'Voice output is unavailable for this language on this device. Text response is available.',
          });
        };

        synth.speak(utterance);
      } catch {
        this.notifyStateChange(false, null, 'NONE');
        resolve({
          success: false,
          provider: 'NONE',
          error: 'TTS_INITIALIZATION_FAILED',
          message: 'Voice output is unavailable for this language on this device. Text response is available.',
        });
      }
    });
  }

  private normalizeLangCode(language?: string | AssistantLanguage): string {
    if (!language) return 'en';
    if (typeof language === 'string') {
      return language.split('-')[0].toLowerCase().trim();
    }
    return (language.code || 'en').toLowerCase().trim();
  }

  private normalizeLocaleCode(language?: string | AssistantLanguage): string {
    if (!language) return 'en-IN';
    if (typeof language === 'string') {
      return language.trim();
    }
    return language.locale || `${language.code}-IN`;
  }

  private sanitizeTextForSpeech(text: string): string {
    if (!text) return '';
    return text
      // Redact credential patterns
      .replace(/(?:api[_-]?key|password|bearer\s+[a-zA-Z0-9_\-\.]+)/gi, '[redacted]')
      // Strip markdown bold and italic formatting
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      // Strip markdown headers and bullet symbols
      .replace(/^[#\-*•]\s*/gm, '')
      // Normalize degree angles: 165° -> 165 degrees
      .replace(/(\d+)\s*°/g, '$1 degrees')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const speechOutputService = new SpeechOutputServiceImpl();
