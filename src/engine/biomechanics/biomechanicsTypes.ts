/**
 * biomechanicsTypes.ts
 * Shared types for the Physiosis biomechanics engine.
 *
 * Kept separate so movement modules (shoulderFlexion, etc.) and UI
 * components can import only the types they need without circular deps.
 */

// ─── Movement state ───────────────────────────────────────────────────────────

/**
 * State of a tracked movement in the rehabilitation pipeline.
 *
 * WAITING   — required landmarks are not visible or confidence is too low.
 * READY     — person is in the starting position; movement not yet begun.
 * LIFTING   — arm elevation is increasing by a meaningful amount.
 * AT_TARGET — arm has reached the target range.
 * RETURNING — arm is descending after reaching the elevated position.
 * LOW_RANGE — the cycle completed but never reached the required target range.
 */
export type MovementState =
  | 'WAITING'
  | 'READY'
  | 'LIFTING'
  | 'AT_TARGET'
  | 'RETURNING'
  | 'LOW_RANGE';

// ─── Shoulder Flexion ─────────────────────────────────────────────────────────

/**
 * Configuration for the shoulder flexion tracker.
 * Centralised so all thresholds are easy to tune.
 */
export interface ShoulderFlexionConfig {
  /** Target ROM the person is trying to reach (degrees). */
  targetAngle: number;
  /** Angle below which the arm is considered to be at the starting position (degrees). */
  startAngle: number;
  /** Tolerance band around targetAngle for AT_TARGET detection (degrees). */
  tolerance: number;
  /** Minimum landmark visibility score [0–1] required to compute the angle. */
  minimumConfidence: number;
  /** Minimum peak elevation (degrees) required before a rep is counted. */
  minimumRepAmplitude: number;
}

/** Canonical config object — all magic numbers live here. */
export const SHOULDER_FLEXION_CONFIG: ShoulderFlexionConfig = {
  targetAngle: 165,
  startAngle: 20,
  tolerance: 10,
  minimumConfidence: 0.55,
  minimumRepAmplitude: 50,
};

/**
 * Live analysis snapshot published to the UI every ~250 ms.
 *
 * All angle values are in degrees and already smoothed.
 * null means the value could not be computed for this frame.
 *
 * This is NOT a clinical score — it is a prototype movement-quality estimate.
 */
export interface ShoulderFlexionAnalysis {
  /** Smoothed shoulder flexion angle in degrees, or null if unavailable. */
  angle: number | null;
  /** Target angle from config. */
  targetAngle: number;
  /** Remaining degrees to reach target (targetAngle − angle). null when unavailable. */
  deviation: number | null;
  /**
   * (angle / targetAngle) × 100, clamped to [0, 100].
   * Represents estimated range-of-motion completion percentage.
   */
  rangePercentage: number | null;
  /** Current movement state. */
  state: MovementState;
  /**
   * Prototype movement-quality estimate [0–100].
   * Based on proximity to target ROM — not a medical assessment.
   */
  score: number | null;
  /** Number of completed valid repetitions. */
  repCount: number;
  /** Index of the rep currently in progress (0 when idle). */
  currentRep: number;
  /** Peak angle (degrees) reached in the last completed repetition. */
  lastRepPeak: number | null;
  /** Average visibility of the four tracked landmarks [0–100], or null. */
  confidence: number | null;
  /** Advisory feedback string for the UI. */
  feedback: string;
}
