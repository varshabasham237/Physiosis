/**
 * angleMath.ts
 * Geometry helpers for biomechanical angle calculations.
 * All functions are pure — safe to call from the high-frequency pose loop.
 *
 * Coordinate system: MediaPipe normalized image space where Y increases downward.
 */

import type { Landmark } from '../../types/pose';
import type { Vec3 } from '../../types/biomechanics';
import { angleBetweenVectors, clamp, vecMag, vecNormalize, vecSub } from '../../utils/math';

/** Convert a MediaPipe landmark to a 3D vector. */
export function landmarkToVec(lm: Landmark): Vec3 {
  return { x: lm.x, y: lm.y, z: lm.z ?? 0 };
}

/** Check whether a landmark meets the minimum visibility threshold. */
export function isLandmarkVisible(lm: Landmark | undefined, minConfidence: number): boolean {
  if (!lm) return false;
  return (lm.visibility ?? 1) >= minConfidence;
}

/**
 * Angle (degrees) between two vectors originating at the same joint.
 * Returns null when either vector is degenerate.
 */
export function angleAtJoint(fromA: Vec3, vertex: Vec3, toB: Vec3): number | null {
  const vA = vecSub(fromA, vertex);
  const vB = vecSub(toB, vertex);
  if (vecMag(vA) < 1e-6 || vecMag(vB) < 1e-6) return null;
  return angleBetweenVectors(vA, vB);
}

/**
 * Elevation of a segment relative to a torso reference axis.
 *
 * Torso axis runs hip → shoulder (upward along the trunk).
 * Segment runs shoulder → distal point (elbow or wrist).
 *
 * Returns 0° when the arm hangs at the side and increases toward 180°
 * as the arm is raised forward/overhead — suitable for shoulder flexion.
 */
export function elevationFromTorso(
  hip: Vec3,
  shoulder: Vec3,
  distal: Vec3
): number | null {
  const torso = vecSub(shoulder, hip);
  const arm = vecSub(distal, shoulder);

  if (vecMag(torso) < 1e-6 || vecMag(arm) < 1e-6) return null;

  const included = angleBetweenVectors(torso, arm);
  return clamp(180 - included, 0, 180);
}

/**
 * Screen-space angle (radians) of a vector for canvas arc drawing.
 * 0 rad = right (+X), π/2 = down (+Y) in image coordinates.
 */
export function screenAngle(vec: Vec3): number {
  return Math.atan2(vec.y, vec.x);
}

/** Normalized 2D screen direction from a landmark pair. */
export function segmentDirection(from: Vec3, to: Vec3): Vec3 | null {
  const dir = vecSub(to, from);
  const mag = vecMag(dir);
  if (mag < 1e-6) return null;
  return vecNormalize(dir);
}
