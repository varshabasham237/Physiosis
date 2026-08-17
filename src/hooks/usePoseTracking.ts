/**
 * usePoseTracking.ts
 * React hook that coordinates webcam stream, MediaPipe inference loop,
 * EMA landmark smoothing, and canvas skeleton rendering.
 *
 * Performance considerations:
 * - Direct canvas drawing inside requestAnimationFrame without React re-rendering.
 * - Stats (FPS, confidence, landmark count) throttled to 4Hz React state updates.
 * - Complete resource cleanup on unmount or camera stop.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MediaPipeEngine } from '../engine/pose/MediaPipeEngine';
import { LandmarkSmoother } from '../engine/pose/LandmarkSmoother';
import { PoseRenderer } from '../engine/pose/PoseRenderer';
import type { EngineStatus } from '../types/engine';
import type { PoseTrackingStats, Landmark } from '../types/pose';
import { KEY_REHAB_LANDMARKS } from '../types/pose';

const INITIAL_STATS: PoseTrackingStats = {
  fps: 0,
  landmarkCount: 0,
  confidence: 0,
  poseDetected: false,
};

export interface UsePoseTrackingReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  engineStatus: EngineStatus;
  isStreaming: boolean;
  isInitializing: boolean;
  errorMessage: string | null;
  stats: PoseTrackingStats;
  latestLandmarks: Landmark[] | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  toggleCamera: () => Promise<void>;
}

export function usePoseTracking(): UsePoseTrackingReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<PoseTrackingStats>(INITIAL_STATS);

  // Engine references
  const engineRef = useRef<MediaPipeEngine | null>(null);
  const smootherRef = useRef<LandmarkSmoother>(new LandmarkSmoother(0.4));
  const rendererRef = useRef<PoseRenderer>(new PoseRenderer({ mirror: true }));

  // Stream & RAF references
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef(false);

  // Latest landmarks ref for downstream consumers without triggering re-renders
  const latestLandmarksRef = useRef<Landmark[] | null>(null);

  // Throttled stats tracking
  const frameCountRef = useRef(0);
  const lastFpsCalcTimeRef = useRef(performance.now());
  const lastStatsUpdateRef = useRef(0);

  /**
   * Stop the camera stream and animation loop.
   */
  const stopCamera = useCallback(() => {
    isLoopRunningRef.current = false;

    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      rendererRef.current.clear(canvasRef.current);
    }

    smootherRef.current.reset();
    latestLandmarksRef.current = null;

    setIsStreaming(false);
    setIsInitializing(false);
    setEngineStatus('idle');
    setStats(INITIAL_STATS);
  }, []);

  /**
   * Start the camera stream and initialize MediaPipe engine.
   */
  const startCamera = useCallback(async () => {
    if (isStreaming || isInitializing) return;

    setErrorMessage(null);
    setIsInitializing(true);
    setEngineStatus('initializing');

    try {
      // 1. Initialize MediaPipe engine (if not already done)
      if (!engineRef.current) {
        engineRef.current = new MediaPipeEngine();
      }
      await engineRef.current.initialize();

      // 2. Request webcam access
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam API is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element ref is not available.');
      }

      video.srcObject = stream;

      // Wait for video metadata to load
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video
            .play()
            .then(() => resolve())
            .catch(reject);
        };
        video.onerror = () => reject(new Error('Failed to start video playback.'));
      });

      setIsStreaming(true);
      setIsInitializing(false);
      setEngineStatus('running');

      // 3. Start the frame loop
      isLoopRunningRef.current = true;
      frameCountRef.current = 0;
      lastFpsCalcTimeRef.current = performance.now();

      const runFrame = () => {
        if (!isLoopRunningRef.current) return;

        const currentVideo = videoRef.current;
        const currentCanvas = canvasRef.current;
        const engine = engineRef.current;

        if (currentVideo && currentCanvas && engine && currentVideo.readyState >= 2) {
          const now = performance.now();

          // Sync canvas resolution to video
          rendererRef.current.syncCanvasSize(currentCanvas, currentVideo);

          // Run MediaPipe detection
          const result = engine.detect(currentVideo, now);

          if (result && result.landmarks && result.landmarks.length > 0) {
            // Apply EMA temporal smoothing
            const smoothed = smootherRef.current.smooth(result.landmarks);
            latestLandmarksRef.current = smoothed;

            // Render skeleton directly on canvas
            rendererRef.current.render(currentCanvas, smoothed);

            // Compute metrics
            const visibleKeyCount = KEY_REHAB_LANDMARKS.filter(
              (idx) => (smoothed[idx]?.visibility ?? 1) >= 0.45
            ).length;

            const avgConf =
              smoothed.reduce((acc, curr) => acc + (curr.visibility ?? 1), 0) /
              smoothed.length;

            // Frame counter for FPS
            frameCountRef.current += 1;

            // Throttle React state update to ~4Hz (every 250ms)
            if (now - lastStatsUpdateRef.current >= 250) {
              const elapsedSec = (now - lastFpsCalcTimeRef.current) / 1000;
              const calculatedFps = elapsedSec > 0 ? Math.round(frameCountRef.current / elapsedSec) : 0;

              frameCountRef.current = 0;
              lastFpsCalcTimeRef.current = now;
              lastStatsUpdateRef.current = now;

              setStats({
                fps: calculatedFps,
                landmarkCount: visibleKeyCount,
                confidence: Math.round(avgConf * 100),
                poseDetected: true,
              });
            }
          } else {
            // No pose detected in this frame
            rendererRef.current.clear(currentCanvas);
            latestLandmarksRef.current = null;
            smootherRef.current.reset();

            frameCountRef.current += 1;
            if (now - lastStatsUpdateRef.current >= 250) {
              const elapsedSec = (now - lastFpsCalcTimeRef.current) / 1000;
              const calculatedFps = elapsedSec > 0 ? Math.round(frameCountRef.current / elapsedSec) : 0;

              frameCountRef.current = 0;
              lastFpsCalcTimeRef.current = now;
              lastStatsUpdateRef.current = now;

              setStats((prev) => ({
                ...prev,
                fps: calculatedFps,
                landmarkCount: 0,
                poseDetected: false,
              }));
            }
          }
        }

        animationFrameIdRef.current = requestAnimationFrame(runFrame);
      };

      animationFrameIdRef.current = requestAnimationFrame(runFrame);
    } catch (err: unknown) {
      console.error('[usePoseTracking] Camera initialization failed:', err);
      let userMsg = 'Failed to access camera.';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          userMsg = 'Camera permission denied. Please enable camera access in your browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          userMsg = 'No webcam device found on your system.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          userMsg = 'Webcam is currently in use by another application.';
        }
      } else if (err instanceof Error) {
        userMsg = err.message;
      }

      setErrorMessage(userMsg);
      setEngineStatus('error');
      setIsInitializing(false);
      setIsStreaming(false);
      stopCamera();
    }
  }, [isStreaming, isInitializing, stopCamera]);

  /**
   * Toggle camera on/off.
   */
  const toggleCamera = useCallback(async () => {
    if (isStreaming) {
      stopCamera();
    } else {
      await startCamera();
    }
  }, [isStreaming, startCamera, stopCamera]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    engineStatus,
    isStreaming,
    isInitializing,
    errorMessage,
    stats,
    latestLandmarks: latestLandmarksRef.current,
    startCamera,
    stopCamera,
    toggleCamera,
  };
}
