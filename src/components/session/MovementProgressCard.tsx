/**
 * MovementProgressCard.tsx
 * Compact dashboard card displaying the non-clinical Estimated Movement Progress
 * for the selected rehabilitation exercise based on historical session records.
 *
 * Appears only when at least one completed session exists for the active exercise.
 */

import React from 'react';
import { TrendingUp, Award } from 'lucide-react';
import type { PhysiosisSession } from '../../engine/session/SessionTypes';
import { calculateCrossSessionProgress } from '../../engine/session/SessionProgress';
import type { ExerciseDefinition } from '../../engine/exercise/ExerciseTypes';

interface MovementProgressCardProps {
  sessions: PhysiosisSession[];
  activeExercise: ExerciseDefinition;
  onOpenLatestReport?: () => void;
}

export const MovementProgressCard: React.FC<MovementProgressCardProps> = ({
  sessions,
  activeExercise,
  onOpenLatestReport,
}) => {
  const progressResult = calculateCrossSessionProgress(sessions, activeExercise.name);

  if (!progressResult) {
    return null;
  }

  const {
    progressPercentage,
    baselineROM,
    latestROM,
    targetROM,
    deltaDegrees,
    trend,
  } = progressResult;

  return (
    <div className="card movement-progress-card">
      <div className="card__header">
        <div className="card__header-left">
          <TrendingUp size={16} />
          <div>
            <span className="card__title">Movement Progress</span>
            <span className="movement-progress-card__sub">{activeExercise.name}</span>
          </div>
        </div>

        <div className="card__header-right">
          <span className={`trend-badge trend-badge--${trend.toLowerCase()}`}>
            {trend.charAt(0) + trend.slice(1).toLowerCase()}
          </span>
        </div>
      </div>

      <div className="movement-progress-card__body">
        {/* Main Metric Row */}
        <div className="movement-progress-card__hero">
          <div className="movement-progress-card__stat">
            <span className="movement-progress-card__pct">{progressPercentage}%</span>
            <span className="movement-progress-card__pct-label">
              Estimated Movement Progress
            </span>
          </div>

          <div className="movement-progress-card__delta">
            <span className="movement-progress-card__delta-val text-mono">
              {deltaDegrees >= 0 ? `+${deltaDegrees}°` : `${deltaDegrees}°`}
            </span>
            <span className="movement-progress-card__delta-label">
              from baseline
            </span>
          </div>
        </div>

        {/* Horizontal Progress Bar */}
        <div
          className="progress-bar-visual progress-bar-visual--compact"
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-bar-visual__track">
            <div
              className="progress-bar-visual__fill"
              style={{ width: `${progressPercentage}%` }}
            />
            <div
              className="progress-bar-visual__thumb"
              style={{ left: `${progressPercentage}%` }}
            />
          </div>

          <div className="progress-bar-visual__labels">
            <div className="progress-point">
              <span className="progress-point__title">Baseline</span>
              <span className="progress-point__value mono">{baselineROM}°</span>
            </div>
            <div className="progress-point progress-point--center">
              <span className="progress-point__title">Latest</span>
              <span className="progress-point__value mono text-cyan">{latestROM}°</span>
            </div>
            <div className="progress-point progress-point--right">
              <span className="progress-point__title">Target</span>
              <span className="progress-point__value mono text-good">{targetROM}°</span>
            </div>
          </div>
        </div>

        <p className="movement-progress-card__note">
          Prototype trend indicator based on recorded movement range. It is not a clinical recovery prediction.
        </p>

        {onOpenLatestReport && (
          <button
            type="button"
            className="btn btn--secondary btn--full-width movement-progress-card__btn"
            onClick={onOpenLatestReport}
          >
            <Award size={13} />
            <span>View Latest Session Report</span>
          </button>
        )}
      </div>
    </div>
  );
};
