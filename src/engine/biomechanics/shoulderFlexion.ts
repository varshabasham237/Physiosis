/**
 * shoulderFlexion.ts
 * Biomechanics module for right-shoulder flexion measurement.
 *
 * Responsibilities:
 *   - calculateShoulderFlexion()  pure geometric calculation
 *   - ShoulderFlexionTracker      stateful engine (angle smoothing, state machine, rep detection)
 *
 * Design rules:
 *   - No React imports or state in this file.
 *   - All mutable per-frame state lives in ShoulderFlexionTracker.
 *   - React receives only throttled ShoulderFlexionAnalysis snapshots.
 *
 * Coordinate system: MediaPipe normalised image space — Y increases downward.
 */

import { LandmarkIndex, type Landmark } from '../../types/pose';
import { clamp, lerp } from '../../utils/math';
import { elevationFromTorso, isLandmarkVisible, landmarkToVec } from './angleMath';
import {
  SHOULDER_FLEXION_CONFIG,
  type MovementState,
  type ShoulderFlexionAnalysis,
} from './biomechanicsTypes';

// Re-export so callers that previously imported from here still compile.
export type { MovementState, ShoulderFlexionAnalysis };
export { SHOULDER_FLEXION_CONFIG };

// ─── Internal constants ───────────────────────────────────────────────────────

/** EMA alpha applied to the raw per-frame angle (higher = more responsive). */
const ANGLE_SMOOTH_ALPHA = 0.32;

/**
 * Hysteresis band: the angle must drop at least this many degrees below the
 * peak before the tracker considers the movement to have reversed direction.
 */
const DESCENT_HYSTERESIS = 12;

/** Internal rep-detection phase. */
type RepPhase = 'idle' | 'ascending' | 'descending';

// ─── Seed analysis (used before any landmarks arrive) ────────────────────────

const WAITING_ANALYSIS: ShoulderFlexionAnalysis = {
  angle: null,
  targetAngle: SHOULDER_FLEXION_CONFIG.targetAngle,
  deviation: null,
  rangePercentage: null,
  state: 'WAITING',
  score: null,
  repCount: 0,
  currentRep: 0,
  lastRepPeak: null,
  confidence: null,
  feedback: 'Move into view so your right shoulder, elbow, wrist and hip are visible.',
};

// ─── Pure functions ───────────────────────────────────────────────────────────

/**
 * Calculate right-shoulder flexion angle (degrees) from smoothed landmarks.
 *
 * Formula:
 *   torso = shoulder − hip        (vector along the trunk, pointing upward)
 *   arm   = wrist − shoulder      (vector along the upper limb)
 *   included = angle(torso, arm)  (0° when arm and torso are parallel)
 *   flexion  = clamp(180 − included, 0, 180)
 *
 * This gives ≈ 0° when the arm hangs at the side and approaches 180° when
 * raised overhead — appropriate for shoulder flexion in a sagittal plane.
 *
 * The elbow is used as a fallback distal point when the wrist landmark has
 * low confidence (e.g. hand behind back).
 *
 * Returns null when any required landmark is below minimumConfidence.
 */
export function calculateShoulderFlexion(landmarks: Landmark[]): number | null {
  const { minimumConfidence } = SHOULDER_FLEXION_CONFIG;

  const shoulder = landmarks[LandmarkIndex.RIGHT_SHOULDER];
  const elbow    = landmarks[LandmarkIndex.RIGHT_ELBOW];
  const wrist    = landmarks[LandmarkIndex.RIGHT_WRIST];
  const hip      = landmarks[LandmarkIndex.RIGHT_HIP];

  // Shoulder and hip are mandatory — they define the torso reference axis.
  if (
    !isLandmarkVisible(shoulder, minimumConfidence) ||
    !isLandmarkVisible(hip,      minimumConfidence)
  ) {
    return null;
  }

  const hipVec      = landmarkToVec(hip!);
  const shoulderVec = landmarkToVec(shoulder!);

  // Prefer the wrist (full arm vector); fall back to elbow.
  const wristVisible = isLandmarkVisible(wrist, minimumConfidence);
  const elbowVisible = isLandmarkVisible(elbow, minimumConfidence);

  if (!wristVisible && !elbowVisible) return null;

  const distalVec = wristVisible
    ? landmarkToVec(wrist!)
    : landmarkToVec(elbow!);

  return elevationFromTorso(hipVec, shoulderVec, distalVec);
}

