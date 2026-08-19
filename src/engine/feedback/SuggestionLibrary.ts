/**
 * SuggestionLibrary.ts
 *
 * Prototype curated guidance library.
 * NOT a live clinical reference service. NOT a medical database lookup.
 * NOT a diagnostic or prescriptive system.
 *
 * Maps existing detected limitation types to advisory movement suggestions.
 * Used by:
 *   - AnalysisCard (live practice mode)
 *   - FinalSessionReport (session report)
 *   - PresentationQAPanel (developer diagnostics)
 *
 * Single source of truth — do NOT duplicate suggestion text in React components.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A curated advisory movement suggestion.
 * Not a clinical prescription. Not a medical treatment plan.
 */
export interface CorrectiveSuggestion {
  /** Stable identifier used to look up and store this suggestion. */
  id: string;
  /** Short display name shown in the UI. */
  name: string;
  /** One-sentence description of the movement. */
  description: string;
  /**
   * Compact movement cue shown inline.
   * Advisory guidance only — not a clinical instruction.
   */
  shortGuidance: string;
  /**
   * Optional disclaimer to append (defaults to the standard advisory notice).
   * Only populated for entries that need a specific override.
   */
  disclaimer?: string;
}

// ─── Library ──────────────────────────────────────────────────────────────────

/**
 * SUGGESTION_LIBRARY
 *
 * Keyed by stable suggestion ID.
 * Prototype curated guidance. Not a live clinical reference service.
 */
export const SUGGESTION_LIBRARY: Record<string, CorrectiveSuggestion> = {
  shoulder_rom: {
    id: 'shoulder_rom',
    name: 'Controlled shoulder elevation',
    description:
      'Practice slow, controlled arm elevation toward the selected reference range.',
    shortGuidance:
      'Raise the arm gradually without forcing the end position.',
  },

  shoulder_imbalance: {
    id: 'shoulder_imbalance',
    name: 'Scapular control practice',
    description:
      'Practice controlled shoulder-blade positioning with relaxed shoulders.',
    shortGuidance:
      'Keep both shoulders level and avoid excessive shrugging.',
  },

  neck_alignment: {
    id: 'neck_alignment',
    name: 'Chin tucks',
    description:
      'Gently draw the chin straight backward while keeping the head level.',
    shortGuidance:
      'Maintain a neutral head position rather than pushing the chin forward.',
  },

  elbow_deviation: {
    id: 'elbow_deviation',
    name: 'Controlled elbow movement',
    description:
      'Practice controlled elbow flexion and extension without forcing end range.',
    shortGuidance:
      'Use slow, controlled movement and avoid forcing the joint.',
  },

  knee_alignment: {
    id: 'knee_alignment',
    name: 'Controlled knee alignment practice',
    description:
      'Practice controlled lower-limb movement while maintaining alignment.',
    shortGuidance:
      'Keep the knee tracking consistently with the leg during movement.',
  },

  leg_elevation: {
    id: 'leg_elevation',
    name: 'Controlled leg elevation',
    description:
      'Practice slow, controlled leg elevation toward the reference position.',
    shortGuidance:
      'Raise the leg gradually with the knee held straight and without forcing the end position.',
  },
};

// ─── Exercise → Suggestion mapping ───────────────────────────────────────────

/**
 * Maps exercise IDs (from ExerciseDefinition.id) to the primary ROM suggestion ID.
 * Only covers exercises that exist in the current application.
 */
const EXERCISE_SUGGESTION_MAP: Record<string, string> = {
  'shoulder-flexion':  'shoulder_rom',
  'knee-extension':    'knee_alignment',
  'straight-leg-raise': 'leg_elevation',
};

// ─── Lookup Functions ─────────────────────────────────────────────────────────

/**
 * Returns the primary advisory suggestion for the given exercise when a
 * ROM limitation has been detected.
 *
 * Returns `null` for unknown exercise IDs — never provides random suggestions.
 *
 * @param exerciseId - The stable exercise ID (e.g. 'shoulder-flexion').
 * @param limitationDetected - Whether a limitation is currently active.
 */
export function getSuggestionForLimitation(
  exerciseId: string,
  limitationDetected: boolean,
): CorrectiveSuggestion | null {
  if (!limitationDetected) return null;
  const suggestionId = EXERCISE_SUGGESTION_MAP[exerciseId];
  if (!suggestionId) return null;
  return SUGGESTION_LIBRARY[suggestionId] ?? null;
}

/**
 * Returns the primary ROM suggestion for an exercise regardless of live state.
 * Used in the final report where the session already has a recorded limitation.
 *
 * Returns `null` for unknown exercise IDs.
 *
 * @param exerciseId - The stable exercise ID (e.g. 'shoulder-flexion').
 */
export function getExerciseSuggestion(exerciseId: string): CorrectiveSuggestion | null {
  const suggestionId = EXERCISE_SUGGESTION_MAP[exerciseId];
  if (!suggestionId) return null;
  return SUGGESTION_LIBRARY[suggestionId] ?? null;
}

/**
 * Standard advisory disclaimer appended wherever suggestions are displayed.
 * Do not vary this text across components.
 */
export const SUGGESTION_DISCLAIMER =
  'Follow the exercise plan provided by your physiotherapist.';
