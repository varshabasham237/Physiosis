/**
 * ExerciseRegistry.ts
 * Central registry of all supported rehabilitation exercises in Physiosis.
 *
 * Each exercise provides its own biomechanical metrics, reference kinematics,
 * 16-second master timelines, limitation thresholds, and live target guide generators.
 */

import type { ExerciseDefinition } from './ExerciseTypes';
import { shoulderFlexionExercise } from './exercises/shoulderFlexion';
import { kneeExtensionExercise } from './exercises/kneeExtension';
import { straightLegRaiseExercise } from './exercises/straightLegRaise';

const EXERCISE_LIST: ExerciseDefinition[] = [
  shoulderFlexionExercise,
  kneeExtensionExercise,
  straightLegRaiseExercise,
];

const EXERCISE_MAP = new Map<string, ExerciseDefinition>(
  EXERCISE_LIST.map((ex) => [ex.id, ex])
);

export function getAllExercises(): ExerciseDefinition[] {
  return EXERCISE_LIST;
}

export function getExercise(id: string): ExerciseDefinition {
  return EXERCISE_MAP.get(id) ?? shoulderFlexionExercise;
}

export function getDefaultExercise(): ExerciseDefinition {
  return shoulderFlexionExercise;
}

export class ExerciseRegistry {
  static getAll(): ExerciseDefinition[] {
    return EXERCISE_LIST;
  }

  static getById(id: string): ExerciseDefinition | undefined {
    return EXERCISE_MAP.get(id);
  }

  static getDefault(): ExerciseDefinition {
    return shoulderFlexionExercise;
  }
}
