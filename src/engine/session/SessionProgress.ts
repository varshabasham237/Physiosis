/**
 * SessionProgress.ts
 * Non-clinical estimated movement-progress calculations, trend classification,
 * deterministic session identifier generation, and data-backed session overview summaries.
 *
 * IMPORTANT:
 * This module calculates normalized movement-range changes relative to baseline and target.
 * It is NOT a clinical recovery prediction, medical prognosis, or diagnostic score.
 */

import { clamp } from '../../utils/math';
import type { PhysiosisSession } from './SessionTypes';
import { getExercise } from '../exercise/ExerciseRegistry';

export type MovementTrendType = 'IMPROVING' | 'STABLE' | 'DECLINING';

export interface MovementProgressResult {
  /** Percentage of the gap between baseline and target that has been closed [0, 100]. */
  progressPercentage: number;
  /** Baseline range of motion (first valid rep or earliest recorded session ROM in degrees). */
  baselineROM: number;
  /** Latest observed range of motion (degrees). */
  latestROM: number;
  /** Prototype reference target range of motion (degrees). */
  targetROM: number;
  /** Net change in degrees from baseline (latestROM - baselineROM). */
  deltaDegrees: number;
  /** Classified non-clinical trend direction. */
  trend: MovementTrendType;
  /** Human-readable explanation grounded strictly in the observed numbers. */
  explanation: string;
  /** Interpretation text for session progression. */
  interpretation: string;
}

/**
 * Calculate the estimated movement-range progress indicator.
 *
 * Formula:
 *   progress = ((latestROM - baselineROM) / (targetROM - baselineROM)) * 100
 *
 * Edge cases handled safely:
 *   - baselineROM >= targetROM: progress = 100
 *   - latestROM <= baselineROM: progress = 0
 *   - targetROM <= baselineROM: progress = 0 (avoid div by zero)
 *   - Clamped to [0, 100]
 */
export function calculateMovementProgress(
  baselineROM: number,
  latestROM: number,
  targetROM: number
): MovementProgressResult {
  const safeBaseline = Math.max(0, baselineROM);
  const safeLatest = Math.max(0, latestROM);
  const safeTarget = Math.max(1, targetROM);

  let progressPercentage = 0;
  const deltaDegrees = safeLatest - safeBaseline;

  if (safeBaseline >= safeTarget) {
    progressPercentage = 100;
  } else if (safeLatest <= safeBaseline) {
    progressPercentage = 0;
  } else {
    const rangeGap = safeTarget - safeBaseline;
    if (rangeGap > 0) {
      const rawProgress = ((safeLatest - safeBaseline) / rangeGap) * 100;
      progressPercentage = Math.round(clamp(rawProgress, 0, 100));
    }
  }

  const trend = classifyTrend(safeBaseline, safeLatest, 5);

  let interpretation = 'Observed movement range has remained relatively stable across recorded movements.';
  if (trend === 'IMPROVING') {
    interpretation = 'Observed movement range increased across recorded movements.';
  } else if (trend === 'DECLINING') {
    interpretation = 'Observed movement range was lower in the latest movement. Consider discussing the change with your physiotherapist.';
  }

  const explanation = `Movement range increased from ${Math.round(safeBaseline)}° to ${Math.round(
    safeLatest
  )}° relative to the prototype reference target of ${Math.round(safeTarget)}°.`;

  return {
    progressPercentage,
    baselineROM: Math.round(safeBaseline),
    latestROM: Math.round(safeLatest),
    targetROM: Math.round(safeTarget),
    deltaDegrees: Math.round(deltaDegrees),
    trend,
    explanation,
    interpretation,
  };
}

/**
 * Classify movement-range trend with a configurable threshold (default 5°).
 */
export function classifyTrend(
  previousROM: number,
  latestROM: number,
  thresholdDegrees: number = 5
): MovementTrendType {
  const diff = latestROM - previousROM;
  if (diff >= thresholdDegrees) return 'IMPROVING';
  if (diff <= -thresholdDegrees) return 'DECLINING';
  return 'STABLE';
}

/**
 * Calculate movement progress across a single session using its rep history.
 */
