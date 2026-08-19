/**
 * SessionTypes.ts
 * Type definitions for the live patient exercise session engine,
 * repetition records, persistent PhysiosisSession records, and analytics.
 */

export type RepStatusLabel = 'Limited' | 'Improving' | 'Near target' | 'Target reached';

/** Complete analysis record for a single valid completed repetition. */
export interface RepResult {
  repNumber: number;
  /** Peak shoulder flexion angle achieved during the repetition (degrees). */
  peakAngle: number;
  /** Prescribed target angle (degrees, e.g. 165°). */
  targetAngle: number;
  /** Range of motion completion percentage [0, 100]. */
  romPercentage: number;
  /** Remaining deviation from target in degrees (targetAngle - peakAngle). */
  deviation: number;
  /** Normalized movement quality estimate [0, 100]. */
  qualityScore: number;
  /** True when peakAngle < 0.85 * targetAngle (below 140° for 165° target). */
  limitationDetected: boolean;
  /** Prototype movement-quality severity index [0, 100]. Not a medical score. */
  severity: number;
  /** Human-readable progress tag. */
  statusLabel: RepStatusLabel;
  /** Timestamp when the repetition cycle finished (ms). */
  timestampMs: number;
}

export interface RecordedLimitation {
  limitationId: string;
  observedValue: number;
  targetValue: number;
  suggestionId: string;
}

export type SessionEndReason = 'manual' | 'automatic';

/** Complete persistent rehabilitation exercise session. */
export interface PhysiosisSession {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  exercise: string;
  exerciseId?: string;
  patientId?: string;
  endedReason?: SessionEndReason;

  totalReps: number;

  bestROM: number;
  averageROM: number;

  bestScore: number;
  averageScore: number;

  limitationsDetected: number;
  limitations?: RecordedLimitation[];

  averageDeviation: number;
  averageSeverity: number;

  firstRepROM: number | null;
  lastRepROM: number | null;
  improvementDegrees: number | null;

  movementProgress?: number | null;
  trend?: string | null;
  isUnsaved?: boolean;

  reps: RepResult[];
}

export type PhysiosisSessionReport = PhysiosisSession;

/** Aggregate session-level health & movement telemetry. */
export interface LiveSessionMetrics {
  completedReps: number;
  /** Highest ROM reached in any repetition so far (degrees). */
  bestROM: number;
  /** Average peak ROM across all completed repetitions (degrees). */
  averageROM: number;
  /** Average prototype movement quality across all completed reps [0, 100]. */
  averageQuality: number;
  /** Total count of repetitions where a limitation was detected. */
  limitationsCount: number;
  /** Severity index of the latest repetition or overall session [0, 100]. */
  currentSeverity: number;
  /** Net improvement in peak ROM compared to the first rep (+XX°), or 0. */
  improvementFromFirstRep: number;
  /** Elapsed active session duration in milliseconds. */
  elapsedMs: number;
  /** Advisory trend message (e.g. "Range improving across repetitions"). */
  trendFeedback: string | null;
}

/** Live mutable session state snapshot published to React at ~4Hz. */
export interface LiveSessionState {
  isActive: boolean;
  startTimeMs: number | null;
  currentRepNumber: number;
  repHistory: RepResult[];
  latestRep: RepResult | null;
  metrics: LiveSessionMetrics;
  /** Latest detected limitation peak angle for personalized correction morphing. */
  lastLimitationPeakAngle: number | null;
}

/** Initial empty session metrics. */
export const INITIAL_LIVE_SESSION_METRICS: LiveSessionMetrics = {
  completedReps: 0,
  bestROM: 0,
  averageROM: 0,
  averageQuality: 0,
  limitationsCount: 0,
  currentSeverity: 0,
  improvementFromFirstRep: 0,
  elapsedMs: 0,
  trendFeedback: null,
};

/** Initial empty session state. */
export const INITIAL_LIVE_SESSION_STATE: LiveSessionState = {
  isActive: false,
  startTimeMs: null,
  currentRepNumber: 0,
  repHistory: [],
  latestRep: null,
  metrics: INITIAL_LIVE_SESSION_METRICS,
  lastLimitationPeakAngle: null,
};
