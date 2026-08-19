/**
 * format.ts
 * Formatting helpers for numbers, times, and percentages.
 */

/**
 * Format elapsed milliseconds as "MM:SS".
 * E.g. 90000ms → "01:30"
 */
export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format seconds as "MM:SS" countdown string.
 * E.g. 120 → "02:00", 9 → "00:09", 0 → "00:00"
 */
export function formatTimerMMSS(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format a [0, 100] score as a rounded integer string.
 * E.g. 87.3 → "87"
 */
export function formatScore(score: number): string {
  return Math.round(score).toString();
}

/**
 * Format a [0, 1] ratio as a percentage string.
 * E.g. 0.873 → "87%"
 */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Format an angle in degrees to one decimal place.
 * E.g. 87.32 → "87.3°"
 */
export function formatAngle(deg: number): string {
  return `${deg.toFixed(1)}°`;
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
