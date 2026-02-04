/**
 * LibreLinkUp Service
 * Pulls CGM glucose data directly from Abbott LibreLinkUp API
 * (FreeStyle Libre 2, Libre 3, and other Libre sensors)
 *
 * Uses two-step authentication:
 * 1. Login with email/password → gets auth token
 * 2. Get connections → gets patientId
 * 3. Fetch graph data for patientId → gets glucose readings (~12h)
 *
 * Regional servers: US, EU, DE, FR, JP, AP, AU
 * The login endpoint auto-redirects if wrong region is selected.
 *
 * Created: 2026-02-04
 */

const logger = require('../logger');

// Regional base URLs for LibreLinkUp API
const LIBRE_REGIONS = {
  US: 'https://api-us.libreview.io',
  EU: 'https://api-eu.libreview.io',
  DE: 'https://api-de.libreview.io',
  FR: 'https://api-fr.libreview.io',
  JP: 'https://api-jp.libreview.io',
  AP: 'https://api-ap.libreview.io',
  AU: 'https://api-au.libreview.io',
};

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'product': 'llu.android',
  'version': '4.7.0',
  'Accept-Encoding': 'gzip',
};

// LibreLinkUp TrendArrow (1-5) to direction string mapping
const TREND_MAP = {
  1: 'SingleDown',
  2: 'FortyFiveDown',
  3: 'Flat',
  4: 'FortyFiveUp',
  5: 'SingleUp',
};

const TREND_ARROW_MAP = {
  1: '↓',
  2: '↘',
  3: '→',
  4: '↗',
  5: '↑',
};

class LibreLinkUpService {
  constructor() {
    // Cache sessions to avoid re-authenticating every request
    // Key: email (lowercase), Value: { token, patientId, region, patientName, expiresAt }
    this.sessionCache = new Map();
  }

  /**
   * Get base URL for a region
   */
  getBaseUrl(region = 'US') {
    return LIBRE_REGIONS[region.toUpperCase()] || LIBRE_REGIONS.US;
  }

  /**
   * Step 1: Login with email/password to get auth token
   * Handles region redirect (API returns status=2 if wrong region)
   */
  async login(email, password, region = 'US') {
    const baseUrl = this.getBaseUrl(region);
    const url = `${baseUrl}/llu/auth/login`;

    const response = await fetch(url, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorInfo;
      try { errorInfo = JSON.parse(text); } catch { errorInfo = text; }

      if (response.status === 401) {
        throw new Error('Invalid LibreLinkUp email or password');
      }
      throw new Error(`LibreLinkUp auth failed (${response.status}): ${errorInfo?.message || errorInfo?.error || text}`);
    }

    const data = await response.json();

    // Handle region redirect (status === 2 means wrong region)
    if (data.status === 2 && data.data?.redirect) {
      const correctRegion = data.data.region;
      if (correctRegion && correctRegion.toUpperCase() !== region.toUpperCase()) {
        logger.info('LibreLinkUp', 'Region redirect', { from: region, to: correctRegion });
        return this.login(email, password, correctRegion.toUpperCase());
      }
    }

    if (!data.data?.authTicket?.token) {
      throw new Error('LibreLinkUp login succeeded but no auth token returned');
    }

    return {
      token: data.data.authTicket.token,
      expires: data.data.authTicket.expires,
      region: region,
      accountId: data.data.user?.id,
    };
  }