export function calculateSessionProgress(session: PhysiosisSession): MovementProgressResult {
  const reps = session.reps;
  const exerciseDef = getExercise(session.exercise.toLowerCase().replace(/ /g, '-'));
  const targetROM = exerciseDef?.targetAngle ?? session.reps[0]?.targetAngle ?? 165;

  if (!reps || reps.length === 0) {
    return {
      progressPercentage: 0,
      baselineROM: 0,
      latestROM: session.bestROM || 0,
      targetROM,
      deltaDegrees: 0,
      trend: 'STABLE',
      explanation: 'No completed repetitions recorded in this session.',
      interpretation: 'No movement data available.',
    };
  }

  const baselineROM = reps[0].peakAngle;
  const latestROM = reps[reps.length - 1].peakAngle;

  return calculateMovementProgress(baselineROM, latestROM, targetROM);
}

/**
 * Calculate multi-session progress across historical sessions for a given exercise.
 * Uses the earliest saved session baseline for that exercise vs latest session best ROM.
 */
export function calculateCrossSessionProgress(
  sessions: PhysiosisSession[],
  exerciseName: string
): MovementProgressResult | null {
  const matchingSessions = sessions
    .filter(
      (s) =>
        s.exercise.toLowerCase() === exerciseName.toLowerCase() ||
        (exerciseName === 'Shoulder Flexion' && !s.exercise)
    )
    .sort((a, b) => a.startedAt - b.startedAt); // chronological: oldest first

  if (matchingSessions.length === 0) return null;

  const earliestSession = matchingSessions[0];
  const latestSession = matchingSessions[matchingSessions.length - 1];

  const baselineROM = earliestSession.firstRepROM ?? earliestSession.bestROM;
  const latestROM = latestSession.bestROM;

  const exerciseDef = getExercise(exerciseName.toLowerCase().replace(/ /g, '-'));
  const targetROM = exerciseDef?.targetAngle ?? latestSession.reps[0]?.targetAngle ?? 165;

  const result = calculateMovementProgress(baselineROM, latestROM, targetROM);

  // If multiple sessions, check trend between last two sessions
  if (matchingSessions.length >= 2) {
    const prevSession = matchingSessions[matchingSessions.length - 2];
    result.trend = classifyTrend(prevSession.bestROM, latestSession.bestROM, 5);
    if (result.trend === 'IMPROVING') {
      result.interpretation = 'Observed movement range increased across recent sessions.';
    } else if (result.trend === 'DECLINING') {
      result.interpretation = 'Observed movement range was lower in the latest session. Consider discussing the change with your physiotherapist.';
    } else {
      result.interpretation = 'Observed movement range has remained relatively stable across recent sessions.';
    }
  }

  return result;
}

/**
 * Deterministically generate a clean clinical session ID: `PS-YYYYMMDD-XXX`.
 */
export function generateDeterministicSessionId(startedAt: number, indexOrSuffix?: string | number): string {
  const d = new Date(startedAt);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;

  let suffix = '001';
  if (typeof indexOrSuffix === 'number') {
    suffix = String(indexOrSuffix).padStart(3, '0');
  } else if (typeof indexOrSuffix === 'string' && indexOrSuffix.length > 0) {
    suffix = indexOrSuffix.slice(-3).toUpperCase();
  }

  return `PS-${datePart}-${suffix}`;
}

/**
 * Generate a strictly data-backed session overview text.
 * No medical diagnoses, age, gender, pain score, or therapist assumptions.
 */
export function generateSessionOverviewText(session: PhysiosisSession): string {
  const count = session.totalReps;
  const exerciseName = session.exercise.toLowerCase();
  const bestROM = session.bestROM;
  const target = session.reps[0]?.targetAngle ?? 165;

  if (count === 0) {
    return `The session recorded no completed repetitions of ${exerciseName}.`;
  }

  const repWord = count === 1 ? 'repetition' : 'valid repetitions';
  let statement = `The session recorded ${count} ${repWord} of ${exerciseName}. The highest observed range was ${bestROM}° against a prototype reference target of ${target}°.`;

  if (count >= 2 && session.improvementDegrees !== null) {
    if (session.improvementDegrees >= 8) {
      statement += ` The session showed gradual improvement across repetitions (+${session.improvementDegrees}° from Rep 1 to Rep ${count}).`;
    } else if (session.improvementDegrees <= -8) {
      statement += ` Observed range was lower in later repetitions (${session.improvementDegrees}° change across the session).`;
    } else {
      statement += ` Observed movement range remained consistent across completed repetitions.`;
    }
  }

  return statement;
}

/**
 * Format timestamp into standard clinical report format: "18 Aug 2026, 11:15 AM".
 */
export function formatReportDateTime(timestamp: number): { dateStr: string; timeStr: string } {
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return { dateStr, timeStr };
}
