/**
 * Nightscout Integration Service
 * Fetches CGM data from Nightscout instances
 *
 * Nightscout API Documentation:
 * - Entries endpoint: /api/v1/entries.json
 * - Authentication: API_SECRET header or token parameter
 * - Default limit: 10 entries from last 2 days
 *
 * Created: 2026-02-02
 */

const crypto = require('crypto');

class NightscoutService {
  constructor() {
    // Encryption key for storing API secrets (should be in .env)
    this.encryptionKey = process.env.CGM_ENCRYPTION_KEY || 'CHANGE_THIS_TO_SECURE_32_CHAR_KEY';
    this.algorithm = 'aes-256-cbc';
  }

  /**
   * Normalize Nightscout URL to full HTTPS URL
   * @param {string} url - User-provided URL (can be domain only or full URL)
   * @returns {string} - Full HTTPS URL
   */
  normalizeNightscoutUrl(url) {
    // Remove trailing slashes
    url = url.trim().replace(/\/+$/, '');

    // If no protocol, add https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    return url;
  }

  /**
   * Encrypt API secret for secure storage
   * @param {string} apiSecret - Plain text API secret
   * @returns {string} - Encrypted secret (base64)
   */
  encryptApiSecret(apiSecret) {
    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(apiSecret, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Return IV + encrypted data (both base64)
      return `${iv.toString('base64')}:${encrypted}`;
    } catch (error) {
      throw new Error('Failed to encrypt API secret');
    }
  }

  /**
   * Decrypt API secret for API calls
   * @param {string} encryptedSecret - Encrypted secret from database
   * @returns {string} - Plain text API secret
   */
  decryptApiSecret(encryptedSecret) {
    try {
      const [ivBase64, encryptedData] = encryptedSecret.split(':');
      const iv = Buffer.from(ivBase64, 'base64');
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt API secret');
    }
  }

  /**
   * Hash API secret with SHA1 for Nightscout authentication
   * Nightscout requires SHA1 hash of the API secret, not plain text
   * @param {string} apiSecret - Plain text API secret
   * @returns {string} - SHA1 hash (hex format)
   */
  hashApiSecret(apiSecret) {
    return crypto.createHash('sha1').update(apiSecret).digest('hex');
  }

