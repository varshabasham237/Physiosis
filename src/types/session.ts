/**
 * session.ts
 * Types for session lifecycle, state, and health metrics.
 */

import type { RepRecord } from './exercise';
import type { AnalysisSummary } from './analysis';

/** Lifecycle status of a session. */
export type SessionStatus = 'idle' | 'running' | 'paused' | 'complete';

/** Immutable session configuration set at start. */
export interface SessionConfig {
  exerciseId: string;
  prescribedReps: number;
  prescribedSets: number;
  patientId?: string;
}

/** Mutable session state tracked during execution. */
export interface SessionState {
  status: SessionStatus;
  config: SessionConfig | null;
  currentSet: number;
  currentRep: number;
  repHistory: RepRecord[];
  /** Elapsed time in milliseconds since session start. */
  elapsedMs: number;
  startedAt?: number;
  endedAt?: number;
}

/** Aggregated health metrics for the current session. */
export interface SessionMetrics {
  completedReps: number;
  completedSets: number;
  cleanRepRate: number; // [0, 1]
  analysis: AnalysisSummary;
  elapsedMs: number;
}