/** Average visibility of the four tracked landmarks, or null if none visible. */
function computeConfidence(landmarks: Landmark[]): number | null {
  const { minimumConfidence } = SHOULDER_FLEXION_CONFIG;
  const indices = [
    LandmarkIndex.RIGHT_SHOULDER,
    LandmarkIndex.RIGHT_ELBOW,
    LandmarkIndex.RIGHT_WRIST,
    LandmarkIndex.RIGHT_HIP,
  ];
  const visible = indices.filter(i => isLandmarkVisible(landmarks[i], minimumConfidence));
  if (visible.length === 0) return null;
  const sum = visible.reduce((acc, i) => acc + (landmarks[i]?.visibility ?? 1), 0);
  return sum / visible.length;
}

/**
 * Prototype movement-quality score [0–100] based on proximity to the target ROM.
 * NOT a medical or clinical score.
 *
 * Uses a squared curve so scores drop quickly when far from target and
 * rise quickly when close — making the UI feel responsive.
 */
export function computeFlexionScore(angle: number): number {
  const { targetAngle } = SHOULDER_FLEXION_CONFIG;
  const ratio = clamp(angle / targetAngle, 0, 1);
  // Square root curve: generous at the bottom, strict at the top.
  return Math.round(Math.sqrt(ratio) * 100);
}

/** Resolve feedback text for the current movement state and angle. */
function resolveFeedback(state: MovementState, angle: number | null): string {
  const { targetAngle, tolerance } = SHOULDER_FLEXION_CONFIG;
  switch (state) {
    case 'WAITING':
      return 'Move into view so your right shoulder, elbow, wrist and hip are visible.';
    case 'READY':
      return 'Starting position detected. Begin lifting your arm forward.';
    case 'LIFTING': {
      if (angle !== null && angle >= targetAngle - tolerance - 20) {
        return 'Approaching target range.';
      }
      return 'Continue lifting toward the target range.';
    }
    case 'AT_TARGET':
      return 'Target range reached.';
    case 'RETURNING':
      return 'Controlled return.';
    case 'LOW_RANGE':
      return 'Detected limited range of motion. Try reaching a bit higher next time.';
    default:
      return '';
  }
}

// ─── Stateful tracker ────────────────────────────────────────────────────────

/**
 * ShoulderFlexionTracker
 *
 * Mutable engine object updated on every pose frame.
 * React only receives throttled snapshots — never per-frame state.
 *
 * State machine:
 *
 *   WAITING ──┐
 *             ├─ landmarks OK ─► READY
 *             │
 *   READY ────┴─ angle > startAngle + minimumRepAmplitude ─► LIFTING
 *
 *   LIFTING ──► peak ─► RETURNING
 *
 *   RETURNING ─► angle ≤ startAngle ─► READY  (rep counted)
 *                                    └─ low peak ─► LOW_RANGE
 *
 *   AT_TARGET  can be entered from LIFTING when angle ≥ targetAngle − tolerance.
 */
export class ShoulderFlexionTracker {
  private smoothedAngle: number | null = null;
  private repPhase: RepPhase = 'idle';
  private peakAngle = 0;
  private totalReps = 0;
  private currentRep = 0;
  private lastRepPeak: number | null = null;
  private lastCompletedWasLowRange = false;
  private snapshot: ShoulderFlexionAnalysis = { ...WAITING_ANALYSIS };

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Process one frame of (already EMA-smoothed) landmarks.
   * Call this every requestAnimationFrame.
   * Returns the latest analysis snapshot (same object if nothing changed).
   */
  update(landmarks: Landmark[] | null): ShoulderFlexionAnalysis {
    if (!landmarks || landmarks.length === 0) {
      return this.publishWaiting();
    }

    const rawAngle = calculateShoulderFlexion(landmarks);
    const confidence = computeConfidence(landmarks);

    if (rawAngle === null) {
      return this.publishWaiting();
    }

    // ── Angle smoothing ──────────────────────────────────────────────────────
    // A second lightweight EMA layer on top of the landmark-level EMA.
    // Keeps angle display jitter-free without adding noticeable lag.
    this.smoothedAngle =
      this.smoothedAngle === null
        ? rawAngle
        : lerp(this.smoothedAngle, rawAngle, ANGLE_SMOOTH_ALPHA);

    const angle = this.smoothedAngle;

    // ── State + rep detection ────────────────────────────────────────────────
    this.updateRepDetection(angle);
    const state = this.resolveState(angle);

    // ── Derived metrics ──────────────────────────────────────────────────────
    const { targetAngle } = SHOULDER_FLEXION_CONFIG;
    const deviation       = Math.max(0, targetAngle - angle);
    const rangePercentage = clamp(Math.round((angle / targetAngle) * 100), 0, 100);
    const score           = computeFlexionScore(angle);

    this.snapshot = {
      angle:          Math.round(angle),
      targetAngle,
      deviation:      Math.round(deviation),
      rangePercentage,
      state,
      score,
      repCount:       this.totalReps,
      currentRep:     this.currentRep,
      lastRepPeak:    this.lastRepPeak,
      confidence:     confidence !== null ? Math.round(confidence * 100) : null,
      feedback:       resolveFeedback(state, angle),
    };

    return this.snapshot;
  }

