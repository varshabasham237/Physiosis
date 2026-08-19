/**
 * SpeechInputService.ts
 * Provider abstraction layer for Local On-Device Multilingual Speech-to-Text (STT).
 *
 * Architecture:
 * - 100% Local On-Device Speech Pipeline (Zero Cloud / No Google Speech APIs).
 * - Provider abstraction: SpeechInputService -> LocalWhisperProvider
 * - Client captures raw microphone audio locally using MediaRecorder API + AudioContext RMS analyzer.
 * - Streams audio to local backend endpoint `POST /api/physio-stt`.
 * - Backend transcribes audio on-device using local `faster-whisper` (CTranslate2).
 * - Enforces safety timeouts and clean state transitions: IDLE -> LISTENING -> TRANSCRIBING -> IDLE / ERROR.
 * - Fallback: Informs user that local voice input is unavailable on device, offering text input.
 */

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_VOICE_LANGUAGES: readonly SupportedLanguage[] = [
  { code: 'en-IN', name: 'English (India)', nativeName: 'English' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી' },
];

export type SpeechInputState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'error'
  | 'unsupported';

export interface SpeechInputCallbacks {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onStateChange: (state: SpeechInputState) => void;
  onError: (errorMessage: string) => void;
  onAudioLevel?: (level: number) => void; // 0.0 to 1.0 real-time microphone RMS volume
}

export interface SpeechInputOptions {
  language?: string;
  callbacks: SpeechInputCallbacks;
  maxDurationSeconds?: number;
}

/**
 * Common interface for Speech-to-Text providers.
 */
export interface SpeechInputProvider {
  name: string;
  isAvailable(): Promise<boolean> | boolean;
  start(options: SpeechInputOptions): Promise<void>;
  stop(): Promise<void>;
  getStatus(): SpeechInputState;
}

/**
 * 100% Local On-Device Whisper STT Provider.
 * Captures microphone audio locally and dispatches to local faster-whisper proxy.
 */
export class LocalWhisperProvider implements SpeechInputProvider {
  public readonly name = 'Local faster-whisper (CTranslate2)';

  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: any = null;
  private audioChunks: Blob[] = [];
  private state: SpeechInputState = 'idle';
  private currentCallbacks: SpeechInputCallbacks | null = null;
  private safetyTimeoutId: any = null;
  private currentLanguage = 'en-IN';

  public isAvailable(): boolean {
    if (typeof window === 'undefined' || !navigator.mediaDevices) return false;
    return (
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  public getStatus(): SpeechInputState {
    return this.state;
  }

  public async start(options: SpeechInputOptions): Promise<void> {
    if (!this.isAvailable()) {
      this.state = 'unsupported';
      options.callbacks.onStateChange('unsupported');
      options.callbacks.onError(
        'Local voice input is unavailable on this device. Please use text input.'
      );
      return;
    }

    await this.stop();
    this.currentCallbacks = options.callbacks;
    this.currentLanguage = options.language || 'en-IN';
    this.audioChunks = [];

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // 1. Initialize Web Audio API Analyser for real-time live volume level
      this.initAudioAnalyser(this.audioStream);

      // 2. Initialize MediaRecorder
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        await this.processRecordedAudio();
      };

      this.mediaRecorder.start(250); // Collect data chunks every 250ms
      this.state = 'listening';
      this.currentCallbacks?.onStateChange('listening');

      // Safety duration limit (default 15 seconds)
      const maxSeconds = options.maxDurationSeconds || 15;
      this.safetyTimeoutId = setTimeout(() => {
        if (this.state === 'listening') {
          this.stop();
        }
      }, maxSeconds * 1000);
    } catch (err: any) {
      this.state = 'error';
      this.currentCallbacks?.onStateChange('error');
      const isPermissionDenied =
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      const msg = isPermissionDenied
        ? 'Microphone access is required for voice input. Please allow microphone permissions or use text input.'
        : 'Local voice recognition unavailable.';
      this.currentCallbacks?.onError(msg);
      this.cleanup();
    }
  }

  public async stop(): Promise<void> {
    this.stopAudioAnalyser();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.releaseMicrophone();
  }

  private initAudioAnalyser(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const pollLevel = () => {
        if (!this.analyser || this.state !== 'listening') return;

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(1.0, average / 100);

        if (this.currentCallbacks?.onAudioLevel) {
          this.currentCallbacks.onAudioLevel(normalized);
        }

        this.animFrameId = requestAnimationFrame(pollLevel);
      };

      this.animFrameId = requestAnimationFrame(pollLevel);
    } catch {
      // Audio level meter is an enhancement; continue even if analyser fails
    }
  }

  private stopAudioAnalyser(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
    if (this.currentCallbacks?.onAudioLevel) {
      this.currentCallbacks.onAudioLevel(0);
    }
  }

  private async processRecordedAudio(): Promise<void> {
    if (this.audioChunks.length === 0) {
      this.cleanup();
      return;
    }

    this.state = 'transcribing';
    this.currentCallbacks?.onStateChange('transcribing');

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const base64Audio = await this.blobToBase64(audioBlob);

      const response = await fetch('/api/physio-stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          language: this.currentLanguage,
          modelSize: 'tiny',
        }),
      });

      if (!response.ok) {
        throw new Error('Local voice recognition unavailable.');
      }

      const data = await response.json();

      if (data.success && data.transcript && data.transcript.trim().length > 0) {
        const transcript = data.transcript.trim();
        this.currentCallbacks?.onTranscript(transcript, true);
      } else {
        this.currentCallbacks?.onError(
          "I couldn't clearly understand that. Please try again or use text input."
        );
      }
    } catch (err: any) {
      this.state = 'error';
      this.currentCallbacks?.onStateChange('error');
      this.currentCallbacks?.onError('Local voice recognition unavailable.');
    } finally {
      this.cleanup();
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64 || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private releaseMicrophone(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.audioStream = null;
    }
  }

  private cleanup(): void {
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
    }
    this.stopAudioAnalyser();
    this.releaseMicrophone();
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.state = 'idle';
    this.currentCallbacks?.onStateChange('idle');
  }
}

/**
 * Authoritative Speech Input Service managing provider lifecycle.
 */
class SpeechInputServiceImpl {
  private provider: SpeechInputProvider;

  constructor(provider?: SpeechInputProvider) {
    this.provider = provider || new LocalWhisperProvider();
  }

  public setProvider(provider: SpeechInputProvider): void {
    this.provider = provider;
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  public isSupported(): boolean {
    return Boolean(this.provider.isAvailable());
  }

  public isAvailable(): boolean {
    return this.isSupported();
  }

  public getStatus(): SpeechInputState {
    return this.provider.getStatus();
  }

  public getSupportedLanguages(): readonly SupportedLanguage[] {
    return SUPPORTED_VOICE_LANGUAGES;
  }

  public async startListening(options: SpeechInputOptions): Promise<void> {
    return this.provider.start(options);
  }

  public async stopListening(): Promise<void> {
    return this.provider.stop();
  }
}

export const speechInputService = new SpeechInputServiceImpl();
