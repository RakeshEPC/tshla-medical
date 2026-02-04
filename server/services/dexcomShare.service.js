/**
 * Dexcom Share Service
 * Pulls CGM glucose data directly from Dexcom Share API
 *
 * Uses two-step authentication:
 * 1. AuthenticatePublisherAccount → gets accountId
 * 2. LoginPublisherAccountById → gets sessionId
 * 3. ReadPublisherLatestGlucoseValues → gets glucose readings
 *
 * Created: 2026-02-03
 */

const DEXCOM_BASE_URL = 'https://share2.dexcom.com/ShareWebServices/Services';
const DEXCOM_APP_ID = 'd89443d2-327c-4a6f-89e5-496bbb0317db';

// Dexcom trend number to direction string mapping
const TREND_MAP = {
  0: 'NONE',
  1: 'DoubleUp',
  2: 'SingleUp',
  3: 'FortyFiveUp',
  4: 'Flat',
  5: 'FortyFiveDown',
  6: 'SingleDown',
  7: 'DoubleDown',
  8: 'NOT COMPUTABLE',
  9: 'RATE OUT OF RANGE',
};

const TREND_ARROW_MAP = {
  'NONE': '→',
  'DoubleUp': '↑↑',
  'SingleUp': '↑',
  'FortyFiveUp': '↗',
  'Flat': '→',
  'FortyFiveDown': '↘',
  'SingleDown': '↓',
  'DoubleDown': '↓↓',
  'NOT COMPUTABLE': '?',
  'RATE OUT OF RANGE': '⚠',
};

class DexcomShareService {
  constructor() {
    // Cache sessions to avoid re-authenticating every request
    // Key: accountName, Value: { sessionId, accountId, expiresAt }
    this.sessionCache = new Map();
  }

  /**
   * Step 1: Authenticate to get account ID
   */
  async authenticateAccount(accountName, password) {
    const url = `${DEXCOM_BASE_URL}/General/AuthenticatePublisherAccount`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountName,
        password,
        applicationId: DEXCOM_APP_ID,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      let errorInfo;
      try { errorInfo = JSON.parse(text); } catch { errorInfo = text; }
      const code = errorInfo?.Code || 'Unknown';
      throw new Error(`Dexcom auth failed (${code}): ${errorInfo?.Message || text}`);
    }

    // Response is a quoted GUID string
    const accountId = text.replace(/"/g, '');
    if (!accountId || accountId === '00000000-0000-0000-0000-000000000000') {
      throw new Error('Dexcom returned invalid account ID');
    }

    return accountId;
  }

  /**
   * Step 2: Login with account ID to get session
   */
  async loginWithAccountId(accountId, password) {
    const url = `${DEXCOM_BASE_URL}/General/LoginPublisherAccountById`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        password,
        applicationId: DEXCOM_APP_ID,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      let errorInfo;
      try { errorInfo = JSON.parse(text); } catch { errorInfo = text; }
      throw new Error(`Dexcom login failed: ${errorInfo?.Message || text}`);
    }

    const sessionId = text.replace(/"/g, '');
    if (!sessionId || sessionId === '00000000-0000-0000-0000-000000000000') {
      throw new Error('Dexcom returned invalid session ID');
    }

    return sessionId;
  }

  /**
   * Get a valid session, using cache when possible
   */
  async getSession(accountName, password) {
    const cached = this.sessionCache.get(accountName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.sessionId;
    }

    // Two-step auth
    const accountId = await this.authenticateAccount(accountName, password);
    const sessionId = await this.loginWithAccountId(accountId, password);

    // Cache for 10 minutes (Dexcom sessions last longer but be safe)
    this.sessionCache.set(accountName, {
      sessionId,
      accountId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return sessionId;
  }

  /**
   * Invalidate cached session (call on auth errors to force re-auth)
   */
  invalidateSession(accountName) {
    this.sessionCache.delete(accountName);
  }

  /**
   * Parse Dexcom date format: "Date(1770163817916)" → JS Date
   */
  parseDexcomDate(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/Date\((\d+)/);
    if (!match) return null;
    return new Date(parseInt(match[1], 10));
  }

  /**
   * Fetch glucose readings from Dexcom Share
   * @param {string} accountName - Dexcom username (phone or email)
   * @param {string} password - Dexcom password
   * @param {number} minutes - How many minutes back to fetch (default 1440 = 24h)
   * @param {number} maxCount - Max readings to return (default 288 = 24h @ 5min)
   * @returns {Promise<Array>} - Normalized glucose entries
   */
  async getGlucoseReadings(accountName, password, minutes = 1440, maxCount = 288) {
    let sessionId = await this.getSession(accountName, password);

    const readUrl = `${DEXCOM_BASE_URL}/Publisher/ReadPublisherLatestGlucoseValues`;

    let response = await fetch(readUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, minutes, maxCount }),
    });

    // If session expired, re-auth and retry once
    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes('SessionIdNotFound') || errorText.includes('SessionNotValid')) {
        this.invalidateSession(accountName);
        sessionId = await this.getSession(accountName, password);

        response = await fetch(readUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, minutes, maxCount }),
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch glucose readings: ${response.status}`);
      }
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }

    const rawEntries = JSON.parse(text);

    // Transform Dexcom format to our normalized format
    return rawEntries.map(entry => {
      const trendName = typeof entry.Trend === 'number'
        ? (TREND_MAP[entry.Trend] || 'NONE')
        : (entry.Trend || 'NONE');

      return {
        glucoseValue: entry.Value,
        glucoseUnits: 'mg/dl',
        trendDirection: trendName,
        trendArrow: TREND_ARROW_MAP[trendName] || '→',
        readingTimestamp: this.parseDexcomDate(entry.WT),
        deviceName: 'Dexcom Share',
        source: 'dexcom_share',
        rawTrend: entry.Trend,
      };
    });
  }

  /**
   * Get current (most recent) glucose reading
   */
  async getCurrentGlucose(accountName, password) {
    const readings = await this.getGlucoseReadings(accountName, password, 30, 1);
    if (readings.length === 0) return null;

    const current = readings[0];
    current.minutesAgo = Math.floor((Date.now() - current.readingTimestamp.getTime()) / 60000);
    return current;
  }

  /**
   * Test Dexcom Share credentials
   */
  async testConnection(accountName, password) {
    try {
      const accountId = await this.authenticateAccount(accountName, password);
      const sessionId = await this.loginWithAccountId(accountId, password);

      return {
        success: true,
        message: 'Dexcom Share authentication successful',
        accountId,
        hasSession: sessionId !== '00000000-0000-0000-0000-000000000000',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = new DexcomShareService();
