// User preferences management with persistent storage

interface UserPreferences {
  defaultTemplate: string;
  autoSaveNotes: boolean;
  defaultSpecialty: string;
  noteFormat: 'soap' | 'narrative' | 'both';
  [key: string]: any;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultTemplate: 'primary-care-general',
  autoSaveNotes: true,
  defaultSpecialty: 'Primary Care',
  noteFormat: 'soap',
};

// Get user email from session
function getUserEmail(): string {
  if (typeof window !== 'undefined') {
    // Check various storage locations for user email
    return (
      sessionStorage.getItem('doctor_email') ||
      sessionStorage.getItem('user_email') ||
      localStorage.getItem('user_email') ||
      'default_user'
    );
  }
  return 'default_user';
}

// Get preference key for current user
function getUserPreferenceKey(): string {
  const email = getUserEmail();
  return `user_preferences_${email}`;
}

// Load user preferences
export function loadUserPreferences(): UserPreferences {
  if (typeof window !== 'undefined') {
    const key = getUserPreferenceKey();
    const saved = localStorage.getItem(key);

    if (saved) {
      try {
        const preferences = JSON.parse(saved);
        return { ...DEFAULT_PREFERENCES, ...preferences };
      } catch (e) {
        logError('App', 'Error message', {});
      }
    }
  }
  return DEFAULT_PREFERENCES;
}

// Save user preferences
export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
  if (typeof window !== 'undefined') {
    const key = getUserPreferenceKey();
    const current = loadUserPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(key, JSON.stringify(updated));

    // Also save a backup with timestamp
    const backupKey = `${key}_backup_${Date.now()}`;
    localStorage.setItem(
      backupKey,
      JSON.stringify({
        preferences: updated,
        savedAt: new Date().toISOString(),
        user: getUserEmail(),
      })
    );

    // Clean old backups (keep only last 5)
    cleanOldBackups();
  }
}

// Get specific preference
export function getUserPreference<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
  const preferences = loadUserPreferences();
  return preferences[key];
}

// Set specific preference
export function setUserPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): void {
  saveUserPreferences({ [key]: value });
}

// Clean old backup entries
function cleanOldBackups(): void {
  if (typeof window !== 'undefined') {
    const key = getUserPreferenceKey();
    const backupPrefix = `${key}_backup_`;
    const allKeys = Object.keys(localStorage);
    const backupKeys = allKeys
      .filter(k => k.startsWith(backupPrefix))
      .sort()
      .reverse();

    // Keep only the 5 most recent backups
    if (backupKeys.length > 5) {
      backupKeys.slice(5).forEach(k => localStorage.removeItem(k));
    }
  }
}

// Export preferences to JSON
export function exportPreferences(): string {
  const preferences = loadUserPreferences();
  const exportData = {
    preferences,
    exportedAt: new Date().toISOString(),
    user: getUserEmail(),
    version: '1.0',
  };
  return JSON.stringify(exportData, null, 2);
}

// Import preferences from JSON
export function importPreferences(jsonString: string): boolean {
  import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';
  try {
    const data = JSON.parse(jsonString);
    if (data.preferences) {
      saveUserPreferences(data.preferences);
      return true;
    }
  } catch (e) {
    logError('App', 'Error message', {});
  }
  return false;
}

// Reset to defaults
export function resetPreferences(): void {
  saveUserPreferences(DEFAULT_PREFERENCES);
}

// Get all templates used by this user
export function getUserTemplateHistory(): string[] {
  if (typeof window !== 'undefined') {
    const key = `${getUserPreferenceKey()}_template_history`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
  }
  return [];
}

// Add template to history
export function addToTemplateHistory(templateId: string): void {
  if (typeof window !== 'undefined') {
    const key = `${getUserPreferenceKey()}_template_history`;
    const history = getUserTemplateHistory();

    // Remove if exists and add to front
    const filtered = history.filter(id => id !== templateId);
    const updated = [templateId, ...filtered].slice(0, 10); // Keep last 10

    localStorage.setItem(key, JSON.stringify(updated));
  }
}
