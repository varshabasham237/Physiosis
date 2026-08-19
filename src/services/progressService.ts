/**
 * progressService.ts
 * Service for movement progress analytics and sampled kinematics recording.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { MovementSampleInsert } from '../types/database';

export const progressService = {
  /**
   * Save sampled kinematics metrics (e.g. 2-5Hz sampling).
   * Does NOT store video frames or raw images.
   */
  async saveMovementSamples(samples: MovementSampleInsert[]): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured() || !samples || samples.length === 0) {
      return { success: true, error: null };
    }

    try {
      const { error } = await (supabase.from('movement_samples') as any).insert(samples);
      if (error) return { success: false, error: new Error(error.message) };
      return { success: true, error: null };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error('Failed to record movement samples.'),
      };
    }
  },
};
