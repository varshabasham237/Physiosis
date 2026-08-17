/**
 * ReferenceExerciseCard.tsx
 * Shows the currently loaded reference exercise definition,
 * its phases, and target joint angle ranges.
 */

import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { ExerciseRegistry } from '../../engine/exercise/ExerciseRegistry';
import type { ExerciseDefinition } from '../../types/exercise';

const BODY_AREA_LABELS: Record<ExerciseDefinition['bodyArea'], string> = {
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  wrist: 'Wrist',
  hip: 'Hip',
  knee: 'Knee',
  ankle: 'Ankle',
  spine: 'Spine',
  'full-body': 'Full Body',
};

const DIFFICULTY_LABELS: Record<ExerciseDefinition['difficulty'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

interface ReferenceExerciseCardProps {
  exerciseId?: string;
}

export const ReferenceExerciseCard: React.FC<ReferenceExerciseCardProps> = ({
  exerciseId = 'shoulder-abduction',
}) => {
  const exercise = ExerciseRegistry.getById(exerciseId);

  if (!exercise) {
    return (
      <div className="card reference-exercise-card">
        <div className="card__header">
          <div className="card__header-left">
            <BookOpen size={16} />
            <span className="card__title">Reference Exercise</span>
          </div>
        </div>
        <p className="reference-exercise-card__empty">Exercise not found.</p>
      </div>
    );
  }

  return (
    <div className="card reference-exercise-card">
      {/* Header */}
      <div className="card__header">
        <div className="card__header-left">
          <BookOpen size={16} />
          <span className="card__title">Reference Exercise</span>
        </div>
        <div className="card__header-right">
          <span className={`difficulty-badge difficulty-badge--${exercise.difficulty}`}>
            {DIFFICULTY_LABELS[exercise.difficulty]}
          </span>
        </div>
      </div>

      {/* Exercise name and meta */}
      <div className="reference-exercise-card__info">
        <h3 className="reference-exercise-card__name">{exercise.name}</h3>
        <p className="reference-exercise-card__description">{exercise.description}</p>

        <div className="reference-exercise-card__meta">
          <span className="meta-pill">{BODY_AREA_LABELS[exercise.bodyArea]}</span>
          <span className="meta-pill">{exercise.defaultSets} × {exercise.defaultReps} reps</span>
        </div>
      </div>

      {/* Phase list */}
      <div className="card__divider" />
      <div className="reference-exercise-card__phases">
        <p className="analysis-card__section-label">Phases</p>
        <ol className="phase-list" role="list">
          {exercise.phases.map((phase, idx) => (
            <li key={phase.id} className="phase-row">
              <span className="phase-row__index">{idx + 1}</span>
              <div className="phase-row__body">
                <span className="phase-row__label">{phase.label}</span>
                {phase.targets.map((t) => (
                  <span key={t.descriptor.label} className="phase-row__target">
                    <ChevronRight size={11} aria-hidden="true" />
                    {t.descriptor.label}: {t.minDeg}° – {t.maxDeg}°
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
