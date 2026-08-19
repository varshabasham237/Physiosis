/**
 * ExerciseSession.ts
 * Stateful session engine for live patient exercise tracking.
 *
 * Runs outside React's render loop, maintaining:
 *   - Active session lifecycle & duration timer
 *   - Repetition records & peak analytics
 *   - Limitation tracking & personalized correction peak storage
 *   - Aggregate session metrics & improvement trends
 */

import type { ShoulderFlexionAnalysis } from '../biomechanics/biomechanicsTypes';
import type { LiveSessionState, RepResult } from './SessionTypes';
import { INITIAL_LIVE_SESSION_STATE } from './SessionTypes';
import { analyzeRepetition } from './RepAnalyzer';
import { calculateSessionMetrics } from './SessionMetrics';

export class ExerciseSessionEngine {
  private state: LiveSessionState = { ...INITIAL_LIVE_SESSION_STATE };
  private lastKnownRepCount = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private elapsedMs = 0;

  get currentState(): Readonly<LiveSessionState> {
    return this.state;
  }

  /** Start a new live exercise tracking session. */
  start(): void {
    this.stop();
    this.elapsedMs = 0;
    this.lastKnownRepCount = 0;
    this.state = {
      ...INITIAL_LIVE_SESSION_STATE,
      isActive: true,
      startTimeMs: Date.now(),
    };
    this.startTimer();
  }

  /** Stop and finalize the session. */
  stop(): void {
    this.stopTimer();
    if (this.state.isActive) {
      this.state = {
        ...this.state,
        isActive: false,
      };
    }
  }

  /** Reset all session data. */
  reset(): void {
    this.stop();
    this.state = { ...INITIAL_LIVE_SESSION_STATE };
  }

  /**
   * Process a frame from the live ShoulderFlexionAnalysis pipeline.
   * Detects completed repetitions, analyzes peaks, and updates session analytics.
   *
   * @param analysis Live snapshot from ShoulderFlexionTracker.
   */
  update(analysis: ShoulderFlexionAnalysis): LiveSessionState {
    // Check if a new rep was completed in this cycle
    if (analysis.repCount > this.lastKnownRepCount && analysis.lastRepPeak !== null) {
      const repNumber = analysis.repCount;
      this.lastKnownRepCount = repNumber;

      const previousRep = this.state.repHistory.length > 0
        ? this.state.repHistory[this.state.repHistory.length - 1]
        : null;

      const newRepResult = analyzeRepetition(
        repNumber,
        analysis.lastRepPeak,
        analysis.targetAngle,
        Date.now(),
        previousRep
      );

      const updatedHistory: RepResult[] = [...this.state.repHistory, newRepResult];

      let lastLimitationPeak = this.state.lastLimitationPeakAngle;
      if (newRepResult.limitationDetected) {
        lastLimitationPeak = newRepResult.peakAngle;
      }

      const updatedMetrics = calculateSessionMetrics(updatedHistory, this.elapsedMs);

      this.state = {
        ...this.state,
        currentRepNumber: analysis.currentRep,
        repHistory: updatedHistory,
        latestRep: newRepResult,
        metrics: updatedMetrics,
        lastLimitationPeakAngle: lastLimitationPeak,
      };
    } else {
      // Just update current active rep index
      if (this.state.currentRepNumber !== analysis.currentRep) {
        this.state = {
          ...this.state,
          currentRepNumber: analysis.currentRep,
        };
      }
    }

    return this.state;
  }

  /** Get a readonly snapshot for React UI updates. */
  getSnapshot(): LiveSessionState {
    return {
      ...this.state,
      metrics: {
        ...this.state.metrics,
        elapsedMs: this.elapsedMs,
      },
    };
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      if (this.state.isActive) {
        this.elapsedMs += 1000;
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
