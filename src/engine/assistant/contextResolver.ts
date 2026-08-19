/**
 * contextResolver.ts
 * Extracts and packages live session metrics and previous session trends into
 * a clean, privacy-preserving PhysioAssistantContext for the rehabilitation assistant.
 *
 * Principles:
 * 1. Single source of truth — consumes existing LiveSessionState & PhysiosisSession records.
 * 2. Privacy-first — never includes credentials, auth tokens, raw webcam buffers, or private PII.
 * 3. Structured — formats limitations and suggestions from the curated SuggestionLibrary.
 */

import type { PhysioAssistantContext } from '../../types/assistant';
import type { LiveSessionState, PhysiosisSession } from '../session/SessionTypes';
import type { ExerciseDefinition } from '../exercise/ExerciseTypes';
import type { ShoulderFlexionAnalysis } from '../biomechanics/biomechanicsTypes';
import { getSuggestionForLimitation } from '../feedback/SuggestionLibrary';

export interface ResolveAssistantContextParams {
  activeExercise?: ExerciseDefinition;
  sessionState?: LiveSessionState;
  shoulderFlexion?: ShoulderFlexionAnalysis;
  lastSavedSession?: PhysiosisSession | null;
  savedSessions?: PhysiosisSession[];
  patientId?: string;
}

export function buildPhysioAssistantContext({
  activeExercise,
  sessionState,
  shoulderFlexion,
  lastSavedSession,
  savedSessions = [],
  patientId,
}: ResolveAssistantContextParams): PhysioAssistantContext {
  const isLiveActive = Boolean(sessionState?.isActive && (sessionState.repHistory.length > 0 || sessionState.currentRepNumber > 0));

  // ── 1. Live Active Session Case ───────────────────────────────────────────
  if (isLiveActive && sessionState && activeExercise) {
    const metrics = sessionState.metrics;

    const limitations: string[] = [];
    const suggestions: string[] = [];

    // Check latest repetition or ongoing limitation
    if (sessionState.latestRep?.limitationDetected) {
      limitations.push(
        `Observed reduced range on repetition ${sessionState.latestRep.repNumber}: ${sessionState.latestRep.peakAngle}° peak vs ${activeExercise.targetAngle}° target`
      );
      const sug = getSuggestionForLimitation(activeExercise.id, true);
      if (sug) {
        suggestions.push(`${sug.name}: ${sug.shortGuidance}`);
      }
    } else if (metrics.limitationsCount > 0) {
      limitations.push(`${metrics.limitationsCount} repetition(s) observed below reference range`);
      const sug = getSuggestionForLimitation(activeExercise.id, true);
      if (sug) {
        suggestions.push(`${sug.name}: ${sug.shortGuidance}`);
      }
    }

    return {
      patientId,
      exercise: activeExercise.name,
      targetROM: activeExercise.targetAngle,
      currentROM: shoulderFlexion?.angle !== null && shoulderFlexion?.angle !== undefined ? shoulderFlexion.angle : undefined,
      bestROM: metrics.bestROM > 0 ? metrics.bestROM : undefined,
      averageROM: metrics.averageROM > 0 ? metrics.averageROM : undefined,
      repetitions: metrics.completedReps,
      movementQuality: metrics.averageQuality > 0 ? metrics.averageQuality : shoulderFlexion?.score ?? undefined,
      limitations: limitations.length > 0 ? limitations : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      trend: metrics.trendFeedback || (metrics.improvementFromFirstRep > 0 ? `+${metrics.improvementFromFirstRep}° improvement from first repetition` : undefined),
      hasActiveSession: true,
      previousSessionsSummary: computePreviousSessionsSummary(savedSessions),
    };
  }

  // ── 2. Historical / Completed Session Summary Case ────────────────────────
  if (lastSavedSession) {
    const limitations: string[] = [];
    const suggestions: string[] = [];

    if (lastSavedSession.limitations && lastSavedSession.limitations.length > 0) {
      for (const lim of lastSavedSession.limitations) {
        limitations.push(`Observed range limit: ${lim.observedValue}° vs ${lim.targetValue}° target`);
        const sug = getSuggestionForLimitation(lim.limitationId || lastSavedSession.exerciseId || 'shoulder-flexion', true);
        if (sug) {
          suggestions.push(`${sug.name}: ${sug.shortGuidance}`);
        }
      }
    } else if (lastSavedSession.limitationsDetected > 0) {
      limitations.push(`${lastSavedSession.limitationsDetected} repetition limitation(s) detected`);
    }

    return {
      patientId: lastSavedSession.patientId || patientId,
      exercise: lastSavedSession.exercise,
      targetROM: activeExercise ? activeExercise.targetAngle : 165,
      bestROM: lastSavedSession.bestROM,
      averageROM: lastSavedSession.averageROM,
      repetitions: lastSavedSession.totalReps,
      movementQuality: lastSavedSession.averageScore,
      limitations: limitations.length > 0 ? limitations : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      trend: lastSavedSession.trend || (lastSavedSession.movementProgress ? `${lastSavedSession.movementProgress}% overall recovery trend` : undefined),
      hasActiveSession: false,
      notes: `Referencing completed session from ${new Date(lastSavedSession.startedAt).toLocaleDateString()}`,
      previousSessionsSummary: computePreviousSessionsSummary(savedSessions),
    };
  }

  // ── 3. Idle / No Previous Sessions Case ────────────────────────────────────
  return {
    patientId,
    exercise: activeExercise ? activeExercise.name : undefined,
    targetROM: activeExercise ? activeExercise.targetAngle : undefined,
    hasActiveSession: false,
    previousSessionsSummary: computePreviousSessionsSummary(savedSessions),
  };
}

function computePreviousSessionsSummary(savedSessions: PhysiosisSession[]) {
  if (!savedSessions || savedSessions.length === 0) return undefined;

  const validSessions = savedSessions.filter((s) => s.totalReps > 0);
  if (validSessions.length === 0) return undefined;

  const latest = validSessions[0];
  const oldest = validSessions[validSessions.length - 1];

  let overallProgress = 'Stable movement pattern';
  if (validSessions.length > 1 && latest.averageROM > oldest.averageROM) {
    const delta = Math.round(latest.averageROM - oldest.averageROM);
    overallProgress = `Improving trend: +${delta}° average ROM gain across ${validSessions.length} sessions`;
  }

  return {
    totalSessions: validSessions.length,
    initialROM: oldest.averageROM,
    latestROM: latest.averageROM,
    overallProgress,
  };
}
