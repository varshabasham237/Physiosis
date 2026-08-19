/**
 * SessionHealthCard.tsx
 * Displays live session movement metrics, repetition history,
 * rep-level trend chart (ROM & Severity), and End Session control.
 *
 * All terminology is strictly non-diagnostic and advisory.
 */

import React from 'react';
import { Activity, Clock, Repeat, Award, AlertTriangle, TrendingUp, Square, Compass } from 'lucide-react';
import { formatElapsedTime } from '../../utils/format';
import type { LiveSessionState } from '../../engine/session/SessionTypes';
import type { ExerciseDefinition } from '../../engine/exercise/ExerciseTypes';
import { getDefaultExercise } from '../../engine/exercise/ExerciseRegistry';
import { RepTrendChart } from '../session/RepTrendChart';

interface SessionHealthCardProps {
  mode?: 'TUTORIAL' | 'PRACTICE' | 'LIVE' | 'DEMO';
  activeExercise?: ExerciseDefinition;
  sessionState: LiveSessionState;
  currentAngle?: number | null;
  onEndSession?: (reason?: 'manual' | 'automatic') => void;
}

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

const MetricTile: React.FC<MetricTileProps> = ({ icon, label, value, sub, highlight }) => (
  <div className={`metric-tile ${highlight ? 'metric-tile--highlight' : ''}`}>
    <div className="metric-tile__icon">{icon}</div>
    <div className="metric-tile__body">
      <span className="metric-tile__value">{value}</span>
      <span className="metric-tile__label">{label}</span>
      {sub && <span className="metric-tile__sub">{sub}</span>}
    </div>
  </div>
);

function getSeverityCategory(severity: number): string {
  if (severity <= 15) return 'Low';
  if (severity <= 40) return 'Moderate';
  return 'High';
}

export const SessionHealthCard: React.FC<SessionHealthCardProps> = ({
  mode = 'TUTORIAL',
  activeExercise = getDefaultExercise(),
  sessionState,
  currentAngle,
  onEndSession,
}) => {
  const isDemo = mode === 'DEMO';
  const { isActive, metrics, repHistory } = sessionState;
  const recentReps = repHistory.slice(-3).reverse();
  const severityCategory = getSeverityCategory(metrics.currentSeverity);
  const targetAngle = activeExercise.targetAngle;

  return (
    <div className="card session-health-card">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="card__header">
        <div className="card__header-left">
          <Activity size={16} />
          <div>
            <span className="card__title">Session Health</span>
            <span className="recovery-trend-card__sub">
              {isDemo ? 'Demonstration mode — Non-persistent' : `${activeExercise.name} metrics`}
            </span>
          </div>
        </div>
        <div className="card__header-right">
          {isActive && onEndSession && !isDemo && (
            <button
              type="button"
              className="btn-end-session"
              onClick={() => onEndSession('manual')}
              title="End active session and generate summary report"
            >
              <Square size={11} fill="currentColor" />
              <span>End Session</span>
            </button>
          )}
          {isDemo ? (
            <span className="engine-badge engine-badge--amber" style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
              DEMO
            </span>
          ) : (
            <span className={`session-status-badge session-status-badge--${isActive ? 'running' : 'idle'}`}>
              {isActive ? 'Active' : 'Standby'}
            </span>
          )}
        </div>
      </div>

      {/* ── Metric Grid (Explicit & Consistent Breakdown) ────────────────── */}
      <div className="session-health-card__grid">
        <MetricTile
          icon={<Clock size={16} />}
          label="Elapsed"
          value={isActive ? formatElapsedTime(metrics.elapsedMs) : '00:00'}
        />
        <MetricTile
          icon={<Repeat size={16} />}
          label="Repetitions"
          value={isActive ? `${metrics.completedReps}` : '0'}
          sub={isActive && sessionState.currentRepNumber > 0 ? `Rep ${sessionState.currentRepNumber} in progress` : undefined}
        />
        <MetricTile
          icon={<Award size={16} />}
          label="Best ROM"
          value={isActive && metrics.bestROM > 0 ? `${metrics.bestROM}°` : '—'}
          sub={`Target: ${targetAngle}°`}
        />
        <MetricTile
          icon={<Compass size={16} />}
          label="Current ROM"
          value={isActive && currentAngle !== null && currentAngle !== undefined ? `${currentAngle}°` : '—'}
          sub={isActive ? 'Live angle' : 'Standby'}
        />
        <MetricTile
          icon={<Activity size={16} />}
          label="Last Rep Peak"
          value={isActive && sessionState.latestRep ? `${sessionState.latestRep.peakAngle}°` : '—'}
          sub={
            isActive && sessionState.latestRep?.limitationDetected
              ? 'Below reference'
              : isActive && sessionState.latestRep
              ? 'Target achieved'
              : undefined
          }
        />
        <MetricTile
          icon={<Activity size={16} />}
          label="Average ROM"
          value={isActive && metrics.averageROM > 0 ? `${metrics.averageROM}°` : '—'}
          sub="Session average"
        />
        <MetricTile
          icon={<AlertTriangle size={16} />}
          label="Limitations"
          value={isActive ? `${metrics.limitationsCount}` : '0'}
          sub={isActive && metrics.limitationsCount > 0 ? 'Below reference' : 'None'}
        />
        <MetricTile
          icon={<TrendingUp size={16} />}
          label="Severity"
          value={isActive && metrics.completedReps > 0 ? `${severityCategory} (${metrics.currentSeverity})` : '—'}
          sub="Movement delta"
        />
      </div>

      {/* ── Rep-Level Trend Line Chart ──────────────────────────────────── */}
      {repHistory.length > 0 && (
        <div className="session-health-card__chart-section">
          <RepTrendChart reps={repHistory} targetAngle={targetAngle} />
        </div>
      )}

      {/* ── Improvement Trend Banner ─────────────────────────────────────── */}
      {metrics.trendFeedback && (
        <div className="session-health-card__trend">
          <TrendingUp size={13} style={{ color: 'var(--color-good)', flexShrink: 0 }} />
          <span>{metrics.trendFeedback}</span>
        </div>
      )}

      {/* ── Recent Repetitions History List ─────────────────────────────── */}
      {recentReps.length > 0 && (
        <div className="session-health-card__history">
          <span className="analysis-card__section-label">Recent Repetitions</span>
          <div className="session-rep-list">
            {recentReps.map((r) => (
              <div key={r.repNumber} className="session-rep-row">
                <span className="session-rep-row__name">Rep {r.repNumber}</span>
                <span className="session-rep-row__angle">{r.peakAngle}°</span>
                <span className={`session-rep-tag session-rep-tag--${r.statusLabel.toLowerCase().replace(' ', '-')}`}>
                  {r.statusLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Idle / Helper prompt ────────────────────────────────────────── */}
      {metrics.completedReps === 0 && (
        <div className="session-health-card__idle-prompt">
          <p>Start camera and perform repetitions to track live metrics and rep trends.</p>
        </div>
      )}

      {/* ── Non-Diagnostic Disclaimer ───────────────────────────────────── */}
      <div className="session-health-card__disclaimer">
        Physiosis provides advisory movement analysis and does not replace assessment by a licensed physiotherapist.
      </div>
    </div>
  );
};
