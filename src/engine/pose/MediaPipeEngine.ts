/**
 * MediaPipeEngine.ts
 * Manages the MediaPipe PoseLandmarker lifecycle, model loading, and video inference.
 *
 * Runs in VIDEO mode for smooth temporal tracking.
 * Configured with GPU delegate with automatic CPU fallback.
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark, PoseResult } from '../../types/pose';

const WASM_CDN_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export class MediaPipeEngine {
  private landmarker: PoseLandmarker | null = null;
  private isInitialized = false;
  private isInitializing = false;

  /**
   * Initializes MediaPipe PoseLandmarker in VIDEO mode.
   * Attempts GPU delegate first, falls back to CPU if unavailable.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) return;

    this.isInitializing = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN_PATH);

      try {
        // Try GPU delegate for high performance
        this.landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        console.info('[MediaPipeEngine] Initialized with GPU delegate.');
      } catch (gpuError) {
        console.warn('[MediaPipeEngine] GPU delegate failed, falling back to CPU:', gpuError);
        // Fallback to CPU
        this.landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        console.info('[MediaPipeEngine] Initialized with CPU delegate.');
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('[MediaPipeEngine] Failed to initialize PoseLandmarker:', err);
      throw new Error(
        `Failed to load MediaPipe Pose model. Please check network connection and browser WebGL support.`
      );
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Performs pose detection on a video frame at a given timestamp.
   *
   * @param video - HTMLVideoElement containing the current webcam frame.
   * @param timestampMs - High-resolution timestamp (performance.now()).
   * @returns PoseResult if person detected, null otherwise.
   */
  detect(video: HTMLVideoElement, timestampMs: number): PoseResult | null {
    if (!this.landmarker || !this.isInitialized) {
      return null;
    }

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    try {
      const result = this.landmarker.detectForVideo(video, timestampMs);

      if (!result.landmarks || result.landmarks.length === 0 || !result.landmarks[0]) {
        return null;
      }

      const rawLandmarks = result.landmarks[0];
      const landmarks: Landmark[] = rawLandmarks.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility ?? 1.0,
      }));

      let worldLandmarks: Landmark[] | undefined;
      if (result.worldLandmarks && result.worldLandmarks.length > 0 && result.worldLandmarks[0]) {
        worldLandmarks = result.worldLandmarks[0].map((wlm) => ({
          x: wlm.x,
          y: wlm.y,
          z: wlm.z,
          visibility: wlm.visibility ?? 1.0,
        }));
      }

      return {
        landmarks,
        worldLandmarks,
        timestampMs,
      };
    } catch (err) {
      console.warn('[MediaPipeEngine] Error during frame detection:', err);
      return null;
    }
  }

  /**
   * Release WebGL and WASM resources.
   */
  dispose(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch (err) {
        console.warn('[MediaPipeEngine] Error closing landmarker:', err);
      }
      this.landmarker = null;
    }
    this.isInitialized = false;
    this.isInitializing = false;
    console.info('[MediaPipeEngine] Disposed resources.');
  }
}
