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
 * @param date - Date to format
 * @returns Formatted string
 */
export function formatDateFrench(date: Date): string {
  const day = date.getDate();
  const month = FRENCH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
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
