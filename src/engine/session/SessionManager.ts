/**
 * SessionManager.ts
 * Manages the full lifecycle of a rehabilitation session.
 *
 * Responsible for:
 * - Starting / pausing / resuming / ending sessions
 * - Tracking elapsed time
 * - Aggregating rep history and analysis summaries
 */

import type { SessionState, SessionConfig, SessionMetrics } from '../../types/session';
import type { RepRecord } from '../../types/exercise';
import type { AnalysisSummary } from '../../types/analysis';

const EMPTY_SUMMARY: AnalysisSummary = {
  averageFormScore: 0,
  totalDeviations: 0,
  criticalDeviations: 0,
  warningDeviations: 0,
};

function buildInitialState(config: SessionConfig): SessionState {
  return {
    status: 'running',
    config,
    currentSet: 1,
    currentRep: 0,
    repHistory: [],
    elapsedMs: 0,
    startedAt: Date.now(),
  };
}

export class SessionManager {
  private state: SessionState = {
    status: 'idle',
    config: null,
    currentSet: 1,
    currentRep: 0,
    repHistory: [],
    elapsedMs: 0,
  };

  private tickInterval: ReturnType<typeof setInterval> | null = null;

  get currentState(): Readonly<SessionState> {
    return this.state;
  }

  /** Start a new session with the given config. */
  start(config: SessionConfig): void {
    this.stop(); // Clear any existing session
    this.state = buildInitialState(config);
    this.startTick();
    console.info('[SessionManager] Session started:', config.exerciseId);
  }

  /** Pause the session timer. */
  pause(): void {
    if (this.state.status !== 'running') return;
    this.stopTick();
    this.state = { ...this.state, status: 'paused' };
  }

  /** Resume from paused state. */
  resume(): void {
    if (this.state.status !== 'paused') return;
    this.state = { ...this.state, status: 'running' };
    this.startTick();
  }

  /** Stop and finalize the session. */
  stop(): void {
    this.stopTick();
    if (this.state.status !== 'idle') {
      this.state = { ...this.state, status: 'complete', endedAt: Date.now() };
    }
  }

  /** Record a completed rep. */
  recordRep(record: RepRecord): void {
    const { config } = this.state;
    if (!config) return;

    const nextRep = this.state.currentRep + 1;
    const repDone = nextRep >= config.prescribedReps;
    const nextSet = repDone ? this.state.currentSet + 1 : this.state.currentSet;

    this.state = {
      ...this.state,
      repHistory: [...this.state.repHistory, record],
      currentRep: repDone ? 0 : nextRep,
      currentSet: nextSet,
    };
  }

  /** Compute aggregate session metrics. */
  getMetrics(): SessionMetrics {
    const { repHistory, elapsedMs, currentSet } = this.state;
    const cleanReps = repHistory.filter((r) => r.wasClean).length;

    const analysis: AnalysisSummary = repHistory.length === 0
      ? EMPTY_SUMMARY
      : {
          averageFormScore: 0, // Will be computed from frame data in Step 2
          totalDeviations: 0,
          criticalDeviations: 0,
          warningDeviations: 0,
        };

    return {
      completedReps: repHistory.length,
      completedSets: currentSet - 1,
      cleanRepRate: repHistory.length > 0 ? cleanReps / repHistory.length : 0,
      analysis,
      elapsedMs,
    };
  }

  private startTick(): void {
    this.tickInterval = setInterval(() => {
      if (this.state.status === 'running') {
        this.state = { ...this.state, elapsedMs: this.state.elapsedMs + 1000 };
      }
    }, 1000);
  }

  private stopTick(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
