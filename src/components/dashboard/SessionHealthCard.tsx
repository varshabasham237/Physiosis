/**
 * SessionHealthCard.tsx
 * Displays real-time session health metrics: reps, sets, elapsed time, clean rep rate.
 */

import React from 'react';
import { HeartPulse, Clock, Repeat, Award } from 'lucide-react';
import { formatElapsedTime, formatPercent } from '../../utils/format';
import type { SessionMetrics, SessionState } from '../../types/session';

interface SessionHealthCardProps {
  sessionState: SessionState;
  metrics: SessionMetrics;
}

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}

const MetricTile: React.FC<MetricTileProps> = ({ icon, label, value, sub }) => (
  <div className="metric-tile">
    <div className="metric-tile__icon">{icon}</div>
    <div className="metric-tile__body">
      <span className="metric-tile__value">{value}</span>
      <span className="metric-tile__label">{label}</span>
      {sub && <span className="metric-tile__sub">{sub}</span>}
    </div>
  </div>
);

export const SessionHealthCard: React.FC<SessionHealthCardProps> = ({
  sessionState,
  metrics,
}) => {
  const { status } = sessionState;
  const isIdle = status === 'idle';

  return (
    <div className="card session-health-card">
      {/* Header */}
      <div className="card__header">
        <div className="card__header-left">
          <HeartPulse size={16} />
          <span className="card__title">Session Health</span>
        </div>
        <div className="card__header-right">
          <span className={`session-status-badge session-status-badge--${status}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>

      {/* Metric grid */}
      <div className="session-health-card__grid">
        <MetricTile
          icon={<Clock size={18} />}
          label="Elapsed"
          value={isIdle ? '00:00' : formatElapsedTime(metrics.elapsedMs)}
        />
        <MetricTile
          icon={<Repeat size={18} />}
          label="Reps"
          value={isIdle ? '0' : `${metrics.completedReps}`}
          sub={
            sessionState.config
              ? `of ${sessionState.config.prescribedReps}`
              : undefined
          }
        />
        <MetricTile
          icon={<HeartPulse size={18} />}
          label="Sets"
          value={isIdle ? '0' : `${metrics.completedSets}`}
          sub={
            sessionState.config
              ? `of ${sessionState.config.prescribedSets}`
              : undefined
          }
        />
        <MetricTile
          icon={<Award size={18} />}
          label="Clean Rate"
          value={isIdle ? '—' : formatPercent(metrics.cleanRepRate)}
        />
      </div>

      {/* Start session prompt when idle */}
      {isIdle && (
        <div className="session-health-card__idle-prompt">
          <p>Select an exercise and start a session to begin tracking.</p>
        </div>
      )}
    </div>
  );
};
