/**
 * ExerciseSelector.tsx
 * Clean, accessible exercise selection component.
 *
 * Allows switching between Shoulder Flexion, Seated Knee Extension, and Straight-Leg Raise.
 */

import React from 'react';
import type { ExerciseDefinition } from '../../engine/exercise/ExerciseTypes';
import { getAllExercises } from '../../engine/exercise/ExerciseRegistry';

interface ExerciseSelectorProps {
  selectedExerciseId: string;
  onSelectExercise: (exerciseId: string) => void;
  disabled?: boolean;
}

export const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({
  selectedExerciseId,
  onSelectExercise,
  disabled = false,
}) => {
  const exercises: ExerciseDefinition[] = getAllExercises();

  return (
    <div className="exercise-selector" role="tablist" aria-label="Rehabilitation Exercise Selector">
      {exercises.map((ex) => {
        const isSelected = ex.id === selectedExerciseId;
        return (
          <button
            key={ex.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={disabled}
            className={`exercise-selector__tab ${isSelected ? 'exercise-selector__tab--active' : ''}`}
            onClick={() => onSelectExercise(ex.id)}
          >
            <div className="exercise-selector__tab-header">
              <span className="exercise-selector__tab-name">{ex.name}</span>
              <span className="exercise-selector__tab-target">{ex.targetAngle}°</span>
            </div>
            <span className="exercise-selector__tab-cat">{ex.category} • {ex.metricName}</span>
          </button>
        );
      })}
    </div>
  );
};
