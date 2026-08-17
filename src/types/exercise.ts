/**
 * exercise.ts
 * Types for exercise definitions, phases, and rep tracking.
 */

import type { JointDescriptor } from './biomechanics';

/** A joint angle target range within an exercise phase. */
export interface JointTarget {
  descriptor: JointDescriptor;
  /** Minimum acceptable angle in degrees. */
  minDeg: number;
  /** Maximum acceptable angle in degrees. */
  maxDeg: number;
}

/** A named phase within an exercise (e.g. "Lift", "Hold", "Lower"). */
export interface ExercisePhase {
  id: string;
  label: string;
  /** Joint targets that define completion of this phase. */
  targets: JointTarget[];
  /** Duration hint in milliseconds (optional, for timed holds). */
  durationMs?: number;
}

/** Difficulty rating for an exercise. */
export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** Body area targeted by an exercise. */
export type BodyArea =
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'spine'
  | 'full-body';

/** A fully-described exercise. */
export interface ExerciseDefinition {
  id: string;
  name: string;
  description: string;
  bodyArea: BodyArea;
  difficulty: ExerciseDifficulty;
  phases: ExercisePhase[];
  /** Default number of reps prescribed. */
  defaultReps: number;
  /** Default number of sets prescribed. */
  defaultSets: number;
  /** Thumbnail identifier (used for future asset loading). */
  thumbnailKey?: string;
}

/** State of a single completed rep. */
export interface RepRecord {
  repIndex: number;
  durationMs: number;
  /** Whether the rep was completed within acceptable deviation thresholds. */
  wasClean: boolean;
  timestampMs: number;
}

/** Phase state machine status. */
export type PhaseStatus = 'idle' | 'active' | 'complete';
