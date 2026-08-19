/**
 * AnalysisCard.tsx
 * Right-side panel: real-time patient movement analysis.
 *
 * Displays live angle measurements, comparison with reference target,
 * state machine progress, completed rep analytics, and non-diagnostic feedback.
 */

import React from 'react';
import { BarChart2, Activity, Lightbulb } from 'lucide-react';
import type { PoseTrackingStats } from '../../types/pose';
import type { EngineStatus } from '../../types/engine';
import type { ShoulderFlexionAnalysis, MovementState } from '../../engine/biomechanics/biomechanicsTypes';
import type { LiveSessionState } from '../../engine/session/SessionTypes';
import type { ExerciseDefinition } from '../../engine/exercise/ExerciseTypes';
import { getDefaultExercise } from '../../engine/exercise/ExerciseRegistry';
import { getSuggestionForLimitation, SUGGESTION_DISCLAIMER } from '../../engine/feedback/SuggestionLibrary';

import type { PhaseConfig } from '../../engine/exercise/PoseTypes';

interface AnalysisCardProps {
  exercise?: ExerciseDefinition;
  mode?: 'TUTORIAL' | 'PRACTICE' | 'LIVE' | 'DEMO';
  engineStatus: EngineStatus;
  isStreaming: boolean;
  stats: PoseTrackingStats;
  shoulderFlexion: ShoulderFlexionAnalysis;
  sessionState?: LiveSessionState;
  demoAngle?: number;
  demoPhase?: PhaseConfig;
  demoTimelineMs?: number;
}

const STATE_LABELS: Record<MovementState, string> = {
  WAITING:   'Waiting for landmarks',
  READY:     'Ready',
  LIFTING:   'In motion',
  AT_TARGET: 'Target reached',
  RETURNING: 'Returning',
  LOW_RANGE: 'Limited range detected',
};

const STATE_COLOUR: Record<MovementState, string> = {
  WAITING:   'var(--text-disabled)',
  READY:     'var(--accent-cyan)',
  LIFTING:   'var(--accent-blue)',
  AT_TARGET: 'var(--color-good)',
  RETURNING: 'var(--accent-cyan)',
  LOW_RANGE: 'var(--color-warn)',
};

function scoreColour(score: number): string {
  if (score >= 75) return 'var(--color-good)';
  if (score >= 45) return 'var(--color-warn)';
  return 'var(--color-crit)';
}

function feedbackBorderColour(state: MovementState, isLimitation: boolean): string {
  if (isLimitation) return 'var(--color-warn)';
  switch (state) {
    case 'AT_TARGET': return 'var(--color-good)';
    case 'LIFTING':   return 'var(--accent-blue)';
    case 'RETURNING': return 'var(--accent-cyan)';
    case 'LOW_RANGE': return 'var(--color-warn)';
    case 'WAITING':   return 'var(--border-default)';
    default:          return 'var(--accent-cyan)';
  }
}

interface MetricRowProps {
  label: string;
  value: string;
  valueColour?: string;
  mono?: boolean;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, valueColour, mono }) => (
  <div className="sf-metric-row">
    <span className="sf-metric-row__label">{label}</span>
    <span
      className={`sf-metric-row__value${mono !== false ? ' sf-metric-row__value--mono' : ''}`}
      style={valueColour ? { color: valueColour } : undefined}
    >
      {value}
    </span>
  </div>
);

