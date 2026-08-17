/**
 * DeviationDetector.ts
 * Detects deviations between a patient's measured joint angles
 * and the reference exercise's joint targets.
 *
 * Placeholder — currently computes deviations from typed targets.
 * Will receive live BiomechanicsResult frames in Step 2.
 */

import type { JointAngle } from '../../types/biomechanics';
import type { JointTarget, ExercisePhase } from '../../types/exercise';
import type { Deviation, AnalysisFrameResult } from '../../types/analysis';
import { clamp } from '../../utils/math';

/** Thresholds for deviation severity (in degrees). */
const SEVERITY_THRESHOLDS = {
  info: 5,
  warning: 15,
  critical: 30,
} as const;

function computeDeviation(
  measured: JointAngle,
  target: JointTarget,
  timestampMs: number
): Deviation | null {
  if (!measured.isValid) return null;

  const { angleDeg, descriptor } = measured;
  const { minDeg, maxDeg } = target;

  let errorDeg = 0;
  let direction = '';

  if (angleDeg < minDeg) {
    errorDeg = minDeg - angleDeg;
    direction = 'below range';
  } else if (angleDeg > maxDeg) {
    errorDeg = angleDeg - maxDeg;
    direction = 'above range';
  } else {
    return null; // Within target range — no deviation
  }

  const severity =
    errorDeg >= SEVERITY_THRESHOLDS.critical
      ? 'critical'
      : errorDeg >= SEVERITY_THRESHOLDS.warning
      ? 'warning'
      : 'info';

  return {
    id: `${descriptor.label}-${timestampMs}`,
    severity,
    joint: descriptor,
    message: `${descriptor.label} is ${direction} by ${errorDeg.toFixed(1)}°`,
    errorDeg,
    timestampMs,
  };
}

export class DeviationDetector {
  /**
   * Analyze measured joint angles against a phase's targets.
   *
   * @param measuredAngles - Computed joint angles for this frame.
   * @param phase - The active exercise phase to compare against.
   * @param timestampMs - Current frame timestamp.
   * @returns AnalysisFrameResult for this frame.
   */
  analyze(
    measuredAngles: JointAngle[],
    phase: ExercisePhase,
    timestampMs: number
  ): AnalysisFrameResult {
    const angleMap = new Map<string, JointAngle>();
    for (const angle of measuredAngles) {
      angleMap.set(angle.descriptor.label, angle);
    }

    const deviations: Deviation[] = [];

    for (const target of phase.targets) {
      const measured = angleMap.get(target.descriptor.label);
      if (!measured) continue;
      const deviation = computeDeviation(measured, target, timestampMs);
      if (deviation) deviations.push(deviation);
    }

    // Form score: penalize proportionally to error magnitude, capped per deviation
    const totalPenalty = deviations.reduce((sum, d) => {
      const penalty = clamp((d.errorDeg / SEVERITY_THRESHOLDS.critical) * 40, 0, 40);
      return sum + penalty;
    }, 0);

    const formScore = clamp(100 - totalPenalty, 0, 100);
    const poseDetected = measuredAngles.some((a) => a.isValid);

    return {
      deviations,
      formScore,
      poseDetected,
      timestampMs,
    };
  }
}
