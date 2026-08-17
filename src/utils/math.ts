/**
 * math.ts
 * Low-level vector math utilities used by the biomechanics engine.
 * All functions are pure and have no side effects.
 */

import type { Vec3 } from '../types/biomechanics';

/** Add two vectors. */
export function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** Subtract vector b from vector a. */
export function vecSub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** Dot product of two vectors. */
export function vecDot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Cross product of two vectors. */
export function vecCross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** Magnitude (length) of a vector. */
export function vecMag(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Normalize a vector to unit length. Returns zero vector if magnitude is 0. */
export function vecNormalize(v: Vec3): Vec3 {
  const mag = vecMag(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

/**
 * Calculate the angle (in degrees) between two vectors.
 * Returns 0 if either vector has zero magnitude.
 */
export function angleBetweenVectors(a: Vec3, b: Vec3): number {
  const magA = vecMag(a);
  const magB = vecMag(b);
  if (magA === 0 || magB === 0) return 0;
  const cosTheta = Math.min(1, Math.max(-1, vecDot(a, b) / (magA * magB)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Linear interpolation between a and b by factor t [0, 1]. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}
