import { logError, logWarn, logInfo, logDebug } from '../../services/logger.service';
/**
 * Client-side secure storage utilities
 * Replaces localStorage for passenger module
 * All PHI data is stored on server, only non-sensitive data in client
 */

interface PassengerData {
  // Non-PHI settings that can be stored client-side
  mode?: string;
  voiceProfile?: string;
  pitchSt?: number;
  ratePct?: number;
  volume?: number;
  emphasis?: string;
  lang?: string;
  useAdvanced?: boolean;
  advancedShortName?: string;
  style?: string;
  preset?: string;

  // PHI data - stored server-side only
  ava?: string;
  email?: string;
  dob?: string;
  note?: string;
  persona?: string;
}

export class PassengerSecureStorage {
  private static readonly NON_PHI_PREFIX = 'pass_settings_';
  private static readonly SESSION_KEY = 'pass_session_id';

  /**
   * Initialize passenger session and load data
   */
  static async initSession(email?: string): Promise<PassengerData> {
    try {
      // Generate or retrieve session ID
      let sessionId = sessionStorage.getItem(this.SESSION_KEY);
      if (!sessionId) {
        sessionId = `pass_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem(this.SESSION_KEY, sessionId);
      }

      // Load non-PHI settings from localStorage
      const nonPHIData = this.loadNonPHISettings();

      // Load PHI data from server if email provided
      if (email) {
        const phiData = await this.loadPHIFromServer(email);
        return { ...nonPHIData, ...phiData };
      }

      return nonPHIData;
    } catch (error) {
      logError('App', 'Error message', {});
      return this.loadNonPHISettings();
    }
  }

  /**
   * Save passenger data (separates PHI and non-PHI)
   */
  static async saveData(data: PassengerData): Promise<void> {
    // Save non-PHI settings to localStorage
    const nonPHIKeys = [
      'mode',
      'voiceProfile',
      'pitchSt',
      'ratePct',
      'volume',
      'emphasis',
      'lang',
      'useAdvanced',
      'advancedShortName',
      'style',
      'preset',
    ];

    nonPHIKeys.forEach(key => {
      const value = (data as any)[key];
      if (value !== undefined) {
        localStorage.setItem(`${this.NON_PHI_PREFIX}${key}`, String(value));
      }
    });

    // Save PHI to server
    if (data.email) {
      await this.savePHIToServer(data);
    }
  }

  /**
   * Load non-PHI settings from localStorage
   */
  private static loadNonPHISettings(): PassengerData {
    const settings: PassengerData = {};

    try {
      settings.mode = localStorage.getItem(`${this.NON_PHI_PREFIX}mode`) || '';
      settings.voiceProfile =
        (localStorage.getItem(`${this.NON_PHI_PREFIX}voiceProfile`) as any) || 'guy';
      settings.pitchSt = Number(localStorage.getItem(`${this.NON_PHI_PREFIX}pitchSt`) || '0');
      settings.ratePct = Number(localStorage.getItem(`${this.NON_PHI_PREFIX}ratePct`) || '0');
      settings.volume = Number(localStorage.getItem(`${this.NON_PHI_PREFIX}volume`) || '100');
      settings.emphasis = localStorage.getItem(`${this.NON_PHI_PREFIX}emphasis`) || 'moderate';
      settings.lang = (localStorage.getItem(`${this.NON_PHI_PREFIX}lang`) as any) || 'en';
      settings.useAdvanced = localStorage.getItem(`${this.NON_PHI_PREFIX}useAdvanced`) === '1';
      settings.advancedShortName =
        localStorage.getItem(`${this.NON_PHI_PREFIX}advancedShortName`) || '';
      settings.style = localStorage.getItem(`${this.NON_PHI_PREFIX}style`) || 'neutral';
      settings.preset = localStorage.getItem(`${this.NON_PHI_PREFIX}preset`) || '';
    } catch (error) {
      logError('App', 'Error message', {});
    }

    return settings;
  }

  /**
   * Load PHI data from secure server storage
   */
  private static async loadPHIFromServer(email: string): Promise<PassengerData> {
    try {
      const response = await fetch('/api/secure-storage/passenger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', email }),
      });

      if (!response.ok) {
        throw new Error('Failed to load PHI data');
      }

      const data = await response.json();
      return {
        ava: data.ava || '',
        email: data.email || email,
        dob: data.dob || '',
        note: data.note || '',
        persona: data.persona || '',
      };
    } catch (error) {
      logError('App', 'Error message', {});
      return {};
    }
  }

  /**
   * Save PHI data to secure server storage
   */
  private static async savePHIToServer(data: PassengerData): Promise<void> {
    try {
      const phiData = {
        ava: data.ava,
        email: data.email,
        dob: data.dob,
        note: data.note,
        persona: data.persona,
      };

      const response = await fetch('/api/secure-storage/passenger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          email: data.email,
          data: phiData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save PHI data');
      }
    } catch (error) {
      logError('App', 'Error message', {});
      throw error;
    }
  }

  /**
   * Clear all passenger data
   */
  static async clearData(): Promise<void> {
    // Clear non-PHI settings
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.NON_PHI_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));

    // Clear session
    sessionStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Migrate old localStorage data to secure storage
   */
  static async migrateOldData(): Promise<void> {
    const oldKeys = [
      'pass_ava',
      'pass_email',
      'pass_dob',
      'pass_note',
      'pass_mode',
      'pass_persona',
      'pass_persona_preset',
      'pass_voice_profile',
      'pass_voice_pitch',
      'pass_voice_rate',
      'pass_voice_volume',
      'pass_voice_emphasis',
      'pass_voice_lang',
      'pass_voice_advanced',
      'pass_voice_adv_name',
      'pass_voice_style',
      'pass_ask',
      'pass_followup',
    ];

    const foundOldData = oldKeys.some(key => localStorage.getItem(key) !== null);

    if (foundOldData) {
      logDebug('App', 'Debug message', {});

      const data: PassengerData = {
        ava: localStorage.getItem('pass_ava') || '',
        email: localStorage.getItem('pass_email') || '',
        dob: localStorage.getItem('pass_dob') || '',
        note: localStorage.getItem('pass_note') || '',
        mode: localStorage.getItem('pass_mode') || '',
        persona: localStorage.getItem('pass_persona') || '',
        preset: localStorage.getItem('pass_persona_preset') || '',
        voiceProfile: (localStorage.getItem('pass_voice_profile') as any) || 'guy',
        pitchSt: Number(localStorage.getItem('pass_voice_pitch') || '0'),
        ratePct: Number(localStorage.getItem('pass_voice_rate') || '0'),
        volume: Number(localStorage.getItem('pass_voice_volume') || '100'),
        emphasis: localStorage.getItem('pass_voice_emphasis') || 'moderate',
        lang: (localStorage.getItem('pass_voice_lang') as any) || 'en',
        useAdvanced: localStorage.getItem('pass_voice_advanced') === '1',
        advancedShortName: localStorage.getItem('pass_voice_adv_name') || '',
        style: localStorage.getItem('pass_voice_style') || 'neutral',
      };

      // Save migrated data
      await this.saveData(data);

      // Remove old keys
      oldKeys.forEach(key => localStorage.removeItem(key));

      logDebug('App', 'Debug message', {});
    }
  }
}

// Auto-migrate on load
if (typeof window !== 'undefined') {
  PassengerSecureStorage.migrateOldData().catch(console.error);
}
