/**
 * ExerciseRegistry.ts
 * Static registry of exercise definitions.
 *
 * Each exercise is a fully-typed ExerciseDefinition.
 * More exercises will be added as the library grows.
 */

import { LandmarkIndex } from '../../types/pose';
import type { ExerciseDefinition } from '../../types/exercise';

/** Shoulder Abduction — lift arm laterally to 90°. */
const shoulderAbduction: ExerciseDefinition = {
  id: 'shoulder-abduction',
  name: 'Shoulder Abduction',
  description:
    'Lateral elevation of the arm from the side of the body to shoulder height. ' +
    'Targets the deltoid and supraspinatus.',
  bodyArea: 'shoulder',
  difficulty: 'beginner',
  defaultReps: 10,
  defaultSets: 3,
  phases: [
    {
      id: 'lift',
      label: 'Lift',
      targets: [
        {
          descriptor: {
            proximal: LandmarkIndex.LEFT_HIP,
            joint: LandmarkIndex.LEFT_SHOULDER,
            distal: LandmarkIndex.LEFT_ELBOW,
            label: 'Left Shoulder Abduction',
          },
          minDeg: 80,
          maxDeg: 100,
        },
      ],
    },
    {
      id: 'lower',
      label: 'Lower',
      targets: [
        {
          descriptor: {
            proximal: LandmarkIndex.LEFT_HIP,
            joint: LandmarkIndex.LEFT_SHOULDER,
            distal: LandmarkIndex.LEFT_ELBOW,
            label: 'Left Shoulder Adduction',
          },
          minDeg: 0,
          maxDeg: 20,
        },
      ],
    },
  ],
};

/** Knee Extension — straighten the knee from 90° to full extension. */
const kneeExtension: ExerciseDefinition = {
  id: 'knee-extension',
  name: 'Knee Extension',
  description:
    'Seated or standing extension of the knee joint. ' +
    'Targets the quadriceps. Common post-surgical rehab exercise.',
  bodyArea: 'knee',
  difficulty: 'beginner',
  defaultReps: 12,
  defaultSets: 3,
  phases: [
    {
      id: 'extend',
      label: 'Extend',
      targets: [
        {
          descriptor: {
            proximal: LandmarkIndex.LEFT_HIP,
            joint: LandmarkIndex.LEFT_KNEE,
            distal: LandmarkIndex.LEFT_ANKLE,
            label: 'Left Knee Extension',
          },
          minDeg: 160,
          maxDeg: 180,
        },
      ],
    },
    {
      id: 'flex',
      label: 'Flex',
      targets: [
        {
          descriptor: {
            proximal: LandmarkIndex.LEFT_HIP,
            joint: LandmarkIndex.LEFT_KNEE,
            distal: LandmarkIndex.LEFT_ANKLE,
            label: 'Left Knee Flexion',
          },
          minDeg: 85,
          maxDeg: 95,
        },
      ],
    },
  ],
};

/** Hip Flexion — forward elevation of the leg to 90°. */
const hipFlexion: ExerciseDefinition = {
  id: 'hip-flexion',
  name: 'Hip Flexion',
  description:
    'Forward elevation of the thigh to hip height while keeping the knee straight. ' +
    'Targets hip flexors and core stability.',
  bodyArea: 'hip',
  difficulty: 'intermediate',
  defaultReps: 10,
  defaultSets: 3,
  phases: [
    {
      id: 'raise',
      label: 'Raise',
      targets: [
        {
          descriptor: {
            proximal: LandmarkIndex.LEFT_SHOULDER,
            joint: LandmarkIndex.LEFT_HIP,
            distal: LandmarkIndex.LEFT_KNEE,
            label: 'Left Hip Flexion',
          },
          minDeg: 80,
          maxDeg: 100,
        },
      ],
    },
    {
      id: 'lower',
      label: 'Lower',
      targets: [
        {
          descriptor: {
            proximal: LandmarkIndex.LEFT_SHOULDER,
            joint: LandmarkIndex.LEFT_HIP,
            distal: LandmarkIndex.LEFT_KNEE,
            label: 'Left Hip Return',
          },
          minDeg: 160,
          maxDeg: 180,
        },
      ],
    },
  ],
};

/** Registry map: exerciseId → ExerciseDefinition */
const registry: ReadonlyMap<string, ExerciseDefinition> = new Map([
  [shoulderAbduction.id, shoulderAbduction],
  [kneeExtension.id, kneeExtension],
  [hipFlexion.id, hipFlexion],
]);

export class ExerciseRegistry {
  /** Get all registered exercises as an array. */
  static getAll(): ExerciseDefinition[] {
    return Array.from(registry.values());
  }

  /** Get a specific exercise by ID, or undefined. */
  static getById(id: string): ExerciseDefinition | undefined {
    return registry.get(id);
  }

  /** Get all exercises for a specific body area. */
  static getByBodyArea(
    area: ExerciseDefinition['bodyArea']
  ): ExerciseDefinition[] {
    return Array.from(registry.values()).filter((e) => e.bodyArea === area);
  }
}
