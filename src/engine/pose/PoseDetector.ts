/**
 * PoseDetector.ts
 * Placeholder for the MediaPipe Pose detection integration.
 *
 * Step 2 will replace this stub with a real MediaPipe PoseLandmarker
 * using the @mediapipe/tasks-vision package.
 */

import type { PoseFrame } from '../../types/pose';
import type { EngineStatus } from '../../types/engine';

export type PoseDetectorCallback = (frame: PoseFrame) => void;

/**
 * PoseDetector manages the pose estimation pipeline.
 *
 * Lifecycle:
 *   initialize() → start(videoElement, callback) → stop() → dispose()
 *
 * NOT YET IMPLEMENTED. All methods are stubs that will be wired
 * to MediaPipe in Step 2.
 */
export class PoseDetector {
  private _status: EngineStatus = 'idle';

  get status(): EngineStatus {
    return this._status;
  }

  /**
   * Load the MediaPipe model assets.
   * Will be async once MediaPipe is integrated.
   */
  async initialize(): Promise<void> {
    // TODO (Step 2): Load MediaPipe PoseLandmarker WASM and model.
    this._status = 'ready';
    console.info('[PoseDetector] initialize() — stub, no model loaded.');
  }

  /**
   * Begin processing frames from a video element.
   * @param _videoElement - The HTMLVideoElement providing the camera stream.
   * @param _callback - Called with each detected PoseFrame.
   */
  start(_videoElement: HTMLVideoElement, _callback: PoseDetectorCallback): void {
    // TODO (Step 2): Start the MediaPipe detection loop.
    this._status = 'running';
    console.info('[PoseDetector] start() — stub, no frames being processed.');
  }

  /** Pause detection without releasing resources. */
  pause(): void {
    this._status = 'paused';
  }

  /** Resume detection after a pause. */
  resume(): void {
    this._status = 'running';
  }

  /** Stop processing and release the video stream. */
  stop(): void {
    this._status = 'idle';
    console.info('[PoseDetector] stop()');
  }

  /** Release all resources (call before unmounting). */
  dispose(): void {
    this.stop();
    console.info('[PoseDetector] dispose()');
  }
}
