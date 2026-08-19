/**
 * PoseLibrary.ts
 * Interpolation engine for the reference animation timeline.
 *
 * Given a timeline (array of {timeMs, pose} keyframes) and an elapsed time,
 * returns the correctly eased interpolated pose for that instant.
 *
 * All math is pure — no side effects, no RAF, no React.
 */

import type { ReferencePose, AnimationTimeline } from './PoseTypes';
import { lerp } from '../../utils/math';

// ─── Easing functions ─────────────────────────────────────────────────────────

/** Smooth start and end — S-curve through [0, 1]. */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Slightly faster entry, very smooth end — good for return motion. */
export function easeInOutQuart(t: number): number {
  return t < 0.5
    ? 8 * t * t * t * t
    : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

/** Slow entry, fast exit — good for a natural "lift" initiation. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ─── Pose interpolation ───────────────────────────────────────────────────────

/**
 * Linear interpolation of every degree-of-freedom in a ReferencePose.
 * Each angle field is lerped independently.
 */
export function lerpPose(a: ReferencePose, b: ReferencePose, t: number): ReferencePose {
  return {
    trunkLean:               lerp(a.trunkLean,               b.trunkLean,               t),
    trunkSideFlexion:        lerp(a.trunkSideFlexion,        b.trunkSideFlexion,        t),

    rightShoulderFlexion:    lerp(a.rightShoulderFlexion,    b.rightShoulderFlexion,    t),
    rightShoulderAbduction:  lerp(a.rightShoulderAbduction,  b.rightShoulderAbduction,  t),
    rightElbowFlexion:       lerp(a.rightElbowFlexion,       b.rightElbowFlexion,       t),

    leftShoulderFlexion:     lerp(a.leftShoulderFlexion,     b.leftShoulderFlexion,     t),
    leftShoulderAbduction:   lerp(a.leftShoulderAbduction,   b.leftShoulderAbduction,   t),
    leftElbowFlexion:        lerp(a.leftElbowFlexion,        b.leftElbowFlexion,        t),

    rightHipFlexion:         lerp(a.rightHipFlexion,         b.rightHipFlexion,         t),
    rightKneeFlexion:        lerp(a.rightKneeFlexion,        b.rightKneeFlexion,        t),
    leftHipFlexion:          lerp(a.leftHipFlexion,          b.leftHipFlexion,          t),
    leftKneeFlexion:         lerp(a.leftKneeFlexion,         b.leftKneeFlexion,         t),

    headFlexion:             lerp(a.headFlexion,             b.headFlexion,             t),
    headRotation:            lerp(a.headRotation,            b.headRotation,            t),

    rightShoulderElevation:  lerp(a.rightShoulderElevation,  b.rightShoulderElevation,  t),
    leftShoulderElevation:   lerp(a.leftShoulderElevation,   b.leftShoulderElevation,   t),
  };
}

// ─── Timeline evaluation ──────────────────────────────────────────────────────

/**
 * Compute the interpolated pose at a given elapsed time within a looping timeline.
 *
 * The timeline is treated as a circular buffer: timeMs is first wrapped to
 * [0, durationMs) so the animation loops seamlessly.
 *
 * Between each pair of adjacent keyframes, cubic ease-in-out is applied.
 */
export function getPoseAtTime(
  timeline: AnimationTimeline,
  elapsedMs: number,
): ReferencePose {
  const { keyframes, durationMs } = timeline;
  if (keyframes.length === 0) {
    throw new Error('[PoseLibrary] Timeline has no keyframes.');
  }
  if (keyframes.length === 1) {
    return keyframes[0].pose;
  }

  const t = ((elapsedMs % durationMs) + durationMs) % durationMs;

  // Find the surrounding keyframe pair
  let segIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (t >= keyframes[i].timeMs && t < keyframes[i + 1].timeMs) {
      segIdx = i;
      break;
    }
  }

  const kfA = keyframes[segIdx];
  const kfB = keyframes[segIdx + 1] ?? keyframes[0];

  if (kfA === kfB) return kfA.pose;

  const segDuration = kfB.timeMs - kfA.timeMs;
  if (segDuration <= 0) return kfB.pose;

  const rawT = (t - kfA.timeMs) / segDuration;
  const easedT = easeInOutCubic(rawT);

  return lerpPose(kfA.pose, kfB.pose, easedT);
}