  /**
   * Test connection to Nightscout instance
   * @param {string} nightscoutUrl - Nightscout URL
   * @param {string} apiSecret - API secret
   * @returns {Promise<{success: boolean, message: string, serverInfo?: object}>}
   */
  async testConnection(nightscoutUrl, apiSecret) {
    try {
      const url = this.normalizeNightscoutUrl(nightscoutUrl);
      const statusUrl = `${url}/api/v1/status.json`;
      const hashedSecret = this.hashApiSecret(apiSecret);


      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api-secret': hashedSecret,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            message: 'Authentication failed. Please check your API secret.',
          };
        }
        return {
          success: false,
          message: `Connection failed with status ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Successfully connected to Nightscout',
        serverInfo: {
          name: data.name,
          version: data.version,
          serverTime: data.serverTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error.message}`,
      };
    }
  }

  /**
   * Fetch recent glucose entries from Nightscout
   * @param {string} nightscoutUrl - Nightscout URL
   * @param {string} apiSecret - API secret
   * @param {number} hoursBack - How many hours of data to fetch (default 24)
   * @param {number} maxCount - Maximum number of entries to fetch (default 288 = 24h @ 5min intervals)
   * @returns {Promise<Array>} - Array of glucose entries
   */
  async getGlucoseEntries(nightscoutUrl, apiSecret, hoursBack = 24, maxCount = 288) {
    try {
      const url = this.normalizeNightscoutUrl(nightscoutUrl);
      const hashedSecret = this.hashApiSecret(apiSecret);

      // Calculate time range
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - hoursBack * 60 * 60 * 1000);

      // Build API URL with filters
      // Nightscout uses MongoDB query syntax in URL params
      const entriesUrl = `${url}/api/v1/entries/sgv.json?find[dateString][$gte]=${startDate.toISOString()}&count=${maxCount}`;

      const response = await fetch(entriesUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api-secret': hashedSecret,
        },
      });

      if (!response.ok) {
        throw new Error(`Nightscout API returned status ${response.status}`);
      }

      const entries = await response.json();


      // Transform Nightscout format to our format
      return entries.map(entry => ({
        nightscoutId: entry._id,
        glucoseValue: entry.sgv,
        glucoseUnits: 'mg/dl',
        trendDirection: entry.direction,
        trendArrow: this.getTrendArrow(entry.direction),
        readingTimestamp: new Date(entry.date || entry.dateString),
        deviceName: entry.device || 'Unknown',
        noiseLevel: entry.noise,
        nightscoutUrl: url,
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current (most recent) glucose reading
   * @param {string} nightscoutUrl - Nightscout URL
   * @param {string} apiSecret - API secret
   * @returns {Promise<object|null>} - Current glucose reading or null
   */
  async getCurrentGlucose(nightscoutUrl, apiSecret) {
    try {
      const entries = await this.getGlucoseEntries(nightscoutUrl, apiSecret, 1, 1);
      return entries.length > 0 ? entries[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate glucose statistics from entries
   * @param {Array} entries - Array of glucose entries
   * @returns {object} - Statistics object
   */
  calculateStatistics(entries) {
    if (!entries || entries.length === 0) {
      return {
        totalReadings: 0,
        avgGlucose: null,
        medianGlucose: null,
        stdDeviation: null,
        timeInRangePercent: null,
        timeAboveRangePercent: null,
        timeBelowRangePercent: null,
        lowEventsCount: 0,
        veryLowEventsCount: 0,
        highEventsCount: 0,
        veryHighEventsCount: 0,
      };
    }

    const values = entries.map(e => e.glucoseValue).sort((a, b) => a - b);
    const totalReadings = values.length;

    // Average
    const sum = values.reduce((a, b) => a + b, 0);
    const avgGlucose = Math.round((sum / totalReadings) * 10) / 10;

    // Median
    const mid = Math.floor(totalReadings / 2);
    const medianGlucose = totalReadings % 2 === 0
      ? Math.round(((values[mid - 1] + values[mid]) / 2) * 10) / 10
      : values[mid];

    // Standard Deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - avgGlucose, 2), 0) / totalReadings;
    const stdDeviation = Math.round(Math.sqrt(variance) * 10) / 10;

    // Time in Range
    const inRange = values.filter(v => v >= 70 && v <= 180).length;
    const belowRange = values.filter(v => v < 70).length;
    const aboveRange = values.filter(v => v > 180).length;

    const timeInRangePercent = Math.round((inRange / totalReadings) * 100 * 100) / 100;
    const timeBelowRangePercent = Math.round((belowRange / totalReadings) * 100 * 100) / 100;
    const timeAboveRangePercent = Math.round((aboveRange / totalReadings) * 100 * 100) / 100;

    // Event Counts
    const lowEventsCount = values.filter(v => v < 70).length;
    const veryLowEventsCount = values.filter(v => v < 54).length;
    const highEventsCount = values.filter(v => v > 180).length;
    const veryHighEventsCount = values.filter(v => v > 250).length;

    // Estimated A1C (GMI formula: (avgGlucose + 46.7) / 28.7)
    const estimatedA1c = Math.round(((avgGlucose + 46.7) / 28.7) * 10) / 10;

    return {
      totalReadings,
      avgGlucose,
      medianGlucose,
      stdDeviation,
      timeInRangePercent,
      timeBelowRangePercent,
      timeAboveRangePercent,
      lowEventsCount,
      veryLowEventsCount,
      highEventsCount,
      veryHighEventsCount,
      estimatedA1c,
    };
  }

  /**
   * Get glucose statistics for a time period
   * @param {string} nightscoutUrl - Nightscout URL
   * @param {string} apiSecret - API secret
   * @param {number} days - Number of days to analyze (default 14)
   * @returns {Promise<object>} - Statistics object
   */
  async getGlucoseStats(nightscoutUrl, apiSecret, days = 14) {
    try {
      const hoursBack = days * 24;
      const maxCount = days * 288; // Assume reading every 5 minutes

      const entries = await this.getGlucoseEntries(nightscoutUrl, apiSecret, hoursBack, maxCount);
      return this.calculateStatistics(entries);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Convert Nightscout trend direction to arrow symbol
   * @param {string} direction - Nightscout direction string
   * @returns {string} - Arrow symbol
   */
  getTrendArrow(direction) {
    const arrowMap = {
      'Flat': '→',
      'FortyFiveUp': '↗',
      'SingleUp': '↑',
      'DoubleUp': '↑↑',
      'FortyFiveDown': '↘',
      'SingleDown': '↓',
      'DoubleDown': '↓↓',
      'NONE': '→',
      'NOT COMPUTABLE': '?',
    };

    return arrowMap[direction] || '→';
  }

  /**
   * Check if glucose value warrants an alert
   * @param {number} glucoseValue - Glucose reading
   * @returns {object|null} - Alert object or null if no alert needed
   */
  checkForAlert(glucoseValue) {
    if (glucoseValue < 54) {
      return {
        type: 'urgent_low',
        severity: 'urgent',
        message: `Critical low glucose: ${glucoseValue} mg/dl`,
      };
    }

    if (glucoseValue < 70) {
      return {
        type: 'low',
        severity: 'warning',
        message: `Low glucose: ${glucoseValue} mg/dl`,
      };
    }

    if (glucoseValue > 250) {
      return {
        type: 'very_high',
        severity: 'critical',
        message: `Very high glucose: ${glucoseValue} mg/dl`,
      };
    }

    if (glucoseValue > 180) {
      return {
        type: 'high',
        severity: 'info',
        message: `High glucose: ${glucoseValue} mg/dl`,
      };
    }

    return null;
  }
}

// Export singleton instance
module.exports = new NightscoutService();