  /** Reset all tracking state (e.g. when camera is stopped). */
  reset(): void {
    this.smoothedAngle           = null;
    this.repPhase                = 'idle';
    this.peakAngle               = 0;
    this.totalReps               = 0;
    this.currentRep              = 0;
    this.lastRepPeak             = null;
    this.lastCompletedWasLowRange = false;
    this.snapshot                = { ...WAITING_ANALYSIS };
  }

  /** Get the most recently published snapshot without running a new frame. */
  getSnapshot(): ShoulderFlexionAnalysis {
    return this.snapshot;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private publishWaiting(): ShoulderFlexionAnalysis {
    // Reset angle smoothing so stale angle doesn't linger after re-appearing
    this.smoothedAngle = null;
    this.repPhase      = 'idle';
    this.peakAngle     = 0;
    this.snapshot = {
      ...WAITING_ANALYSIS,
      repCount:    this.totalReps,
      currentRep:  this.currentRep,
      lastRepPeak: this.lastRepPeak,
    };
    return this.snapshot;
  }

  /**
   * Resolve movement state from current angle and internal rep phase.
   *
   * Priority order (highest first):
   *   1. AT_TARGET when angle ≥ target − tolerance
   *   2. RETURNING when descending
   *   3. LIFTING   when ascending or above start zone
   *   4. LOW_RANGE when just completed a sub-target rep and arm is back at start
   *   5. READY     otherwise
   */
  private resolveState(angle: number): MovementState {
    const { targetAngle, tolerance, startAngle } = SHOULDER_FLEXION_CONFIG;

    if (angle >= targetAngle - tolerance) return 'AT_TARGET';

    if (this.repPhase === 'descending') {
      // Show RETURNING while actively descending, even after passing below start zone
      return angle > startAngle ? 'RETURNING' : 'RETURNING';
    }

    if (this.repPhase === 'ascending') return 'LIFTING';

    // idle phase
    if (this.lastCompletedWasLowRange && angle <= startAngle) return 'LOW_RANGE';
    if (angle > startAngle) return 'LIFTING';

    return 'READY';
  }

  /**
   * Repetition detection state machine.
   *
   * One valid repetition:
   *   READY (arm at startAngle)
   *   → angle rises ≥ startAngle + minimumRepAmplitude   → 'ascending'
   *   → angle drops ≥ DESCENT_HYSTERESIS below peak      → 'descending'
   *   → angle falls back to ≤ startAngle                 → rep complete
   *
   * The minimumRepAmplitude guard (50°) prevents noise or tiny lifts from
   * being counted as repetitions.
   */
  private updateRepDetection(angle: number): void {
    const { startAngle, minimumRepAmplitude } = SHOULDER_FLEXION_CONFIG;
    const liftThreshold = startAngle + minimumRepAmplitude; // 20 + 50 = 70°

    switch (this.repPhase) {
      case 'idle':
        // Clear the low-range flag once the arm has descended back to start
        if (this.lastCompletedWasLowRange && angle <= startAngle) {
          this.lastCompletedWasLowRange = false;
        }
        // Enter ascending only once the arm is meaningfully lifted
        if (angle >= liftThreshold) {
          this.repPhase    = 'ascending';
          this.peakAngle   = angle;
          this.currentRep  = this.totalReps + 1;
        }
        break;

      case 'ascending':
        if (angle > this.peakAngle) {
          this.peakAngle = angle;
        }
        // Reverse direction detected (hysteresis band)
        if (angle < this.peakAngle - DESCENT_HYSTERESIS) {
          this.repPhase = 'descending';
        }
        break;

      case 'descending':
        if (angle <= startAngle) {
          // Rep complete
          this.totalReps                += 1;
          this.lastRepPeak               = Math.round(this.peakAngle);
          this.lastCompletedWasLowRange  = this.peakAngle < SHOULDER_FLEXION_CONFIG.targetAngle - SHOULDER_FLEXION_CONFIG.tolerance;
          this.repPhase                  = 'idle';
          this.currentRep                = 0;
          this.peakAngle                 = 0;
        }
        break;
    }
  }
}