  /**
   * Step 2: Get connected patient from connections list
   * LibreLinkUp works on a "follower" model — the logged-in user follows one or more patients
   */
  async getPatientId(token, region = 'US') {
    const baseUrl = this.getBaseUrl(region);
    const url = `${baseUrl}/llu/connections`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch LibreLinkUp connections: ${response.status}`);
    }

    const data = await response.json();
    const connections = data.data || [];

    if (connections.length === 0) {
      throw new Error('No LibreLinkUp connections found. Please make sure you have shared your FreeStyle Libre data via the LibreLinkUp app.');
    }

    // Use first connection (most users have exactly one)
    return {
      patientId: connections[0].patientId,
      firstName: connections[0].firstName,
      lastName: connections[0].lastName,
      currentGlucose: connections[0].glucoseMeasurement,
    };
  }

  /**
   * Get a valid session, using cache when possible (10-minute TTL, same as Dexcom)
   */
  async getSession(email, password, region = 'US') {
    const cacheKey = email.toLowerCase();
    const cached = this.sessionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const auth = await this.login(email, password, region);
    const patient = await this.getPatientId(auth.token, auth.region);

    const session = {
      token: auth.token,
      patientId: patient.patientId,
      region: auth.region,
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10-minute cache
    };

    this.sessionCache.set(cacheKey, session);
    return session;
  }

  /**
   * Invalidate cached session (call on auth errors to force re-auth)
   */
  invalidateSession(email) {
    this.sessionCache.delete(email.toLowerCase());
  }

  /**
   * Fetch glucose readings from LibreLinkUp
   * Returns ~12 hours of graph data (API limitation — no configurable window)
   */
  async getGlucoseReadings(email, password, region = 'US') {
    let session = await this.getSession(email, password, region);
    const baseUrl = this.getBaseUrl(session.region);
    const url = `${baseUrl}/llu/connections/${session.patientId}/graph`;

    let response = await fetch(url, {
      method: 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${session.token}`,
      },
    });

    // If token expired, re-auth and retry once (same pattern as Dexcom)
    if (response.status === 401) {
      this.invalidateSession(email);
      session = await this.getSession(email, password, region);

      response = await fetch(`${this.getBaseUrl(session.region)}/llu/connections/${session.patientId}/graph`, {
        method: 'GET',
        headers: {
          ...DEFAULT_HEADERS,
          'Authorization': `Bearer ${session.token}`,
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch LibreLinkUp readings: ${response.status}`);
    }

    const data = await response.json();

    // data.data.connection has current reading
    // data.data.graphData has array of historical readings (~12 hours)
    const graphData = data.data?.graphData || [];
    const connection = data.data?.connection;

    // Transform to normalized format (same shape as Dexcom output)
    const readings = graphData.map(item => {
      const trendNum = item.TrendArrow || 3;
      return {
        glucoseValue: item.Value || item.ValueInMgPerDl,
        glucoseUnits: 'mg/dl',
        trendDirection: TREND_MAP[trendNum] || 'Flat',
        trendArrow: TREND_ARROW_MAP[trendNum] || '→',
        readingTimestamp: new Date(item.Timestamp || item.FactoryTimestamp),
        deviceName: 'FreeStyle Libre',
        source: 'libre_linkup',
        rawTrend: trendNum,
      };
    });

    // Add current reading from connection if available and not already in graphData
    if (connection?.glucoseMeasurement) {
      const gm = connection.glucoseMeasurement;
      const currentTimestamp = new Date(gm.Timestamp || gm.FactoryTimestamp);
      const alreadyIncluded = readings.some(
        r => Math.abs(r.readingTimestamp.getTime() - currentTimestamp.getTime()) < 60000
      );

      if (!alreadyIncluded) {
        const trendNum = gm.TrendArrow || 3;
        readings.unshift({
          glucoseValue: gm.Value || gm.ValueInMgPerDl,
          glucoseUnits: 'mg/dl',
          trendDirection: TREND_MAP[trendNum] || 'Flat',
          trendArrow: TREND_ARROW_MAP[trendNum] || '→',
          readingTimestamp: currentTimestamp,
          deviceName: 'FreeStyle Libre',
          source: 'libre_linkup',
          rawTrend: trendNum,
        });
      }
    }

    // Sort newest first (same as Dexcom output)
    readings.sort((a, b) => b.readingTimestamp.getTime() - a.readingTimestamp.getTime());

    return readings;
  }

  /**
   * Get current (most recent) glucose reading
   */
  async getCurrentGlucose(email, password, region = 'US') {
    const readings = await this.getGlucoseReadings(email, password, region);
    if (readings.length === 0) return null;

    const current = readings[0];
    current.minutesAgo = Math.floor((Date.now() - current.readingTimestamp.getTime()) / 60000);
    return current;
  }

  /**
   * Test LibreLinkUp credentials
   */
  async testConnection(email, password, region = 'US') {
    try {
      const auth = await this.login(email, password, region);
      const patient = await this.getPatientId(auth.token, auth.region);

      return {
        success: true,
        message: 'LibreLinkUp authentication successful',
        patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
        region: auth.region,
        hasConnection: !!patient.patientId,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = new LibreLinkUpService();
