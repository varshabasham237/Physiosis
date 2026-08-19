/**
 * PoseTypes.ts
 * Shared types for the reference skeleton animation system.
 *
 * All angles are in DEGREES. Positive values follow anatomical convention:
 *   shoulder flexion +  = forward elevation
 *   elbow flexion    +  = bend toward forearm
 *   hip flexion      +  = thigh forward
 *   knee flexion     +  = bend
 *   trunk lean       +  = forward lean
 */

// ─── 2D vector ────────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

// ─── Four-Phase SIH Demonstration Model ───────────────────────────────────────

/**
 * The four stages of the Physiosis demonstration:
 *   REFERENCE   — ideal reference movement (165°)
 *   LIMITATION  — patient performs movement with restricted ROM (62°)
 *   CORRECTION  — guided correction smoothly moving toward target (62° → 165°)
 *   IMPROVED    — target range achieved (165°) and held with success state
 */
export type ExercisePhase =
  | 'REFERENCE'
  | 'LIMITATION'
  | 'CORRECTION'
  | 'IMPROVED';

export interface PhaseConfig {
  phase: ExercisePhase;
  name: string;
  shortLabel: string;
  caption: string;
  statusText: string;
  statusType: 'normal' | 'amber' | 'guidance' | 'success';
  startMs: number;
  endMs: number;
  targetAngle: number;
  expectedAngle: number;
}

/**
 * Create a typed 4-phase configuration for any rehabilitation exercise.
 */
export function createDemoPhases(
  targetAngle: number,
  limitedAngle: number,
  metricName: string = 'Movement'
): PhaseConfig[] {
  return [
    {
      phase: 'REFERENCE',
      name: 'Reference Form',
      shortLabel: '1. Reference',
      caption: `Reference ${metricName.toLowerCase()} — ideal therapeutic form (${targetAngle}°)`,
      statusText: 'Correct form',
      statusType: 'normal',
      startMs: 0,
      endMs: 4000,
      targetAngle,
      expectedAngle: targetAngle,
    },
    {
      phase: 'LIMITATION',
      name: 'Detected Limitation',
      shortLabel: '2. Limitation',
      caption: `Detected limitation — restricted ${metricName.toLowerCase()} range (${limitedAngle}° / ${targetAngle}°)`,
      statusText: 'Limitation detected',
      statusType: 'amber',
      startMs: 4000,
      endMs: 8000,
      targetAngle,
      expectedAngle: limitedAngle,
    },
    {
      phase: 'CORRECTION',
      name: 'Guided Correction',
      shortLabel: '3. Correction',
      caption: `Guided correction — moving toward target range (${limitedAngle}° → ${targetAngle}°)`,
      statusText: 'Guidance active',
      statusType: 'guidance',
      startMs: 8000,
      endMs: 13000,
      targetAngle,
      expectedAngle: targetAngle,
    },
    {
      phase: 'IMPROVED',
      name: 'Improved Movement',
      shortLabel: '4. Improved',
      caption: `Improved movement — target range reached (${targetAngle}° / ${targetAngle}°)`,
      statusText: 'Movement improved',
      statusType: 'success',
      startMs: 13000,
      endMs: 16000,
      targetAngle,
      expectedAngle: targetAngle,
    },
  ];
}

/** 16-second master demonstration schedule (16,000 ms) default for shoulder flexion. */
export const DEMO_PHASES: PhaseConfig[] = createDemoPhases(165, 62, 'Shoulder Flexion');

/** Return the active PhaseConfig for any elapsed millisecond in [0, 16000). */
export function getPhaseAtTime(elapsedMs: number, phases: PhaseConfig[] = DEMO_PHASES): PhaseConfig {
  const t = ((elapsedMs % 16000) + 16000) % 16000;
  for (const p of phases) {
    if (t >= p.startMs && t < p.endMs) {
      return p;
    }
  }
  return phases[0];
}

// ─── Pose model ───────────────────────────────────────────────────────────────

/**
 * All degrees-of-freedom tracked by the reference animation.
 */
export interface ReferencePose {
  // Posture mode
  postureMode?: 'standing' | 'seated' | 'supine';

  // Primary active angle for readout (flexion, extension, elevation)
  activeAngleDeg?: number;

  // Trunk
  trunkLean: number;          // + = forward lean (sagittal)
  trunkSideFlexion: number;   // + = lean right (frontal)

  // Right arm (tracked arm)
  rightShoulderFlexion: number;    // + = forward elevation (0 = hanging)
  rightShoulderAbduction: number;  // + = lateral elevation
  rightElbowFlexion: number;       // + = bend toward forearm

  // Left arm
  leftShoulderFlexion: number;
  leftShoulderAbduction: number;
  leftElbowFlexion: number;

  // Legs
  rightHipFlexion: number;    // + = thigh forward (or elevation)
  rightKneeFlexion: number;   // + = knee bend / flexion angle
  leftHipFlexion: number;
  leftKneeFlexion: number;

  // Head
  headFlexion: number;        // + = forward nod
  headRotation: number;       // + = turn right

  // Shoulder girdle (secondary scapular motion)
  rightShoulderElevation: number;  // + = shrug (mm rise)
  leftShoulderElevation: number;
}

// ─── Body proportions ─────────────────────────────────────────────────────────

export interface BodyProportions {
  headRadius: number;
  neckLength: number;
  trunkLength: number;
  pelvisHeight: number;
  shoulderHalfWidth: number;
  hipHalfWidth: number;
  upperArmLength: number;
  forearmLength: number;
  thighLength: number;
  shinLength: number;
  footLength: number;
}

export const DEFAULT_BODY_PROPORTIONS: BodyProportions = {
  headRadius:       0.066,
  neckLength:       0.050,
  trunkLength:      0.275,
  pelvisHeight:     0.055,
  shoulderHalfWidth:0.105,
  hipHalfWidth:     0.068,
  upperArmLength:   0.155,
  forearmLength:    0.135,
  thighLength:      0.225,
  shinLength:       0.205,
  footLength:       0.072,
};

// ─── Computed joint world positions ───────────────────────────────────────────

export interface JointPositions {
  pelvis:       Vec2;
  spine:        Vec2;
  neckBase:     Vec2;
  headCenter:   Vec2;

  leftShoulder: Vec2;
  leftElbow:    Vec2;
  leftWrist:    Vec2;

  rightShoulder:Vec2;
  rightElbow:   Vec2;
  rightWrist:   Vec2;

  leftHip:      Vec2;
  leftKnee:     Vec2;
  leftAnkle:    Vec2;
  leftToe:      Vec2;

  rightHip:     Vec2;
  rightKnee:    Vec2;
  rightAnkle:   Vec2;
  rightToe:     Vec2;
}

// ─── Animation timeline ───────────────────────────────────────────────────────

export interface TimelineKeyframe {
  timeMs: number;
  pose: ReferencePose;
}

export type EasingFn = (t: number) => number;

export interface AnimationTimeline {
  keyframes: TimelineKeyframe[];
  durationMs: number;
}
