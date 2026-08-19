/**
 * SessionAnalytics.ts
 * Analytics computation, session finalization, and advisory recommendation generation.
 */

import type { LiveSessionState, PhysiosisSession, RecordedLimitation, SessionEndReason } from './SessionTypes';
import { getExerciseSuggestion } from '../feedback/SuggestionLibrary';
import { calculateMovementProgress } from './SessionProgress';

/**
 * Construct a finalized PhysiosisSession from a live session state snapshot.
 * Returns null if the session contains no completed repetitions.
 */
export function buildPhysiosisSession(
  state: LiveSessionState,
  exerciseName: string = 'Shoulder Flexion',
  exerciseId: string = 'shoulder-flexion',
  endedReason: SessionEndReason = 'manual',
  targetAngle: number = 165,
  patientId?: string
): PhysiosisSession | null {
  const reps = state.repHistory;
  if (!reps || reps.length === 0) return null;

  const count = reps.length;
  const startedAt = state.startTimeMs ?? Date.now() - state.metrics.elapsedMs;
  const endedAt = Date.now();
  const durationSeconds = Math.max(1, Math.round(state.metrics.elapsedMs / 1000));

  let bestROM = 0;
  let sumROM = 0;
  let bestScore = 0;
  let sumScore = 0;
  let sumDeviation = 0;
  let sumSeverity = 0;
  let limitationsDetected = 0;

  for (const r of reps) {
    if (r.peakAngle > bestROM) bestROM = r.peakAngle;
    sumROM += r.peakAngle;

    if (r.qualityScore > bestScore) bestScore = r.qualityScore;
    sumScore += r.qualityScore;

    sumDeviation += r.deviation;
    sumSeverity += r.severity;
    if (r.limitationDetected) limitationsDetected++;
  }

  const averageROM = Math.round(sumROM / count);
  const averageScore = Math.round(sumScore / count);
  const averageDeviation = Math.round(sumDeviation / count);
  const averageSeverity = Math.round(sumSeverity / count);

  const firstRepROM = reps[0]?.peakAngle ?? null;
  const lastRepROM = reps[count - 1]?.peakAngle ?? null;
  const improvementDegrees =
    firstRepROM !== null && lastRepROM !== null && count > 1
      ? lastRepROM - firstRepROM
      : null;

  // Build limitations array mapped to curated SuggestionLibrary
  const limitations: RecordedLimitation[] = [];
  if (limitationsDetected > 0) {
    const suggestion = getExerciseSuggestion(exerciseId);
    limitations.push({
      limitationId: exerciseId,
      observedValue: bestROM,
      targetValue: targetAngle,
      suggestionId: suggestion?.id ?? 'shoulder_rom',
    });
  }

  // Calculate estimated movement progress and trend across reps
  const baselineROM = firstRepROM ?? bestROM;
  const latestROM = lastRepROM ?? bestROM;
  const progressResult = calculateMovementProgress(baselineROM, latestROM, targetAngle);

  return {
    id: `session-${startedAt}-${Math.random().toString(36).slice(2, 7)}`,
    startedAt,
    endedAt,
    durationSeconds,
    exercise: exerciseName,
    exerciseId,
    patientId,
    endedReason,
    totalReps: count,
    bestROM,
    averageROM,
    bestScore,
    averageScore,
    limitationsDetected,
    limitations,
    averageDeviation,
    averageSeverity,
    firstRepROM,
    lastRepROM,
    improvementDegrees,
    movementProgress: progressResult.progressPercentage,
    trend: progressResult.trend,
    reps,
  };
}

/**
 * Generate advisory guidance text for the Session Summary.
 * Strictly non-diagnostic and encouraging.
 */
export function generateAdvisoryGuidance(session: PhysiosisSession): string {
  const { limitationsDetected, totalReps, improvementDegrees, bestROM } = session;

  if (bestROM >= 155 && limitationsDetected === 0) {
    return 'Excellent session! You achieved the reference range of motion consistently across your repetitions with smooth control. Maintain this form in future sessions.';
  }

  if (improvementDegrees !== null && improvementDegrees >= 10) {
    return `Great progress during this session! Your shoulder range improved by +${improvementDegrees}° from Rep 1 to Rep ${totalReps}. Continue practicing with controlled movement and follow guidance from your physiotherapist.`;
  }

  if (limitationsDetected > 0) {
    return `During this session, your shoulder elevation remained below the selected reference target (165°). Continue practicing with steady, pain-free elevation and consult your physiotherapist for personalized range goals.`;
  }

  return 'Session completed. Continue practicing the prescribed rehabilitation exercise with controlled elevation and proper posture.';
}

/**
 * Format a timestamp into a human-readable date label.
 */
export function formatSessionDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isYesterday =
    new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}
