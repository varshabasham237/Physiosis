/**
 * engine.ts
 * Types for the overall engine status and configuration.
 */

/**
 * Lifecycle status of the Physiosis engine.
 * - idle:        Engine constructed but not yet initialized.
 * - initializing: Loading models / requesting camera permission.
 * - ready:       Models loaded, camera active, waiting to start.
 * - running:     Actively processing frames.
 * - paused:      Processing paused (e.g. session paused).
 * - error:       Non-recoverable failure.
 */
export type EngineStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'error';

/** Display metadata for each engine status. */
export interface EngineStatusMeta {
  label: string;
  color: 'neutral' | 'blue' | 'green' | 'amber' | 'red';
  isAnimated: boolean;
}

export const ENGINE_STATUS_META: Record<EngineStatus, EngineStatusMeta> = {
  idle: { label: 'Idle', color: 'neutral', isAnimated: false },
  initializing: { label: 'Initializing', color: 'blue', isAnimated: true },
  ready: { label: 'Ready', color: 'green', isAnimated: false },
  running: { label: 'Live', color: 'green', isAnimated: true },
  paused: { label: 'Paused', color: 'amber', isAnimated: false },
  error: { label: 'Error', color: 'red', isAnimated: false },
};

/** Configuration for the engine (populated in Step 2). */
export interface EngineConfig {
  /** Target frames per second for pose detection. */
  targetFps: number;
  /** Minimum pose confidence threshold [0, 1]. */
  minPoseConfidence: number;
  /** Smoothing factor for landmark EMA [0, 1]. Higher = more smoothing. */
  smoothingFactor: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  targetFps: 30,
  minPoseConfidence: 0.5,
  smoothingFactor: 0.6,
};
