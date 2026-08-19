/**
 * SessionStorage.ts
 * Robust local persistence manager for completed Physiosis rehabilitation sessions.
 *
 * Uses localStorage with strict validation, error isolation, and graceful recovery
 * from corrupted or missing storage.
 */

import type { PhysiosisSession } from './SessionTypes';

const SESSIONS_STORAGE_KEY = 'physiosis.sessions';

/**
 * Save a completed session into localStorage.
 * Only saves if duration > 0 and at least one valid repetition exists.
 *
 * @returns boolean indicating success.
 */
export function saveSession(session: PhysiosisSession): boolean {
  if (!session || session.totalReps <= 0 || session.durationSeconds <= 0) {
    console.warn('[SessionStorage] Skipping save: session has 0 reps or 0 duration.');
    return false;
  }

  try {
    const existing = getSessions();
    // Filter out duplicate ID if already present
    const filtered = existing.filter((s) => s.id !== session.id);
    const updated = [session, ...filtered]; // Newest first

    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('[SessionStorage] Failed to save session to localStorage:', err);
    return false;
  }
}

/**
 * Retrieve all saved rehabilitation sessions, sorted newest first.
 * Returns empty array on empty storage, disabled storage, or corrupt JSON.
 */
export function getSessions(): PhysiosisSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[SessionStorage] Storage contains invalid non-array data. Resetting.');
      return [];
    }

    // Basic structure validation
    return parsed.filter(
      (s): s is PhysiosisSession =>
        s &&
        typeof s.id === 'string' &&
        typeof s.totalReps === 'number' &&
        Array.isArray(s.reps)
    );
  } catch (err) {
    console.warn('[SessionStorage] Error reading sessions from localStorage:', err);
    return [];
  }
}

/**
 * Retrieve a specific session by its unique ID.
 */
export function getSession(id: string): PhysiosisSession | null {
  const sessions = getSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

/**
 * Delete a specific session by ID.
 */
export function deleteSession(id: string): boolean {
  try {
    const existing = getSessions();
    const filtered = existing.filter((s) => s.id !== id);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('[SessionStorage] Error deleting session:', err);
    return false;
  }
}

/**
 * Clear all saved rehabilitation sessions.
 */
export function clearSessions(): boolean {
  try {
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('[SessionStorage] Error clearing sessions:', err);
    return false;
  }
}
