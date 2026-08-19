/**
 * AnimationController.ts
 * Time-based animation controller for the reference skeleton.
 *
 * Uses requestAnimationFrame for 60fps rendering.
 * Owns all mutable animation state — React never sees per-frame updates.
 *
 * Usage:
 *   const ctrl = new AnimationController(timeline, onFrame);
 *   ctrl.play();
 *   // onFrame(pose, elapsedMs, progressRatio) called every RAF tick
 *   ctrl.pause();
 *   ctrl.reset();
 *   ctrl.dispose(); // on unmount
 */

import { getPoseAtTime } from './PoseLibrary';
import type { AnimationTimeline, ReferencePose } from './PoseTypes';

export type AnimationFrameCallback = (
  pose: ReferencePose,
  elapsedMs: number,
  progressRatio: number,   // [0, 1] position within the current loop
) => void;

export type PlaybackState = 'playing' | 'paused' | 'stopped';

export class AnimationController {
  private rafId: number | null = null;
  private elapsedMs   = 0;
  private lastTs: number | null = null;
  private _state: PlaybackState = 'stopped';

  constructor(
    private readonly timeline: AnimationTimeline,
    private readonly onFrame: AnimationFrameCallback,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  get state(): PlaybackState { return this._state; }

  get progressRatio(): number {
    return this.elapsedMs / this.timeline.durationMs;
  }

  /** Start or resume playback. */
  play(): void {
    if (this._state === 'playing') return;
    this._state  = 'playing';
    this.lastTs  = null;                // reset so first delta is 0
    this.rafId   = requestAnimationFrame(this.tick);
  }

  /** Pause playback without resetting elapsed time. */
  pause(): void {
    if (this._state !== 'playing') return;
    this._state = 'paused';
    this.cancelRaf();
    // Emit one final frame so the canvas reflects the paused state
    this.emitFrame();
  }

  /** Reset to t=0 and stop. Call play() afterwards to resume. */
  reset(): void {
    this.cancelRaf();
    this.elapsedMs = 0;
    this.lastTs    = null;
    this._state    = 'stopped';
    this.emitFrame();   // render t=0 immediately
  }

  /** Jump to an absolute position (0 → durationMs). */
  seek(timeMs: number): void {
    this.elapsedMs = ((timeMs % this.timeline.durationMs) + this.timeline.durationMs)
      % this.timeline.durationMs;
    this.emitFrame();
  }

  /** Get the interpolated pose for the current elapsed time (no side effects). */
  getCurrentPose(): ReferencePose {
    return getPoseAtTime(this.timeline, this.elapsedMs);
  }

  /** Must be called on React component unmount to cancel pending RAF. */
  dispose(): void {
    this.cancelRaf();
    this._state = 'stopped';
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private tick = (timestamp: number): void => {
    if (this._state !== 'playing') return;

    if (this.lastTs !== null) {
      const delta = Math.min(timestamp - this.lastTs, 100); // cap at 100ms (tab hidden)
      this.elapsedMs = (this.elapsedMs + delta) % this.timeline.durationMs;
    }
    this.lastTs = timestamp;

    this.emitFrame();

    this.rafId = requestAnimationFrame(this.tick);
  };

  private emitFrame(): void {
    const pose = getPoseAtTime(this.timeline, this.elapsedMs);
    const ratio = this.elapsedMs / this.timeline.durationMs;
    this.onFrame(pose, this.elapsedMs, ratio);
  }

  private cancelRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTs = null;
  }
}
