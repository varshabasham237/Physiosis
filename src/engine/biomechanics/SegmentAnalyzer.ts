/**
 * SegmentAnalyzer.ts
 * Analyzes body segment orientations and symmetry.
 *
 * Placeholder — will be expanded when MediaPipe is active.
 */

import type { PoseResult } from '../../types/pose';
import type { BodySegment, Vec3 } from '../../types/biomechanics';
import { vecSub, vecNormalize } from '../../utils/math';

export interface SegmentOrientation {
  segment: BodySegment;
  /** Unit direction vector of the segment. */
  direction: Vec3;
  /** Angle from vertical (y-axis) in degrees. */
  inclinationDeg: number;
}

export class SegmentAnalyzer {
  /**
   * Compute the orientation of a single body segment.
   *
   * @param pose - Current pose result.
   * @param segment - The segment to analyze.
   * @returns SegmentOrientation or null if landmarks are unavailable.
   */
  analyze(pose: PoseResult, segment: BodySegment): SegmentOrientation | null {
    const fromLm = pose.landmarks[segment.from];
    const toLm = pose.landmarks[segment.to];

    if (!fromLm || !toLm) return null;

    const from: Vec3 = { x: fromLm.x, y: fromLm.y, z: fromLm.z };
    const to: Vec3 = { x: toLm.x, y: toLm.y, z: toLm.z };

    const direction = vecNormalize(vecSub(to, from));

    // Angle from downward vertical (0,1,0) in image space (y increases downward)
    const vertical: Vec3 = { x: 0, y: 1, z: 0 };
    const dot = direction.x * vertical.x + direction.y * vertical.y + direction.z * vertical.z;
    const inclinationDeg = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;

    return { segment, direction, inclinationDeg };
  }

  /**
   * Analyze multiple segments in one pass.
   */
  analyzeAll(
    pose: PoseResult,
    segments: BodySegment[]
  ): Array<SegmentOrientation | null> {
    return segments.map((s) => this.analyze(pose, s));
  }
}
