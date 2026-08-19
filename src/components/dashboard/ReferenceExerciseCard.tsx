/**
 * ReferenceExerciseCard.tsx
 * Shows the currently loaded reference exercise with animated skeleton demonstration.
 *
 * Passes the full live analysis snapshot to ReferenceSkeletonCanvas so that
 * PRACTICE mode can read movement state and feedback from the existing pipeline.
 */

import React from 'react';
import { BookOpen } from 'lucide-react';
import { ExerciseRegistry, getDefaultExercise } from '../../engine/exercise/ExerciseRegistry';
import { ReferenceSkeletonCanvas } from '../skeleton/ReferenceSkeletonCanvas';
import type { ExerciseDefinition } from '../../engine/exercise/ExerciseTypes';
import type { RepResult } from '../../engine/session/SessionTypes';
import type { ShoulderFlexionAnalysis } from '../../engine/biomechanics/biomechanicsTypes';

import type { PhaseConfig } from '../../engine/exercise/PoseTypes';

const DIFFICULTY_LABELS: Record<ExerciseDefinition['difficulty'], string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
};

interface ReferenceExerciseCardProps {
  mode?: 'TUTORIAL' | 'PRACTICE' | 'LIVE' | 'DEMO';
  onStartPractice?: () => void;
  onBackToTutorial?: () => void;
  onExitDemoMode?: () => void;
  exercise?: ExerciseDefinition;
  exerciseId?: string;
  liveAngle?: number | null;
  lastLimitationPeak?: number | null;
  latestRep?: RepResult | null;
  /** Full live analysis — forwarded to practice mode for state + feedback */
  liveAnalysis?: ShoulderFlexionAnalysis | null;
  onDemoFrame?: (angleDeg: number, phaseConfig: PhaseConfig, elapsedMs: number) => void;
}

export const ReferenceExerciseCard: React.FC<ReferenceExerciseCardProps> = ({
  mode = 'TUTORIAL',
  onStartPractice,
  onBackToTutorial,
  onExitDemoMode,
  exercise: propExercise,
  exerciseId,
  liveAngle,
  lastLimitationPeak,
  latestRep,
  liveAnalysis,
  onDemoFrame,
}) => {
  const exercise =
    propExercise ??
    (exerciseId ? ExerciseRegistry.getById(exerciseId) : getDefaultExercise()) ??
    getDefaultExercise();

  const isPractice = mode === 'PRACTICE';
  const isDemo = mode === 'DEMO';

  return (
    <div className="card reference-exercise-card">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="card__header">
        <div className="card__header-left">
          <BookOpen size={16} />
          <div>
            <span className="card__title">
              {isPractice ? 'Live Practice' : isDemo ? 'Demonstration (Demo Mode)' : 'Reference Demonstration'}
            </span>
            {!isPractice && (
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                {isDemo ? 'Deterministic 16s demonstration — not patient data' : 'Reference tutorial — not patient data'}
              </span>
            )}
          </div>
        </div>
        <div className="card__header-right">
          {isPractice ? (
            <span className="live-indicator">
              <span className="live-indicator__dot" />
              LIVE PRACTICE
            </span>
          ) : isDemo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="engine-badge engine-badge--amber" style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                DEMO
              </span>
              <span className={`difficulty-badge difficulty-badge--${exercise.difficulty}`}>
                {DIFFICULTY_LABELS[exercise.difficulty]}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="session-status-badge session-status-badge--idle">TUTORIAL</span>
              <span className={`difficulty-badge difficulty-badge--${exercise.difficulty}`}>
                {DIFFICULTY_LABELS[exercise.difficulty]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Exercise name + brief description ──────────────────────────── */}
      <div className="reference-exercise-card__info">
        <h3 className="reference-exercise-card__name">{exercise.name}</h3>
        <p className="reference-exercise-card__description">{exercise.description}</p>
        <div className="reference-exercise-card__meta">
          <span className="meta-pill">{exercise.side === 'right' ? 'Right Side' : 'Bilateral'}</span>
          <span className="meta-pill">{exercise.plane}</span>
          <span className="meta-pill">Target: {exercise.targetAngle}°</span>
        </div>
      </div>

      {/* ── Animated reference skeleton / Live practice panel ─────────── */}
      <div className="card__divider" />
      <div className="reference-exercise-card__skeleton">
        <ReferenceSkeletonCanvas
          mode={mode}
          onStartPractice={onStartPractice}
          onBackToTutorial={onBackToTutorial}
          onExitDemoMode={onExitDemoMode}
          exercise={exercise}
          liveAngle={liveAngle}
          lastLimitationPeak={lastLimitationPeak}
          latestRep={latestRep}
          liveAnalysis={liveAnalysis}
          onDemoFrame={onDemoFrame}
        />
      </div>
    </div>
  );
};
