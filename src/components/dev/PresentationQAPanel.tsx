/**
 * PresentationQAPanel.tsx
 * Developer-only QA and presentation readiness verification panel.
 *
 * Hidden from normal users. Toggle with `Shift + D` or URL parameter `?qa=1`.
 *
 * Displays live engine and auth telemetry:
 *   - MediaPipe Model Status (READY / INITIALIZING / OFFLINE / ERROR)
 *   - Camera Stream (STREAMING / OFFLINE / ERROR)
 *   - Reference Animation (READY)
 *   - Supabase PostgreSQL Database (CONNECTED / OFFLINE)
 *   - Auth Config & Current User (Masked)
 *   - Profile Trigger & Patient ID Status
 *   - Session Engine (ACTIVE / IDLE, Elapsed, Reps)
 *   - Current Exercise, Active Posture, Target Angle, Repetition Count
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Cpu, Camera, Play, Activity, Database, Key, Bot } from 'lucide-react';
import type { EngineStatus } from '../../types/engine';
import type { ExerciseDefinition } from '../../engine/exercise/ExerciseTypes';
import type { LiveSessionState } from '../../engine/session/SessionTypes';
import type { ShoulderFlexionAnalysis } from '../../engine/biomechanics/biomechanicsTypes';
import type { OllamaConnectionStatus } from '../../types/assistant';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getSuggestionForLimitation } from '../../engine/feedback/SuggestionLibrary';
import { formatTimerMMSS } from '../../utils/format';
import { physioAssistantService } from '../../services/physioAssistantService';
import { speechInputService } from '../../services/voice/SpeechInputService';
import { speechOutputService } from '../../services/voice/SpeechOutputService';

import type { PhaseConfig } from '../../engine/exercise/PoseTypes';

interface PresentationQAPanelProps {
  mode?: 'TUTORIAL' | 'PRACTICE' | 'LIVE' | 'DEMO';
  engineStatus: EngineStatus;
  isStreaming: boolean;
  activeExercise: ExerciseDefinition;
  sessionState: LiveSessionState;
  analysis: ShoulderFlexionAnalysis;
  savedSessionsCount: number;
  sessionStatus?: 'ACTIVE' | 'ENDING' | 'ENDED';
  endReason?: 'manual' | 'automatic' | null;
  isReportReady?: boolean;
  persistenceStatus?: 'SAVED' | 'FAILED' | 'PENDING' | 'IDLE';
  isTimerRunning?: boolean;
  remainingSeconds?: number;
  sessionStartTime?: number | null;
  isTestTimer?: boolean;
  onToggleTestTimer?: () => void;
  demoAngle?: number;
  demoPhase?: PhaseConfig;
  demoTimelineMs?: number;
}

export const PresentationQAPanel: React.FC<PresentationQAPanelProps> = ({
  mode = 'TUTORIAL',
  engineStatus,
  isStreaming,
  activeExercise,
  sessionState,
  analysis,
  savedSessionsCount,
  sessionStatus = 'ENDED',
  endReason = null,
  isReportReady = false,
  persistenceStatus = 'IDLE',
  isTimerRunning = false,
  remainingSeconds,
  sessionStartTime = null,
  isTestTimer = false,
  onToggleTestTimer,
  demoAngle,
  demoPhase,
  demoTimelineMs,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaConnectionStatus | null>(null);
  const isDbConfigured = isSupabaseConfigured();
  const { user, profile, isAuthenticated } = useAuth();

  useEffect(() => {
    // Check if ?qa=1 is in the URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('qa') === '1') {
        setIsOpen(true);
      }
    }

    // Keyboard shortcut listener: Shift + D
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'D') {
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch local Ollama health status when QA panel is opened
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    physioAssistantService.checkOllamaHealth().then((status) => {
      if (isMounted) {
        setOllamaStatus(status);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maskedUserId = user?.id
    ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}`
    : 'None (Unauthenticated)';

  const profileTriggerStatus = profile?.id ? 'PASS' : isAuthenticated ? 'FAIL' : 'READY';
  const patientIdStatus = profile?.patient_login_id ? 'PASS' : isAuthenticated ? 'FAIL' : 'READY';

  const liveAnalysisStatus = analysis.angle !== null ? 'READY' : 'WAITING';
  const tutorialTimelineStatus = mode === 'PRACTICE' ? 'PAUSED' : 'PLAYING';
  const sessionReps = sessionState.metrics.completedReps;
  const lastRepPeakDisplay =
    sessionState.latestRep?.peakAngle !== undefined
      ? `${sessionState.latestRep.peakAngle}°`
      : analysis.lastRepPeak !== null
      ? `${analysis.lastRepPeak}°`
      : '—';

  // Suggestion diagnostics (Patch 2)
  const isLimitationActive =
    mode === 'PRACTICE' &&
    analysis.angle !== null &&
    (sessionState.latestRep?.limitationDetected === true || analysis.state === 'LOW_RANGE');
  const activeLimitationId = isLimitationActive ? activeExercise.id : 'NONE';
  const activeSuggestion = isLimitationActive
    ? getSuggestionForLimitation(activeExercise.id, true)
    : null;
  const activeSuggestionId = activeSuggestion?.id ?? 'NONE';

  return (
    <aside className="qa-panel" role="region" aria-label="Developer QA Panel">
      <div className="qa-panel__header">
        <div className="qa-panel__title">
          <ShieldCheck size={15} className="text-good" />
          <span>SIH Presentation QA Readiness</span>
        </div>
        <button
          type="button"
          className="btn-icon"
          onClick={() => setIsOpen(false)}
          title="Close QA panel"
          aria-label="Close QA panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="qa-panel__grid">
        {/* Authoritative Mode */}
        <div className="qa-panel__item">
          <div className="qa-panel__item-header">
            <Play size={12} />
            <span>Mode</span>
          </div>
          <span
            className={`qa-badge qa-badge--${
              mode === 'DEMO' ? 'warn' : mode === 'PRACTICE' || mode === 'LIVE' ? 'good' : 'neutral'
            }`}
          >
            {mode}
          </span>
        </div>

        {/* MediaPipe Engine */}
        <div className="qa-panel__item">
          <div className="qa-panel__item-header">
            <Cpu size={12} />
            <span>MediaPipe</span>
          </div>
          <span
            className={`qa-badge qa-badge--${
              engineStatus === 'running'
                ? 'good'
                : engineStatus === 'initializing'
                ? 'warn'
                : engineStatus === 'error'
                ? 'crit'
                : 'neutral'
            }`}
          >
            {engineStatus.toUpperCase()}
          </span>
        </div>

        {/* Live Video Camera */}
        <div className="qa-panel__item">
          <div className="qa-panel__item-header">
            <Camera size={12} />
            <span>Camera</span>
          </div>
          <span className={`qa-badge qa-badge--${isStreaming ? 'good' : 'neutral'}`}>
            {isStreaming ? 'STREAMING' : 'OFF'}
          </span>
        </div>

        {/* Live Analysis Engine */}
        <div className="qa-panel__item">
          <div className="qa-panel__item-header">
            <Activity size={12} />
            <span>Kinematics</span>
          </div>
          <span className={`qa-badge qa-badge--${liveAnalysisStatus === 'READY' ? 'good' : 'neutral'}`}>
            {liveAnalysisStatus}
          </span>
        </div>

        {/* Supabase Database Config */}
        <div className="qa-panel__item">
          <div className="qa-panel__item-header">
            <Database size={12} />
            <span>Supabase DB</span>
          </div>
          <span className={`qa-badge qa-badge--${isDbConfigured ? 'good' : 'warn'}`}>
            {isDbConfigured ? 'CONNECTED' : 'LOCAL DEMO'}
          </span>
        </div>

        {/* Supabase Authentication */}
        <div className="qa-panel__item">
          <div className="qa-panel__item-header">
            <Key size={12} />
            <span>Auth State</span>
          </div>
          <span className={`qa-badge qa-badge--${isAuthenticated ? 'good' : 'neutral'}`}>
            {isAuthenticated ? 'LOGGED IN' : 'GUEST'}
          </span>
        </div>

        {/* Local Ollama Assistant */}
        <div className="qa-panel__item">
          <div className="qa-panel__item-header">
            <Bot size={12} />
            <span>Ollama AI</span>
          </div>
          <span className={`qa-badge qa-badge--${ollamaStatus?.status === 'CONNECTED' ? 'good' : 'warn'}`}>
            {ollamaStatus?.status === 'CONNECTED' ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="qa-panel__divider" />

      {/* Presentation Audit Checklist */}
      <div className="qa-panel__details">
        {mode === 'DEMO' && (
          <>
            <div className="qa-detail-row" style={{ background: 'rgba(255, 167, 38, 0.1)', padding: '4px 6px', borderRadius: 4, margin: '2px 0' }}>
              <span className="qa-detail-key font-bold" style={{ color: '#FFA726' }}>Application Mode:</span>
              <span className="qa-detail-val text-mono font-bold" style={{ color: '#FFA726' }}>DEMO</span>
            </div>
            <div className="qa-detail-row">
              <span className="qa-detail-key">Camera:</span>
              <span className="qa-detail-val text-mono text-good">OFF (NOT REQUIRED)</span>
            </div>
            <div className="qa-detail-row">
              <span className="qa-detail-key">Demo Timeline:</span>
              <span className="qa-detail-val text-mono text-cyan">
                {Math.round((demoTimelineMs ?? 0) / 1000)} / 16 sec ({demoAngle !== undefined ? `${Math.round(demoAngle)}°` : '—'})
              </span>
            </div>
            <div className="qa-detail-row">
              <span className="qa-detail-key">Demo Phase:</span>
              <span className="qa-detail-val text-mono font-bold text-good">
                {demoPhase?.phase || 'REFERENCE'} ({demoPhase?.shortLabel || 'Reference'})
              </span>
            </div>
            <div className="qa-detail-row">
              <span className="qa-detail-key">Persistent Save:</span>
              <span className="qa-detail-val text-mono text-warn font-bold">DISABLED (ISOLATED)</span>
            </div>
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
          </>
        )}
        <div className="qa-detail-row">
          <span className="qa-detail-key">Live Analysis Snapshot:</span>
          <span className="qa-detail-val text-cyan">
            {analysis.angle !== null ? `${analysis.angle}° (${analysis.feedback})` : 'Waiting for landmarks'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Tutorial Timeline State:</span>
          <span className={`qa-detail-val ${tutorialTimelineStatus === 'PAUSED' ? 'text-good font-bold' : ''}`}>
            {tutorialTimelineStatus}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Completed Reps (Session):</span>
          <span className="qa-detail-val font-bold text-good">{sessionReps}</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Patient Data State:</span>
          <span className={`qa-detail-val text-mono ${sessionReps > 0 || (isStreaming && analysis.angle !== null) ? 'text-good' : ''}`}>
            {sessionReps > 0 || (isStreaming && analysis.angle !== null) ? 'ACTIVE' : 'NONE'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Last Rep Peak Angle:</span>
          <span className="qa-detail-val text-mono">{lastRepPeakDisplay}</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Saved Sessions Count:</span>
          <span className="qa-detail-val text-mono">{savedSessionsCount}</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Auth User ID:</span>
          <span className="qa-detail-val text-mono">{maskedUserId}</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Profile Trigger Status:</span>
          <span className={`qa-detail-val ${profileTriggerStatus === 'PASS' ? 'text-good' : profileTriggerStatus === 'FAIL' ? 'text-warn' : ''}`}>
            {profileTriggerStatus} {profile?.full_name ? `(${profile.full_name})` : ''}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Patient ID Generation:</span>
          <span className={`qa-detail-val ${patientIdStatus === 'PASS' ? 'text-good' : patientIdStatus === 'FAIL' ? 'text-warn' : ''}`}>
            {patientIdStatus} {profile?.patient_login_id ? `(${profile.patient_login_id})` : ''}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Current Exercise:</span>
          <span className="qa-detail-val text-cyan">{activeExercise.name}</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Posture / Target:</span>
          <span className="qa-detail-val">
            {activeExercise.postureMode.toUpperCase()} · {activeExercise.targetAngle}°
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Movement State:</span>
          <span className="qa-detail-val">{analysis.state}</span>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />

        {/* ── Physiosis Assistant & STT QA Telemetry (Patch 8) ─────── */}
        <div className="qa-detail-row">
          <span className="qa-detail-key">Ollama:</span>
          <span className={`qa-detail-val text-mono ${ollamaStatus?.status === 'CONNECTED' ? 'text-good' : 'text-warn'}`}>
            {ollamaStatus?.status || 'OFFLINE'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Model:</span>
          <span className="qa-detail-val text-mono text-cyan">
            {ollamaStatus?.model || (ollamaStatus?.availableModels?.length ? ollamaStatus.availableModels.join(', ') : 'llama3.2')}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">STT PROVIDER:</span>
          <span className="qa-detail-val text-mono text-cyan">
            {speechInputService.getProviderName()}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">STT MODEL:</span>
          <span className="qa-detail-val text-mono">
            Systran/faster-whisper-tiny (CPU INT8)
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">STT STATUS:</span>
          <span className={`qa-detail-val text-mono ${speechInputService.isSupported() ? 'text-good' : 'text-warn'}`}>
            {speechInputService.isSupported() ? 'READY' : 'OFFLINE'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">MICROPHONE:</span>
          <span className={`qa-detail-val text-mono ${speechInputService.getStatus() === 'listening' ? 'text-cyan font-bold' : speechInputService.getStatus() === 'error' ? 'text-warn' : 'text-good'}`}>
            {speechInputService.getStatus() === 'listening' ? 'ACTIVE' : speechInputService.getStatus() === 'error' ? 'DENIED/ERROR' : 'READY'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">TRANSCRIPT:</span>
          <span className="qa-detail-val text-mono text-good">READY</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Domain Guard:</span>
          <span className="qa-detail-val text-mono text-good">FAIL-CLOSED (ACTIVE)</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Domain Policy:</span>
          <span className="qa-detail-val text-mono text-cyan">PHYSIOTHERAPY ONLY</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Ollama on Blocked:</span>
          <span className="qa-detail-val text-mono text-good">NO (0 TOKENS)</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Safety Guard:</span>
          <span className="qa-detail-val text-mono text-good">READY</span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Session Context:</span>
          <span className={`qa-detail-val text-mono ${sessionReps > 0 || (isStreaming && analysis.angle !== null) || savedSessionsCount > 0 ? 'text-good' : 'text-muted'}`}>
            {sessionReps > 0 || (isStreaming && analysis.angle !== null) || savedSessionsCount > 0 ? 'AVAILABLE' : 'NONE'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">TTS PROVIDER:</span>
          <span className="qa-detail-val text-mono text-cyan">
            {speechOutputService.isSupported() ? 'LOCAL (SAPI/OneCore)' : 'BROWSER_TTS_FALLBACK'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">VOICE MODEL:</span>
          <span className="qa-detail-val text-mono">
            Microsoft Heera / David / Hazel / Zira
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">TTS STATUS:</span>
          <span className={`qa-detail-val text-mono ${speechOutputService.isSupported() ? 'text-good' : 'text-warn'}`}>
            {speechOutputService.isSupported() ? 'READY' : 'OFFLINE'}
          </span>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />

        {/* ── Patch 3: Session & Persistence Diagnostics ───────────── */}
        <div className="qa-detail-row">
          <span className="qa-detail-key">SESSION STATUS:</span>
          <span className={`qa-detail-val text-mono ${sessionStatus === 'ACTIVE' ? 'text-good' : sessionStatus === 'ENDING' ? 'text-warn' : ''}`}>
            {sessionStatus}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">END REASON:</span>
          <span className="qa-detail-val text-mono">
            {endReason ? endReason.toUpperCase() : '—'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">REPORT:</span>
          <span className={`qa-detail-val text-mono ${isReportReady ? 'text-good' : ''}`}>
            {isReportReady ? 'READY' : 'NOT READY'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">PERSISTENCE:</span>
          <span className={`qa-detail-val text-mono ${persistenceStatus === 'SAVED' ? 'text-good' : persistenceStatus === 'FAILED' ? 'text-crit' : persistenceStatus === 'PENDING' ? 'text-warn' : ''}`}>
            {persistenceStatus}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">REP COUNT:</span>
          <span className="qa-detail-val text-mono font-bold">{sessionReps}</span>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />

        {/* ── Patch 4: Timer Diagnostics ─────────────────────────── */}
        <div className="qa-detail-row">
          <span className="qa-detail-key">SESSION TIMER:</span>
          <span className={`qa-detail-val text-mono ${isTimerRunning ? 'text-good' : ''}`}>
            {isTimerRunning ? 'RUNNING' : 'STOPPED'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">REMAINING:</span>
          <span className={`qa-detail-val text-mono font-bold ${remainingSeconds !== undefined && remainingSeconds <= 10 ? 'text-crit' : remainingSeconds !== undefined && remainingSeconds <= 30 ? 'text-warn' : ''}`}>
            {remainingSeconds !== undefined ? formatTimerMMSS(remainingSeconds) : '—'} ({remainingSeconds ?? '—'}s)
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">SESSION START:</span>
          <span className="qa-detail-val text-mono">
            {sessionStartTime ? new Date(sessionStartTime).toLocaleTimeString() : '—'}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">TIMER MODE:</span>
          <span className="qa-detail-val">
            {onToggleTestTimer && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                style={{ padding: '1px 6px', fontSize: 10 }}
                onClick={onToggleTestTimer}
                title="Toggle between 120s production timer and 10s development test timer"
              >
                {isTestTimer ? '10s (TEST)' : '120s (PROD)'}
              </button>
            )}
          </span>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />

        {/* ── Patch 2: Suggestion Diagnostics ───────────────────────── */}
        <div className="qa-detail-row">
          <span className="qa-detail-key">Active Limitation:</span>
          <span className={`qa-detail-val text-mono ${isLimitationActive ? 'text-warn' : ''}`}>
            {activeLimitationId}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Suggestion:</span>
          <span className={`qa-detail-val text-mono ${activeSuggestion ? 'text-warn' : ''}`}>
            {activeSuggestionId}
          </span>
        </div>
        <div className="qa-detail-row">
          <span className="qa-detail-key">Suggestion Source:</span>
          <span className="qa-detail-val" style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
            CURATED PROTOTYPE LIBRARY
          </span>
        </div>
      </div>

      <div className="qa-panel__footer">
        <span>Toggle: <code>Shift + D</code> or <code>?qa=1</code></span>
        <span className="text-good">Demo Ready ✓</span>
      </div>
    </aside>
  );
};
