/**
 * AngleCalculator.ts
 * Computes joint angles from pose landmarks using 3D vector math.
 *
 * A joint angle is the angle at the middle landmark (joint),
 * formed between the vector to the proximal landmark and the
 * vector to the distal landmark.
 */

import type { Landmark, PoseResult } from '../../types/pose';
import type { JointDescriptor, JointAngle, Vec3 } from '../../types/biomechanics';
import { vecSub, angleBetweenVectors } from '../../utils/math';

/** Visibility threshold below which a landmark is considered unreliable. */
const VISIBILITY_THRESHOLD = 0.5;

function landmarkToVec3(lm: Landmark): Vec3 {
  return { x: lm.x, y: lm.y, z: lm.z };
}

function isVisible(lm: Landmark): boolean {
  return (lm.visibility ?? 1) >= VISIBILITY_THRESHOLD;
}

export class AngleCalculator {
  /**
   * Calculate the angle at a single joint from a pose result.
   *
   * @param pose - The pose result containing landmarks.
   * @param descriptor - The joint to calculate.
   * @returns JointAngle with the measured angle in degrees.
   */
  calculate(pose: PoseResult, descriptor: JointDescriptor): JointAngle {
    const proximalLm = pose.landmarks[descriptor.proximal];
    const jointLm = pose.landmarks[descriptor.joint];
    const distalLm = pose.landmarks[descriptor.distal];

    const isValid =
      proximalLm !== undefined &&
      jointLm !== undefined &&
      distalLm !== undefined &&
      isVisible(proximalLm) &&
      isVisible(jointLm) &&
      isVisible(distalLm);

    if (!isValid) {
      return { descriptor, angleDeg: 0, isValid: false };
    }

    const proximalVec = landmarkToVec3(proximalLm);
    const jointVec = landmarkToVec3(jointLm);
    const distalVec = landmarkToVec3(distalLm);

    // Vectors from joint to proximal and joint to distal
    const toProximal = vecSub(proximalVec, jointVec);
    const toDistal = vecSub(distalVec, jointVec);

    const angleDeg = angleBetweenVectors(toProximal, toDistal);

    return { descriptor, angleDeg, isValid: true };
  }

  /**
   * Calculate angles for multiple joint descriptors in one call.
   *
   * @param pose - The pose result.
   * @param descriptors - Array of joints to calculate.
   * @returns Array of JointAngle results.
   */
  calculateAll(pose: PoseResult, descriptors: JointDescriptor[]): JointAngle[] {
    return descriptors.map((d) => this.calculate(pose, d));
  }
}