export const AnalysisCard: React.FC<AnalysisCardProps> = ({
  exercise = getDefaultExercise(),
  mode = 'TUTORIAL',
  engineStatus,
  isStreaming,
  stats: _stats,
  shoulderFlexion,
  sessionState,
  demoAngle,
  demoPhase,
  demoTimelineMs: _demoTimelineMs,
}) => {
  const isDemo = mode === 'DEMO';

  // ── DEMO MODE DERIVATIONS ──────────────────────────────────────────────────
  const currentDemoAngle = demoAngle !== undefined ? Math.round(demoAngle) : exercise.startAngle;
  const demoTarget = exercise.targetAngle;
  const demoRomPct = Math.min(100, Math.max(0, Math.round((currentDemoAngle / demoTarget) * 100)));
  const demoDeviation = Math.max(0, demoTarget - currentDemoAngle);
  const phaseType = demoPhase?.phase || 'REFERENCE';

  let demoScore = 95;
  let demoStateLabel = 'Reference Form';
  let demoStateColour = 'var(--color-good)';
  let demoFeedback = demoPhase?.caption || `Reference range of motion (${demoTarget}°) demonstration.`;

  if (phaseType === 'LIMITATION') {
    demoScore = 42;
    demoStateLabel = 'Detected Limitation';
    demoStateColour = '#FFA726';
    demoFeedback = `Detected limitation: Demonstration peak restricted to ${exercise.limitedAngle}° vs reference ${demoTarget}°.`;
  } else if (phaseType === 'CORRECTION') {
    demoScore = Math.min(95, Math.round(60 + (demoRomPct * 0.35)));
    demoStateLabel = 'Guided Correction';
    demoStateColour = 'var(--accent-cyan)';
    demoFeedback = `Guided correction: Advancing from ${exercise.limitedAngle}° toward target ${demoTarget}°.`;
  } else if (phaseType === 'IMPROVED') {
    demoScore = 98;
    demoStateLabel = 'Target Range Reached';
    demoStateColour = 'var(--color-good)';
    demoFeedback = `Target range reached (${demoTarget}°). Demonstration completed successfully.`;
  }

  // ── LIVE MODE DERIVATIONS ──────────────────────────────────────────────────
  const hasValidAnalysis = isStreaming && shoulderFlexion.angle !== null && !isDemo;
  const formScore        = isDemo ? demoScore : (shoulderFlexion.score ?? 0);
  const showScore        = isDemo || (hasValidAnalysis && shoulderFlexion.score !== null);

  const romPct = isDemo ? demoRomPct : (hasValidAnalysis ? shoulderFlexion.rangePercentage : null);
  const stateLabel  = isDemo ? demoStateLabel : STATE_LABELS[shoulderFlexion.state];
  const stateColour = isDemo ? demoStateColour : STATE_COLOUR[shoulderFlexion.state];

  const latestRep = sessionState?.latestRep;
  const isLastRepLimited = latestRep?.limitationDetected ?? false;
  const repCount = isStreaming ? (sessionState?.metrics.completedReps ?? shoulderFlexion.repCount) : 0;
  const currentRepNumber = isStreaming ? (sessionState?.currentRepNumber ?? shoulderFlexion.currentRep) : 0;
  const lastRepPeak = isStreaming ? (sessionState?.latestRep?.peakAngle ?? shoulderFlexion.lastRepPeak) : null;

  // Active limitation: either the last completed rep was limited, or we're currently in LOW_RANGE
  const isLimitationActive =
    mode === 'PRACTICE' &&
    hasValidAnalysis &&
    (isLastRepLimited || shoulderFlexion.state === 'LOW_RANGE');

  // Advisory suggestion — only when limitation is active in Practice mode
  const activeSuggestion = isLimitationActive
    ? getSuggestionForLimitation(exercise.id, true)
    : null;

  // Resolve dynamic advisory feedback based on mode and authoritative state
  let displayFeedback = shoulderFlexion.feedback;
  if (isDemo) {
    displayFeedback = demoFeedback;
  } else if (!isStreaming) {
    displayFeedback = 'Start camera or select an exercise to begin real-time biomechanics tracking.';
  } else if (!hasValidAnalysis) {
    displayFeedback = 'Move into view so the required landmarks are visible.';
  } else if (mode === 'PRACTICE') {
    if (shoulderFlexion.state === 'AT_TARGET' || (shoulderFlexion.deviation !== null && shoulderFlexion.deviation <= 10)) {
      displayFeedback = 'Nice, hold this position.';
    } else if (shoulderFlexion.deviation !== null && shoulderFlexion.deviation <= 20) {
      displayFeedback = 'Approaching the reference range.';
    } else {
      const jointName =
        exercise.highlightJoint === 'shoulder'
          ? 'shoulder elevation'
          : exercise.highlightJoint === 'knee'
          ? 'knee extension'
          : 'leg elevation';
      displayFeedback = `Increase ${jointName} toward the reference range (${exercise.targetAngle}°).`;
    }
  } else {
    if (shoulderFlexion.state === 'READY' || shoulderFlexion.state === 'WAITING') {
      if (latestRep) {
        if (latestRep.limitationDetected) {
          displayFeedback = `Detected limitation: Peak measured at ${latestRep.peakAngle}° vs reference ${exercise.targetAngle}°. Range of motion below reference.`;
        } else {
          displayFeedback = `Target range reached (${latestRep.peakAngle}°). Excellent repetition!`;
        }
      }
    }
  }

  return (
    <div className="card analysis-card">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="card__header">
        <div className="card__header-left">
          <BarChart2 size={16} />
          <span className="card__title">{isDemo ? 'Demo Analysis' : 'Real-Time Analysis'}</span>
        </div>
        <div className="card__header-right">
          <span
            className="analysis-card__live-badge"
            style={{
              background: isDemo ? 'rgba(255, 167, 38, 0.15)' : hasValidAnalysis ? 'var(--color-good-dim)' : 'var(--bg-overlay)',
              color: isDemo ? '#FFA726' : hasValidAnalysis ? 'var(--color-good)' : 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            {isDemo ? 'DEMO ANALYSIS' : hasValidAnalysis ? 'LIVE' : isStreaming ? 'WAITING FOR LANDMARKS' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* ── Movement Quality Ring ───────────────────────────────────────── */}
      <div className="analysis-card__score-section">
        <div className="form-score">
          <svg className="form-score__ring" viewBox="0 0 80 80" aria-hidden="true">
            <circle
              className="form-score__ring-track"
              cx="40" cy="40" r="32"
              strokeWidth="6" fill="none"
            />
            <circle
              className={`form-score__ring-fill${showScore ? ' form-score__ring-fill--active' : ''}`}
              cx="40" cy="40" r="32"
              strokeWidth="6" fill="none"
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={
                showScore
                  ? `${2 * Math.PI * 32 * (1 - formScore / 100)}`
                  : `${2 * Math.PI * 32}`
              }
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ stroke: showScore ? (isDemo && phaseType === 'LIMITATION' ? '#FFA726' : scoreColour(formScore)) : undefined }}
            />
          </svg>
          <div className="form-score__value" aria-label="Movement Quality Score">
            <span className="form-score__number">
              {showScore ? `${formScore}` : '—'}
            </span>
            <span className="form-score__unit">
              {showScore ? '/ 100' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <div className="form-score__label">Movement Quality</div>
        <div className="form-score__quality-tag">{isDemo ? 'Demonstration data' : 'Advisory movement estimate'}</div>

        <div className="form-score__sub" style={{ color: isDemo ? stateColour : hasValidAnalysis ? stateColour : 'var(--text-disabled)' }}>
          {isDemo
            ? `Demonstration estimate · ${stateLabel}`
            : hasValidAnalysis
            ? stateLabel
            : isStreaming
            ? 'Waiting for landmarks'
            : engineStatus === 'initializing'
            ? 'Initializing engine…'
            : 'STANDBY / NO DATA'}
        </div>
      </div>

      <div className="card__divider" />

      {/* ── Actual vs Reference Metrics ─────────────────────────────────── */}
      <div className="analysis-card__flexion">
        <div className="analysis-card__section-header">
          <span className="analysis-card__section-label">
            <Activity size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
            {exercise.name} · {exercise.side === 'right' ? 'Right' : 'Bilateral'}
          </span>
        </div>

        {/* ROM progress bar */}
        <div
          className="sf-rom-bar"
          role="progressbar"
          aria-valuenow={romPct ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Range-of-motion completion"
        >
          <div
            className="sf-rom-bar__fill"
            style={{
              width: `${romPct ?? 0}%`,
              background: isDemo && phaseType === 'LIMITATION' ? '#FFA726' : showScore ? scoreColour(formScore) : 'var(--accent-cyan)',
            }}
          />
          {(hasValidAnalysis || isDemo) && <span className="sf-rom-bar__label">{romPct ?? 0}%</span>}
        </div>

        {/* Actual vs Target Metrics grid */}
        <div className="sf-metrics">
          <MetricRow
            label={isDemo ? 'Demo Angle' : 'Actual ROM'}
            value={isDemo ? `${currentDemoAngle}°` : hasValidAnalysis ? `${shoulderFlexion.angle}°` : '—'}
            valueColour={isDemo ? 'var(--accent-cyan)' : hasValidAnalysis ? 'var(--accent-cyan)' : undefined}
          />
          <MetricRow
            label="Target ROM"
            value={`${exercise.targetAngle}°`}
            valueColour="var(--text-muted)"
          />
          <MetricRow
            label="ROM Completion"
            value={(hasValidAnalysis || isDemo) && romPct !== null ? `${romPct}%` : '—'}
            valueColour={
              (hasValidAnalysis || isDemo) && romPct !== null
                ? romPct >= 85
                  ? 'var(--color-good)'
                  : romPct >= 60
                  ? 'var(--color-warn)'
                  : 'var(--color-crit)'
                : undefined
            }
          />
          <MetricRow
            label="Deviation"
            value={
              isDemo
                ? demoDeviation === 0
                  ? '0° ✓'
                  : `${demoDeviation}° remaining`
                : hasValidAnalysis && shoulderFlexion.deviation !== null
                ? shoulderFlexion.deviation === 0
                  ? '0° ✓'
                  : `${shoulderFlexion.deviation}° remaining`
                : '—'
            }
          />

          <div className="sf-divider-mini" />

          <MetricRow
            label="Movement State"
            value={isDemo ? demoStateLabel : hasValidAnalysis ? stateLabel : '—'}
            valueColour={isDemo ? demoStateColour : hasValidAnalysis ? stateColour : undefined}
            mono={false}
          />
          <MetricRow
            label="Repetitions"
            value={
              isDemo
                ? 'Demonstration (Looping)'
                : isStreaming && currentRepNumber > 0
                ? `${repCount} (in progress)`
                : `${repCount}`
            }
          />
          {hasValidAnalysis && !isDemo && lastRepPeak !== null && (
            <MetricRow
              label="Last Rep Peak"
              value={`${lastRepPeak}°`}
              valueColour={isLastRepLimited ? 'var(--color-warn)' : 'var(--color-good)'}
            />
          )}
        </div>

        {/* Advisory feedback banner */}
        <p
          className="flexion-feedback"
          role="status"
          aria-live="polite"
          style={{ borderLeftColor: isDemo ? demoStateColour : feedbackBorderColour(shoulderFlexion.state, isLastRepLimited) }}
        >
          {displayFeedback}
        </p>

        {/* Advisory Suggestion — shown in Practice mode or Demo limitation */}
        {activeSuggestion && (
          <div className="analysis-card__suggestion" role="complementary" aria-label="Advisory suggestion">
            <div className="analysis-card__suggestion-header">
              <Lightbulb size={11} className="analysis-card__suggestion-icon" />
              <span className="analysis-card__suggestion-label">Advisory Suggestion</span>
            </div>
            <p className="analysis-card__suggestion-name">{activeSuggestion.name}</p>
            <p className="analysis-card__suggestion-guidance">{activeSuggestion.shortGuidance}</p>
            <p className="analysis-card__suggestion-disclaimer">{SUGGESTION_DISCLAIMER}</p>
          </div>
        )}
      </div>

      <div className="card__divider" />

      {/* ── Engine Telemetry & Advisory Notice ─────────────────────────── */}
      <div className="analysis-card__deviations">
        <p className="analysis-card__section-label">{isDemo ? 'Demo Mode Pipeline' : 'Engine Pipeline'}</p>
        <div className="engine-telemetry-box">
          <div className="telemetry-item">
            <span className="telemetry-item__key">Exercise</span>
            <span className="telemetry-item__val">{exercise.name}</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-item__key">Kinematics</span>
            <span className="telemetry-item__val">
              {isDemo ? `${exercise.metricName} · Demonstration` : hasValidAnalysis ? `${exercise.metricName} · Active` : 'Standby'}
            </span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-item__key">Source</span>
            <span className="telemetry-item__val">
              {isDemo ? 'Deterministic Timeline' : shoulderFlexion.confidence !== null ? `${shoulderFlexion.confidence}% Confidence` : '—'}
            </span>
          </div>
        </div>
        <p className="analysis-card__disclaimer">
          {isDemo
            ? 'Demonstration data only. Not real patient telemetry.'
            : 'Advisory movement analysis only. Does not replace a licensed physiotherapist.'}
        </p>
      </div>
    </div>
  );
};
