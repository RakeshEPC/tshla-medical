/**
 * Device Fingerprint Service
 *
 * Generates unique device fingerprints for session tracking and security.
 * Part of HIPAA Phase 6: Session Management Hardening
 *
 * HIPAA Compliance: §164.312(a)(2)(iii) - Automatic Logoff
 *                   §164.312(b) - Audit Controls
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { logInfo, logError } from './logger.service';

/**
 * Device information collected for fingerprinting
 */
export interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  timezone: string;
  timestamp: string;
}

/**
 * Cached fingerprint to avoid regenerating
 */
let cachedFingerprint: string | null = null;

/**
 * Device Fingerprint Service
 *
 * Creates a unique identifier for the current device/browser combination.
 * Used for session tracking and detecting suspicious login attempts.
 */
export const deviceFingerprintService = {
  /**
   * Get the device fingerprint
   * Returns cached value if available, otherwise generates new one
   *
   * @returns Promise<string> - Unique device fingerprint
   */
  async getFingerprint(): Promise<string> {
    if (cachedFingerprint) {
      return cachedFingerprint;
    }

    try {
      // Initialize FingerprintJS
      const fp = await FingerprintJS.load();

      // Get the fingerprint
      const result = await fp.get();
      cachedFingerprint = result.visitorId;

      logInfo('DeviceFingerprint', 'Device fingerprint generated', {
        fingerprintLength: cachedFingerprint.length
      });

      return cachedFingerprint;
    } catch (error) {
      logError('DeviceFingerprint', 'Failed to generate fingerprint', { error });
      // Fallback to a simple hash of user agent
      return this.getFallbackFingerprint();
    }
  },

  /**
   * Get complete device information
   * Includes fingerprint and additional device metadata
   *
   * @returns Promise<DeviceInfo> - Device information object
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    const fingerprint = await this.getFingerprint();

    const deviceInfo: DeviceInfo = {
      fingerprint,
      userAgent: navigator.userAgent,
      platform: navigator.platform || 'unknown',
      language: navigator.language || 'unknown',
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      timestamp: new Date().toISOString()
    };

    return deviceInfo;
  },

  /**
   * Get current IP address (using public API)
   *
   * @returns Promise<string> - IP address or 'unknown'
   */
  async getIPAddress(): Promise<string> {
    try {
      // Use ipify API to get public IP
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error('Failed to fetch IP address');
      }

      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      logError('DeviceFingerprint', 'Failed to get IP address', { error });
      return 'unknown';
    }
  },

  /**
   * Fallback fingerprint using simple user agent hash
   * Used when FingerprintJS fails
   *
   * @returns string - Simple hash of user agent
   */
  getFallbackFingerprint(): string {
    const ua = navigator.userAgent;
    const platform = navigator.platform || '';
    const language = navigator.language || '';

    // Simple hash function
    const str = `${ua}${platform}${language}`;
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `fallback_${Math.abs(hash).toString(16)}`;
  },

  /**
   * Get device type based on user agent
   *
   * @returns 'mobile' | 'tablet' | 'desktop'
   */
  getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const ua = navigator.userAgent.toLowerCase();

    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }

    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }

    return 'desktop';
  },

  /**
   * Get browser name from user agent
   *
   * @returns string - Browser name
   */
  getBrowserName(): string {
    const ua = navigator.userAgent;

    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';

    return 'Unknown';
  },

  /**
   * Get OS name from user agent
   *
   * @returns string - Operating system name
   */
  getOSName(): string {
    const ua = navigator.userAgent;
    const platform = navigator.platform || '';

    if (ua.includes('Win')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS') || platform.includes('iPhone') || platform.includes('iPad')) return 'iOS';

    return 'Unknown';
  },

  /**
   * Get human-readable device description
   *
   * @returns Promise<string> - Device description like "Chrome on macOS (Desktop)"
   */
  async getDeviceDescription(): Promise<string> {
    const browser = this.getBrowserName();
    const os = this.getOSName();
    const type = this.getDeviceType();

    return `${browser} on ${os} (${type})`;
  },

  /**
   * Clear cached fingerprint
   * Used when you want to regenerate fingerprint
   */
  clearCache(): void {
    cachedFingerprint = null;
    logInfo('DeviceFingerprint', 'Fingerprint cache cleared');
  }
};
