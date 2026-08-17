/**
 * LandmarkSmoother.ts
 * Exponential Moving Average (EMA) temporal smoothing for pose landmarks.
 *
 * Formula:
 *   smoothed = alpha * current + (1 - alpha) * previous
 *
 * Configurable alpha around 0.35–0.45 reduces jitter while maintaining
 * real-time responsiveness without excessive lag.
 */

import type { Landmark } from '../../types/pose';

export class LandmarkSmoother {
  private readonly alpha: number;
  private previous: Landmark[] | null = null;

  /**
   * @param alpha - EMA alpha weight on current frame [0, 1]. Defaults to 0.4.
   */
  constructor(alpha = 0.4) {
    this.alpha = Math.min(1, Math.max(0, alpha));
  }

  /**
   * Apply EMA smoothing to an array of landmarks.
   * On the first call or length mismatch, returns the input unchanged and seeds the state.
   *
   * @param current - Raw landmarks from the current frame.
   * @returns Smoothed landmarks array.
   */
  smooth(current: Landmark[]): Landmark[] {
    if (this.previous === null || this.previous.length !== current.length) {
      this.previous = current.map((lm) => ({ ...lm }));
      return current;
    }

    const smoothed: Landmark[] = current.map((lm, i) => {
      const prev = this.previous![i];
      return {
        x: this.alpha * lm.x + (1 - this.alpha) * prev.x,
        y: this.alpha * lm.y + (1 - this.alpha) * prev.y,
        z: this.alpha * lm.z + (1 - this.alpha) * prev.z,
        visibility: lm.visibility !== undefined ? lm.visibility : prev.visibility,
      };
    });

    this.previous = smoothed;
    return smoothed;
  }

  /** Reset smoothing state (e.g. when tracking is lost or restarted). */
  reset(): void {
    this.previous = null;
  }
}
