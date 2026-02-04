/**
 * Phone Number Normalization Utility
 * Bridges the format gap between systems:
 * - unified_patients uses 10-digit: '8326073630'
 * - cgm_readings uses E.164: '+18326073630'
 * - Dexcom Share uses E.164: '+18326073630'
 */

/**
 * Normalize phone to 10-digit US format (matches unified_patients.phone_primary)
 * @param {string} phone - Any phone format
 * @returns {string|null} - 10-digit number or null
 */
function toNormalized(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  return digits; // Return whatever we have
}

/**
 * Convert phone to E.164 format (matches cgm tables and Dexcom)
 * @param {string} phone - Any phone format
 * @returns {string|null} - '+1XXXXXXXXXX' or null
 */
function toE164(phone) {
  const normalized = toNormalized(phone);
  if (!normalized || normalized.length !== 10) return null;
  return `+1${normalized}`;
}

/**
 * Get all phone format variants for multi-format database queries
 * @param {string} phone - Any phone format
 * @returns {string[]} - Array of formats: ['8326073630', '+18326073630', '18326073630']
 */
function allFormats(phone) {
  const normalized = toNormalized(phone);
  if (!normalized) return [];
  return [normalized, `+1${normalized}`, `1${normalized}`];
}

module.exports = { toNormalized, toE164, allFormats };
