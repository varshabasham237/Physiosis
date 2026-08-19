/**
 * RepAnalyzer.ts
 * Pure analytical module for processing completed exercise repetitions.
 * Calculates limitation status, severity index, quality score, and progress tags.
 *
 * All terminology is strictly non-diagnostic and advisory.
 */

import type { RepResult, RepStatusLabel } from './SessionTypes';
import { clamp } from '../../utils/math';

/** Default limitation threshold ratio: peak < 85% of target (e.g. < 140.25° for 165°). */
export const LIMITATION_THRESHOLD_RATIO = 0.85;

/**
 * Analyze a completed repetition cycle.
 *
 * @param repNumber Index of the repetition (1-based).
 * @param peakAngle Maximum shoulder elevation angle achieved (degrees).
 * @param targetAngle Prescribed reference angle (degrees, e.g. 165°).
 * @param timestampMs Completion timestamp in milliseconds.
 * @param previousRep Previous repetition result for consecutive progress comparison.
 */
export function analyzeRepetition(
  repNumber: number,
  peakAngle: number,
  targetAngle: number,
  timestampMs: number = Date.now(),
  previousRep?: RepResult | null,
): RepResult {
  const safePeak = Math.max(0, Math.round(peakAngle));
  const deviation = Math.max(0, targetAngle - safePeak);
  const romPercentage = clamp(Math.round((safePeak / targetAngle) * 100), 0, 100);

  // Prototype movement quality score [0, 100]
  const qualityScore = clamp(
    Math.round(Math.sqrt(clamp(safePeak / targetAngle, 0, 1)) * 100),
    0,
    100
  );

  // Limitation detected if peak is below 85% of target (e.g. 140° for 165°)
  const limitationThreshold = targetAngle * LIMITATION_THRESHOLD_RATIO;
  const limitationDetected = safePeak < limitationThreshold;

  // Prototype movement severity [0, 100] (0 = target achieved, 100 = 0° ROM)
  const severity = Math.round(clamp((targetAngle - safePeak) / targetAngle, 0, 1) * 100);

  // Progress / Status label
  let statusLabel: RepStatusLabel = 'Limited';
  if (safePeak >= targetAngle - 10) {
    statusLabel = 'Target reached';
  } else if (safePeak >= targetAngle - 30) {
    statusLabel = 'Near target';
  } else if (previousRep && safePeak >= previousRep.peakAngle + 6) {
    statusLabel = 'Improving';
  } else {
    statusLabel = 'Limited';
  }

  return {
    repNumber,
    peakAngle: safePeak,
    targetAngle,
    romPercentage,
    deviation,
    qualityScore,
    limitationDetected,
    severity,
    statusLabel,
    timestampMs,
  };
}
