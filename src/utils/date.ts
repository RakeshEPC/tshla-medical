/**
 * Date utilities for consistent DOB formatting and age calculation.
 * Avoids JavaScript timezone issues with ISO date strings (e.g., "1949-07-29"
 * parsed as UTC midnight shifts to the previous day in US timezones).
 */

/**
 * Format a DOB string (YYYY-MM-DD) to M/D/YYYY without timezone shifting.
 */
export function formatDOB(dob: string): string {
  if (!dob) return '';
  const parts = dob.split('-');
  if (parts.length !== 3) return dob;
  const [y, m, d] = parts.map(Number);
  return `${m}/${d}/${y}`;
}

/**
 * Calculate age from a DOB string (YYYY-MM-DD), accounting for
 * whether the birthday has occurred yet this year.
 */
export function calculateAge(dob: string): number {
  const parts = dob.split('-');
  if (parts.length !== 3) return 0;
  const [y, m, d] = parts.map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const currentMonth = today.getMonth() + 1;
  if (currentMonth < m || (currentMonth === m && today.getDate() < d)) {
    age--;
  }
  return age;
}
