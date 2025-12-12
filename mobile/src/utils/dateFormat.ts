/**
 * Utility functions for formatting dates in French
 * These functions provide explicit French formatting regardless of browser/system locale
 */

const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

/**
 * Format a date in French format: "2 décembre 2025, 14:30"
 * If time is 00:00 (midnight), only show the date without time
 * @param date - Date to format
 * @returns Formatted string
 */
export function formatDateFrench(date: Date): string {
  const day = date.getDate();
  const month = FRENCH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // If time is midnight (00:00), don't show time
  if (hours === 0 && minutes === 0) {
    return `${day} ${month} ${year}`;
  }
  
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  return `${day} ${month} ${year}, ${hoursStr}:${minutesStr}`;
}

/**
 * Format a task deadline from its stored string.
 *
 * Why this exists:
 * - Many "date-only" deadlines are stored as ISO midnight in UTC (e.g. 2025-12-12T00:00:00.000Z).
 * - Rendering with `new Date(iso)` converts to local time (e.g. 01:00 in France) and incorrectly shows a time.
 *
 * Heuristic:
 * - If the stored string is midnight (all-zero time), treat it as a date-only deadline and hide time.
 * - Otherwise, show date + time via `formatDateFrench`.
 */
export function formatTaskDeadlineFrench(deadline: string): string {
  const normalized = deadline.trim();

  // Date-only input (YYYY-MM-DD)
  const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return formatDateFrench(new Date(year, month, day));
  }

  // ISO midnight (UTC or local) -> hide time but keep correct day semantics
  const midnightUtc = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T00:00(?::00(?:\.000)?)?Z$/);
  const midnightLocal = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T00:00(?::00(?:\.000)?)?$/);
  const midnightMatch = midnightUtc || midnightLocal;
  if (midnightMatch) {
    const year = Number(midnightMatch[1]);
    const month = Number(midnightMatch[2]) - 1;
    const day = Number(midnightMatch[3]);
    // Use local date constructor to avoid timezone shifts when formatting
    return formatDateFrench(new Date(year, month, day));
  }

  return formatDateFrench(new Date(normalized));
}

/**
 * Format a date in short French format: "2 décembre 2025"
 * @param date - Date to format
 * @returns Formatted string
 */
export function formatDateShortFrench(date: Date): string {
  const day = date.getDate();
  const month = FRENCH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
}
