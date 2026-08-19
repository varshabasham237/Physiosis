/**
 * ExerciseTypes.ts
 * Type definitions for generic rehabilitation exercises, kinematics calculators,
 * state detectors, and guide generators.
 */

import type { AnimationTimeline, PhaseConfig, Vec2 } from './PoseTypes';
import type { MovementState } from '../biomechanics/biomechanicsTypes';

export type ExerciseId = 'shoulder-flexion' | 'knee-extension' | 'straight-leg-raise';
export type JointHighlight = 'shoulder' | 'knee' | 'hip';
export type PostureMode = 'standing' | 'seated' | 'supine';

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface LiveGuideOverlay {
  start: Vec2;
  end: Vec2;
  mid?: Vec2;
  label: string;
  targetAngle: number;
}

/**
 * Reusable Exercise Definition structure.
 * Allows each exercise to define its own kinematics, states, timelines,
 * reference postures, and live camera overlays.
 */
export interface ExerciseDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  side: 'right' | 'left' | 'bilateral';
  metricName: string;
  plane: string;

  targetAngle: number;
  limitedAngle: number;
  startAngle: number;
  minValidAmplitude: number;

  postureMode: PostureMode;
  highlightJoint: JointHighlight;
  requiredLandmarks: string[];

  timeline: AnimationTimeline;
  demoPhases: PhaseConfig[];

  createPersonalizedTimeline: (patientPeakAngle: number) => AnimationTimeline;

  calculateMetric: (
    landmarks: Landmark3D[],
    rawLandmarks?: Landmark3D[]
  ) => number | null;

  detectState: (
    currentAngle: number | null,
    prevAngle: number | null,
    currentState: MovementState,
    peakAngle: number
  ) => MovementState;

  getFeedback: (
    state: MovementState,
    angle: number | null,
    peakAngle: number | null
  ) => string;

  getLiveGuide?: (
    landmarks: Landmark3D[],
    canvasWidth: number,
    canvasHeight: number
  ) => LiveGuideOverlay | null;
}
