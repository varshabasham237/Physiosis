/**
 * analysis.ts
 * Types for real-time deviation detection and feedback.
 */

import type { JointDescriptor } from './biomechanics';

/** Severity of a detected deviation. */
export type DeviationSeverity = 'info' | 'warning' | 'critical';

/** A single detected deviation from the reference exercise. */
export interface Deviation {
  id: string;
  severity: DeviationSeverity;
  /** The joint where the deviation was detected. */
  joint: JointDescriptor;
  /** Human-readable feedback message. */
  message: string;
  /** How far out of range, in degrees. */
  errorDeg: number;
  timestampMs: number;
}

/** Full analysis result for one processed frame. */
export interface AnalysisFrameResult {
  deviations: Deviation[];
  /** Overall form score [0, 100]. */
  formScore: number;
  /** Whether the subject's pose was confidently detected. */
  poseDetected: boolean;
  timestampMs: number;
}

/** Summary statistics over a session or rep window. */
export interface AnalysisSummary {
  averageFormScore: number;
  totalDeviations: number;
  criticalDeviations: number;
  warningDeviations: number;
}
