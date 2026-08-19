/**
 * SessionMetrics.ts
 * Computes aggregate session telemetry and trend analytics over recorded repetitions.
 */

import type { RepResult, LiveSessionMetrics } from './SessionTypes';
import { INITIAL_LIVE_SESSION_METRICS } from './SessionTypes';

/**
 * Calculate aggregate session metrics from rep history.
 *
 * @param repHistory Array of completed RepResult objects.
 * @param elapsedMs Total active session elapsed time in milliseconds.
 */
export function calculateSessionMetrics(
  repHistory: RepResult[],
  elapsedMs: number = 0,
): LiveSessionMetrics {
  if (!repHistory || repHistory.length === 0) {
    return {
      ...INITIAL_LIVE_SESSION_METRICS,
      elapsedMs,
    };
  }

  const count = repHistory.length;
  let bestROM = 0;
  let sumROM = 0;
  let sumQuality = 0;
  let limitationsCount = 0;

  for (const rep of repHistory) {
    if (rep.peakAngle > bestROM) bestROM = rep.peakAngle;
    sumROM += rep.peakAngle;
    sumQuality += rep.qualityScore;
    if (rep.limitationDetected) limitationsCount++;
  }

  const averageROM = Math.round(sumROM / count);
  const averageQuality = Math.round(sumQuality / count);

  const firstRep = repHistory[0];
  const latestRep = repHistory[count - 1];
  const improvementFromFirstRep = count > 1 ? latestRep.peakAngle - firstRep.peakAngle : 0;
  const currentSeverity = latestRep ? latestRep.severity : 0;

  // Trend feedback message
  let trendFeedback: string | null = null;
  if (improvementFromFirstRep >= 8) {
    trendFeedback = `Range improving across repetitions (+${improvementFromFirstRep}° from Rep 1).`;
  } else if (latestRep.peakAngle >= latestRep.targetAngle - 10) {
    trendFeedback = 'Target range achieved with consistent elevation.';
  } else if (limitationsCount >= 2) {
    trendFeedback = 'Range of motion below reference. Visual guidance recommended.';
  }

  return {
    completedReps: count,
    bestROM,
    averageROM,
    averageQuality,
    limitationsCount,
    currentSeverity,
    improvementFromFirstRep,
    elapsedMs,
    trendFeedback,
  };
}
