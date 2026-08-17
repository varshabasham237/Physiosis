/**
 * PoseRenderer.ts
 * High-performance 2D canvas renderer for the real-time pose skeleton.
 *
 * Features:
 * - High-DPI canvas scaling
 * - Mirrored selfie view (horizontal flip)
 * - Thin, high-visibility clinical cyan/teal connection lines
 * - Small circular landmark nodes with glowing aura
 * - Visibility filtering
 */

import type { Landmark } from '../../types/pose';
import { LandmarkIndex, KEY_REHAB_LANDMARKS, POSE_CONNECTIONS } from '../../types/pose';

const MIN_VISIBILITY = 0.45;

export interface RenderOptions {
  mirror?: boolean;
  lineColor?: string;
  lineWidth?: number;
  jointFillColor?: string;
  jointStrokeColor?: string;
  glowColor?: string;
  jointRadius?: number;
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  mirror: true,
  lineColor: 'rgba(0, 229, 255, 0.85)',       // High-visibility neon cyan
  lineWidth: 2.5,
  jointFillColor: '#FFFFFF',
  jointStrokeColor: 'rgba(0, 229, 255, 1)',   // Bright cyan border
  glowColor: 'rgba(0, 229, 255, 0.45)',       // Cyan glow
  jointRadius: 4,
};

export class PoseRenderer {
  private options: Required<RenderOptions>;

  constructor(options?: RenderOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Resizes canvas to match container or video aspect ratio and adjusts for device pixel ratio.
   */
  syncCanvasSize(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
    const width = video.videoWidth || video.clientWidth || 640;
    const height = video.videoHeight || video.clientHeight || 480;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  /**
   * Clears the entire canvas.
   */
  clear(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Renders the skeleton landmarks and connection lines on the canvas.
   *
   * @param canvas - Target HTMLCanvasElement.
   * @param landmarks - Normalized landmarks array [0, 1].
   */
  render(canvas: HTMLCanvasElement, landmarks: Landmark[]): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || !landmarks || landmarks.length === 0) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Map normalized coordinates [0, 1] to canvas pixel space
    // If mirror is true, flip X (x' = (1 - x) * width)
    const toScreen = (lm: Landmark): { x: number; y: number; visible: boolean } => {
      const isVis = (lm.visibility ?? 1.0) >= MIN_VISIBILITY;
      const x = this.options.mirror ? (1 - lm.x) * width : lm.x * width;
      const y = lm.y * height;
      return { x, y, visible: isVis };
    };

    // 1. Draw connection lines
    ctx.lineWidth = this.options.lineWidth;
    ctx.strokeStyle = this.options.lineColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Add slight neon glow for clinical aesthetic
    ctx.shadowColor = this.options.glowColor;
    ctx.shadowBlur = 6;

    for (const [idxA, idxB] of POSE_CONNECTIONS) {
      const lmA = landmarks[idxA];
      const lmB = landmarks[idxB];
      if (!lmA || !lmB) continue;

      const ptA = toScreen(lmA);
      const ptB = toScreen(lmB);

      if (ptA.visible && ptB.visible) {
        ctx.beginPath();
        ctx.moveTo(ptA.x, ptA.y);
        ctx.lineTo(ptB.x, ptB.y);
        ctx.stroke();
      }
    }

    // Connect Nose to midpoint of shoulders (Neckline)
    const nose = landmarks[LandmarkIndex.NOSE];
    const leftShoulder = landmarks[LandmarkIndex.LEFT_SHOULDER];
    const rightShoulder = landmarks[LandmarkIndex.RIGHT_SHOULDER];

    if (nose && leftShoulder && rightShoulder) {
      const ptNose = toScreen(nose);
      const ptLS = toScreen(leftShoulder);
      const ptRS = toScreen(rightShoulder);

      if (ptNose.visible && ptLS.visible && ptRS.visible) {
        const neckX = (ptLS.x + ptRS.x) / 2;
        const neckY = (ptLS.y + ptRS.y) / 2;

        ctx.beginPath();
        ctx.moveTo(ptNose.x, ptNose.y);
        ctx.lineTo(neckX, neckY);
        ctx.stroke();
      }
    }

    // Reset shadow for points
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.options.glowColor;

    // 2. Draw key rehabilitation landmarks
    for (const idx of KEY_REHAB_LANDMARKS) {
      const lm = landmarks[idx];
      if (!lm) continue;

      const pt = toScreen(lm);
      if (!pt.visible) continue;

      // Outer glow circle
      ctx.fillStyle = this.options.jointStrokeColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, this.options.jointRadius + 1.5, 0, 2 * Math.PI);
      ctx.fill();

      // Inner white core
      ctx.fillStyle = this.options.jointFillColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, this.options.jointRadius - 0.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.restore();
  }
}
