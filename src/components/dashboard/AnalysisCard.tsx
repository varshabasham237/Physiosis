/**
 * AnalysisCard.tsx
 * Right-side panel showing real-time pose tracking telemetry.
 * Displays detection state, tracked key landmarks count, and landmark visibility.
 */

import React from 'react';
import { BarChart2, CheckCircle2, CircleDashed } from 'lucide-react';
import type { PoseTrackingStats } from '../../types/pose';
import type { EngineStatus } from '../../types/engine';

interface AnalysisCardProps {
  engineStatus: EngineStatus;
  isStreaming: boolean;
  stats: PoseTrackingStats;
}

interface JointItem {
  id: string;
  name: string;
  region: 'Upper Body' | 'Lower Body';
}

const REHAB_KEY_JOINTS: JointItem[] = [
  { id: 'shoulders', name: 'Shoulders (L/R)', region: 'Upper Body' },
  { id: 'elbows', name: 'Elbows (L/R)', region: 'Upper Body' },
  { id: 'wrists', name: 'Wrists (L/R)', region: 'Upper Body' },
  { id: 'hips', name: 'Hips (L/R)', region: 'Lower Body' },
  { id: 'knees', name: 'Knees (L/R)', region: 'Lower Body' },
  { id: 'ankles', name: 'Ankles (L/R)', region: 'Lower Body' },
];

export const AnalysisCard: React.FC<AnalysisCardProps> = ({
  engineStatus,
  isStreaming,
  stats,
}) => {
  const isPoseActive = isStreaming && stats.poseDetected;

  return (
    <div className="card analysis-card">
      {/* Header */}
      <div className="card__header">
        <div className="card__header-left">
          <BarChart2 size={16} />
          <span className="card__title">Real-Time Analysis</span>
        </div>
      </div>

      {/* Form score ring / Tracking Status */}
      <div className="analysis-card__score-section">
        <div className="form-score">
          <svg className="form-score__ring" viewBox="0 0 80 80" aria-hidden="true">
            <circle
              className="form-score__ring-track"
              cx="40"
              cy="40"
              r="32"
              strokeWidth="6"
              fill="none"
            />
            <circle
              className={`form-score__ring-fill ${isPoseActive ? 'form-score__ring-fill--active' : ''}`}
              cx="40"
              cy="40"
              r="32"
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={
                isPoseActive
                  ? `${2 * Math.PI * 32 * (1 - stats.confidence / 100)}`
                  : `${2 * Math.PI * 32}`
              }
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
          </svg>
          <div className="form-score__value" aria-label="Pose Confidence">
            <span className="form-score__number">
              {isPoseActive ? `${stats.confidence}` : '—'}
            </span>
            <span className="form-score__unit">
              {isPoseActive ? '% CONF' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <div className="form-score__label">
          {isPoseActive
            ? 'Pose Detected'
            : isStreaming
            ? 'Searching Pose...'
            : engineStatus === 'initializing'
            ? 'Initializing Engine...'
            : 'Engine Inactive'}
        </div>

        <div className="form-score__sub">
          {isPoseActive
            ? `${stats.landmarkCount} key landmarks tracked in real-time`
            : isStreaming
            ? 'Position full body in camera frame'
            : 'Start camera to activate MediaPipe'}
        </div>
      </div>

      {/* Divider */}
      <div className="card__divider" />

      {/* Joint status table */}
      <div className="analysis-card__joints">
        <div className="analysis-card__section-header">
          <span className="analysis-card__section-label">Landmark Tracking State</span>
          <span className="analysis-card__section-badge">
            {isPoseActive ? 'TRACKING' : 'IDLE'}
          </span>
        </div>

        <ul className="joint-list" role="list">
          {REHAB_KEY_JOINTS.map((joint) => (
            <li key={joint.id} className="joint-row">
              <div className="joint-row__left">
                {isPoseActive ? (
                  <CheckCircle2 size={13} className="status-icon status-icon--good" />
                ) : isStreaming ? (
                  <CircleDashed size={13} className="status-icon status-icon--warning spin-slow" />
                ) : (
                  <span className="status-dot status-dot--unknown" aria-hidden="true" />
                )}
                <span className="joint-row__label">{joint.name}</span>
              </div>
              <span className="joint-row__angle">
                {isPoseActive ? 'Locked' : '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Divider */}
      <div className="card__divider" />

      {/* Engine Telemetry */}
      <div className="analysis-card__deviations">
        <p className="analysis-card__section-label">Engine Pipeline</p>
        <div className="engine-telemetry-box">
          <div className="telemetry-item">
            <span className="telemetry-item__key">Mode</span>
            <span className="telemetry-item__val">MediaPipe Pose (Video)</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-item__key">Smoothing</span>
            <span className="telemetry-item__val">EMA (α = 0.40)</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-item__key">Kinematics</span>
            <span className="telemetry-item__val">
              {isPoseActive ? 'Active' : 'Standby'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
