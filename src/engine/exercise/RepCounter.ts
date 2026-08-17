/**
 * RepCounter.ts
 * State machine for counting exercise repetitions.
 *
 * The counter moves through exercise phases in order.
 * When all phases are complete, a rep is recorded.
 *
 * Phase transition logic (biomechanics-driven) will be
 * wired in once the AngleCalculator is live in Step 2.
 */

import type { ExerciseDefinition, RepRecord, PhaseStatus } from '../../types/exercise';

export interface RepCounterState {
  currentPhaseIndex: number;
  phaseStatus: PhaseStatus;
  completedReps: number;
  repHistory: RepRecord[];
}

export class RepCounter {
  private exercise: ExerciseDefinition;
  private state: RepCounterState;
  private phaseStartTime: number | null = null;

  constructor(exercise: ExerciseDefinition) {
    this.exercise = exercise;
    this.state = {
      currentPhaseIndex: 0,
      phaseStatus: 'idle',
      completedReps: 0,
      repHistory: [],
    };
  }

  get currentState(): Readonly<RepCounterState> {
    return this.state;
  }

  get currentPhase() {
    return this.exercise.phases[this.state.currentPhaseIndex] ?? null;
  }

  /**
   * Advance to the next phase.
   * Called by the analysis engine when phase targets are met.
   * Returns true if a full rep was completed.
   */
  advancePhase(wasClean: boolean, timestampMs: number): boolean {
    const { currentPhaseIndex } = this.state;
    const isLastPhase = currentPhaseIndex === this.exercise.phases.length - 1;

    if (isLastPhase) {
      // Rep complete
      const durationMs =
        this.phaseStartTime !== null ? timestampMs - this.phaseStartTime : 0;

      const record: RepRecord = {
        repIndex: this.state.completedReps,
        durationMs,
        wasClean,
        timestampMs,
      };

      this.state = {
        currentPhaseIndex: 0,
        phaseStatus: 'idle',
        completedReps: this.state.completedReps + 1,
        repHistory: [...this.state.repHistory, record],
      };
      this.phaseStartTime = null;
      return true;
    }

    this.state = {
      ...this.state,
      currentPhaseIndex: currentPhaseIndex + 1,
      phaseStatus: 'active',
    };
    this.phaseStartTime = timestampMs;
    return false;
  }

  /** Start the first phase. */
  start(timestampMs: number): void {
    this.state.phaseStatus = 'active';
    this.phaseStartTime = timestampMs;
  }

  /** Reset to initial state. */
  reset(): void {
    this.state = {
      currentPhaseIndex: 0,
      phaseStatus: 'idle',
      completedReps: 0,
      repHistory: [],
    };
    this.phaseStartTime = null;
  }
}
