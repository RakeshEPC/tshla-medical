/**
 * Sanitization Service
 *
 * Provides functions to sanitize user input and prevent injection attacks.
 * Part of HIPAA Phase 9: Input Validation & Sanitization
 *
 * HIPAA Compliance: §164.312(c)(1) - Integrity Controls
 *
 * Prevents:
 * - XSS (Cross-Site Scripting) attacks
 * - CSV injection
 * - SQL injection (when combined with parameterized queries)
 * - HTML injection
 */

import DOMPurify from 'dompurify';
import { logWarn } from './logger.service';

/**
 * Sanitization Service
 */
export const sanitizationService = {
  /**
   * Sanitize HTML content
   *
   * Removes dangerous HTML tags and attributes while preserving safe formatting.
   *
   * @param dirty - Raw HTML string
   * @param allowedTags - Optional array of allowed HTML tags
   * @returns Sanitized HTML string safe for rendering
   */
  sanitizeHTML(
    dirty: string,
    allowedTags: string[] = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li']
  ): string {
    if (!dirty) return '';

    try {
      const config = {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: [], // No attributes allowed by default
        KEEP_CONTENT: true, // Preserve text content even if tag is removed
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false
      };

      const sanitized = DOMPurify.sanitize(dirty, config);

      // Log if sanitization changed the content (potential attack detected)
      if (sanitized !== dirty) {
        logWarn('Sanitization', 'HTML content was sanitized (potential XSS attempt)', {
          originalLength: dirty.length,
          sanitizedLength: sanitized.length
        });
      }

      return sanitized;
    } catch (error) {
      logWarn('Sanitization', 'Error sanitizing HTML, returning empty string', { error });
      return '';
    }
  },

  /**
   * Sanitize text for CSV export
   *
   * Prevents CSV injection by prepending dangerous characters with a quote.
   * CSV injection occurs when formulas (=, +, -, @) are interpreted by Excel.
   *
   * @param value - Cell value to sanitize
   * @returns Safe CSV cell value
   */
  sanitizeCSV(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';

    const str = String(value);

    // If value starts with dangerous characters, prepend with single quote
    if (/^[=+\-@]/.test(str)) {
      return `'${str}`;
    }

    // Escape double quotes by doubling them (CSV standard)
    if (str.includes('"')) {
      return str.replace(/"/g, '""');
    }

    return str;
  },

  /**
   * Sanitize user input for safe storage
   *
   * Removes or escapes potentially dangerous characters.
   * NOTE: This should be used IN ADDITION TO parameterized queries, not as a replacement.
   *
   * @param input - User input string
   * @returns Sanitized string
   */
  sanitizeUserInput(input: string): string {
    if (!input) return '';

    return input
      .trim()
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove other control characters
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ');
  },

  /**
   * Sanitize file name
   *
   * Removes dangerous characters from file names to prevent directory traversal
   * and other file system attacks.
   *
   * @param filename - Original filename
   * @returns Safe filename
   */
  sanitizeFilename(filename: string): string {
    if (!filename) return 'unnamed_file';

    return filename
      // Remove path separators
      .replace(/[\/\\]/g, '_')
      // Remove dangerous characters
      .replace(/[^\w\s.-]/g, '')
      // Remove leading/trailing dots and spaces
      .replace(/^[\s.]+|[\s.]+$/g, '')
      // Limit length
      .substring(0, 200)
      // If empty after sanitization, use default
      || 'unnamed_file';
  },

  /**
   * Sanitize URL
   *
   * Ensures URL is safe and uses allowed protocols.
   *
   * @param url - URL to sanitize
   * @param allowedProtocols - Allowed URL protocols
   * @returns Sanitized URL or empty string if invalid
   */
  sanitizeURL(url: string, allowedProtocols: string[] = ['https:', 'http:']): string {
    if (!url) return '';

    try {
      const parsed = new URL(url);

      // Check if protocol is allowed
      if (!allowedProtocols.includes(parsed.protocol)) {
        logWarn('Sanitization', 'URL with disallowed protocol blocked', {
          protocol: parsed.protocol,
          url: url.substring(0, 50)
        });
        return '';
      }

      // Return the sanitized URL
      return parsed.toString();
    } catch (error) {
      logWarn('Sanitization', 'Invalid URL blocked', {
        error,
        url: url.substring(0, 50)
      });
      return '';
    }
  },

  /**
   * Sanitize email address
   *
   * Validates and normalizes email addresses.
   *
   * @param email - Email address to sanitize
   * @returns Sanitized email or empty string if invalid
   */
  sanitizeEmail(email: string): string {
    if (!email) return '';

    // Basic email regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    const sanitized = email.trim().toLowerCase();

    if (!emailRegex.test(sanitized)) {
      logWarn('Sanitization', 'Invalid email format blocked', {
        email: email.substring(0, 20) + '...'
      });
      return '';
    }

    return sanitized;
  },

  /**
   * Sanitize phone number
   *
   * Extracts and formats phone number digits.
   *
   * @param phone - Phone number to sanitize
   * @returns Sanitized phone number with only digits and + prefix
   */
  sanitizePhoneNumber(phone: string): string {
    if (!phone) return '';

    // Extract only digits and + sign
    const sanitized = phone.replace(/[^\d+]/g, '');

    // Ensure + is only at the start
    if (sanitized.includes('+')) {
      const digits = sanitized.replace(/\+/g, '');
      return '+' + digits;
    }

    return sanitized;
  },

  /**
   * Strip all HTML tags
   *
   * Completely removes all HTML tags, leaving only text content.
   * Use this when you want plain text only.
   *
   * @param html - HTML string
   * @returns Plain text with no HTML tags
   */
  stripHTML(html: string): string {
    if (!html) return '';

    // Use DOMPurify with no allowed tags to strip everything
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      KEEP_CONTENT: true
    }).trim();
  },

  /**
   * Escape HTML entities
   *
   * Converts special characters to HTML entities.
   * Use this when you want to display user input as-is without interpretation.
   *
   * @param text - Text to escape
   * @returns HTML-escaped text
   */
  escapeHTML(text: string): string {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Sanitize object for logging
   *
   * Removes sensitive fields from objects before logging.
   * Prevents accidental logging of passwords, tokens, etc.
   *
   * @param obj - Object to sanitize
   * @param sensitiveFields - Fields to redact
   * @returns Sanitized object safe for logging
   */
  sanitizeForLogging(
    obj: Record<string, any>,
    sensitiveFields: string[] = ['password', 'token', 'secret', 'apiKey', 'api_key']
  ): Record<string, any> {
    const sanitized = { ...obj };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  },

  /**
   * Sanitize medical record number (MRN)
   *
   * Validates and formats MRN to standard format.
   *
   * @param mrn - Medical record number
   * @returns Sanitized MRN or empty string if invalid
   */
  sanitizeMRN(mrn: string): string {
    if (!mrn) return '';

    // Remove all non-alphanumeric characters except hyphens
    const sanitized = mrn.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    // Validate length (typical MRN is 6-20 characters)
    if (sanitized.length < 6 || sanitized.length > 20) {
      logWarn('Sanitization', 'Invalid MRN format', {
        length: sanitized.length
      });
      return '';
    }

    return sanitized;
  },

  /**
   * Batch sanitize CSV row
   *
   * Sanitizes all values in a CSV row.
   *
   * @param row - Array of cell values
   * @returns Array of sanitized values
   */
  sanitizeCSVRow(row: (string | number | null | undefined)[]): string[] {
    return row.map((cell) => this.sanitizeCSV(cell));
  },

  /**
   * Sanitize search query
   *
   * Sanitizes user input for search functionality.
   *
   * @param query - Search query
   * @returns Sanitized query
   */
  sanitizeSearchQuery(query: string): string {
    if (!query) return '';

    return query
      // Remove dangerous characters for SQL-like searches
      .replace(/[';"\\\0]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Trim
      .trim()
      // Limit length
      .substring(0, 200);
  }
};

/**
 * Type guard to check if value is a string
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if value is a number
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}
