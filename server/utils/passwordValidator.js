/**
 * Password Validation Utility
 * Enforces strong password requirements
 * HIPAA Compliance: Ensures secure access credentials
 */

const logger = require('../logger');

// Common passwords list (top 100 most common passwords)
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'passw0rd', 'shadow', '123123', '654321', 'superman',
  'qazwsx', 'michael', 'football', 'welcome', 'jesus', 'ninja', 'mustang',
  'password1', '123456789', 'password123', '12345', '1234567890', 'princess',
  'admin', 'welcome123', 'solo', 'starwars', 'admin123', 'flower', 'hottie',
  'loveme', 'zaq1zaq1', 'password1234', 'qwertyuiop', '1q2w3e4r', 'lovely',
  'Password1', 'Password', 'Password1234', 'Test1234', 'Welcome1', 'Admin123'
];

/**
 * Validate password against security requirements
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, errors: string[], strength: number }
 */
function validatePassword(password) {
  const errors = [];

  // Check if password exists
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      errors: ['Password is required'],
      strength: 0
    };
  }

  // Length requirement (HIPAA recommends 12+)
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // Maximum length (prevent DoS)
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Complexity requirements
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  // Check against common passwords (case-insensitive)
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password');
  }

  // Check for sequential characters (123, abc, etc.)
  const sequential = [
    '123', '234', '345', '456', '567', '678', '789', '890',
    'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij',
    'ijk', 'jkl', 'klm', 'lmn', 'mno', 'nop', 'opq', 'pqr',
    'qrs', 'rst', 'stu', 'tuv', 'uvw', 'vwx', 'wxy', 'xyz'
  ];

  for (const seq of sequential) {
    if (password.toLowerCase().includes(seq)) {
      errors.push('Password cannot contain sequential characters (e.g., 123, abc)');
      break;
    }
  }

  // Check for repeated characters (aaa, 111, etc.)
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain repeated characters (e.g., aaa, 111)');
  }

  // Check for keyboard patterns
  const keyboardPatterns = ['qwerty', 'asdfgh', 'zxcvbn', '1qaz2wsx'];
  for (const pattern of keyboardPatterns) {
    if (password.toLowerCase().includes(pattern)) {
      errors.push('Password cannot contain keyboard patterns (e.g., qwerty)');
      break;
    }
  }

  // Calculate password strength
  const strength = calculatePasswordStrength(password);

  const valid = errors.length === 0;

  if (!valid) {
    logger.info('PasswordValidation', 'Password failed validation', {
      errorCount: errors.length,
      strength
    });
  }

  return {
    valid,
    errors,
    strength
  };
}

/**
 * Calculate password strength score (0-100)
 * @param {string} password
 * @returns {number} Strength score
 */
function calculatePasswordStrength(password) {
  let strength = 0;

  // Length scoring
  if (password.length >= 12) strength += 25;
  if (password.length >= 16) strength += 15;
  if (password.length >= 20) strength += 10;

  // Complexity scoring
  if (/[a-z]/.test(password)) strength += 10;
  if (/[A-Z]/.test(password)) strength += 10;
  if (/[0-9]/.test(password)) strength += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 10;

  // Variety scoring
  const uniqueChars = new Set(password).size;
  strength += Math.min(uniqueChars, 10);

  // Bonus for mixing character types
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const mixedTypes = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  if (mixedTypes === 4) strength += 10;

  return Math.min(strength, 100);
}

/**
 * Get password strength label
 * @param {number} strength - Strength score (0-100)
 * @returns {string} Label
 */
function getStrengthLabel(strength) {
  if (strength < 30) return 'Weak';
  if (strength < 60) return 'Moderate';
  if (strength < 80) return 'Strong';
  return 'Very Strong';
}

/**
 * Generate password requirements message for user
 * @returns {string} Requirements message
 */
function getPasswordRequirements() {
  return `Password must:
- Be at least 12 characters long
- Contain at least one lowercase letter (a-z)
- Contain at least one uppercase letter (A-Z)
- Contain at least one number (0-9)
- Contain at least one special character (!@#$%^&*)
- Not be a common password
- Not contain sequential or repeated characters
- Not contain keyboard patterns`;
}

module.exports = {
  validatePassword,
  calculatePasswordStrength,
  getStrengthLabel,
  getPasswordRequirements
};
