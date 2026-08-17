/**
 * biomechanics.ts
 * Types for joint angles, body segments, and biomechanics analysis results.
 */

import type { LandmarkIndex } from './pose';

/** A 3D vector. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Identifies a joint by its three constituent landmarks (proximal, joint, distal). */
export interface JointDescriptor {
  proximal: LandmarkIndex;
  joint: LandmarkIndex;
  distal: LandmarkIndex;
  label: string;
}

/** Measured angle at a joint in degrees. */
export interface JointAngle {
  descriptor: JointDescriptor;
  /** Angle in degrees [0, 180]. */
  angleDeg: number;
  /** Whether all three landmarks had sufficient visibility. */
  isValid: boolean;
}

/** A body segment defined by two landmarks. */
export interface BodySegment {
  from: LandmarkIndex;
  to: LandmarkIndex;
  label: string;
}

/** Full biomechanics snapshot for a single frame. */
export interface BiomechanicsResult {
  jointAngles: JointAngle[];
  /** Timestamp matching the source PoseFrame. */
  timestampMs: number;
}
