/**
 * Doctor Profile Service
 * Manages doctor-specific settings, templates, and preferences
 */

export interface DoctorTemplate {
  id: string;
  name: string;
  description?: string;
  visitType?: 'new-patient' | 'follow-up' | 'consultation' | 'emergency' | 'general';
  isDefault?: boolean;
  sections: {
    [key: string]: {
      title: string;
      aiInstructions: string;
      required: boolean;
      order: number;
      keywords?: string[];
      format?: 'paragraph' | 'bullets' | 'numbered';
      exampleText?: string;
    };
  };
  generalInstructions?: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface DoctorSettings {
  defaultTemplateId?: string;
  defaultTemplateByVisitType?: {
    'new-patient'?: string;
    'follow-up'?: string;
    consultation?: string;
    emergency?: string;
    general?: string;
  };
  aiStyle: 'formal' | 'conversational' | 'concise' | 'detailed';
  autoProcessAfterRecording: boolean;
  voiceSettings?: {
    provider?: 'elevenlabs' | 'azure';
    voiceId?: string;
    speed?: number;
    pitch?: number;
  };
  displayPreferences?: {
    showInterimTranscript: boolean;
    highlightMedicalTerms: boolean;
    autoSaveInterval?: number; // in seconds
  };
  recordingPreferences?: {
    mode: 'dictation' | 'conversation';
    autoStopAfterSilence?: number; // in seconds
    showVideoPreview?: boolean;
  };
}

export interface DoctorProfile {
  doctorId: string;
  settings: DoctorSettings;
  templates: DoctorTemplate[];
  recentTemplates: string[]; // Template IDs
  favoriteTemplates: string[]; // Template IDs
}

// Import the API service
import { templateAPIService } from './templateAPI.service';
// Import standard templates
import { getDefaultTemplatesForDoctor, standardTemplates } from '../data/standardTemplates';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

class DoctorProfileService {
  private readonly STORAGE_KEY_PREFIX = 'doctor_profile_';
  private readonly MAX_TEMPLATES_PER_DOCTOR = 50;
  private readonly MAX_RECENT_TEMPLATES = 5;
  private currentDoctorId: string | null = null;
  private profileCache: Map<string, DoctorProfile> = new Map();

  /**
   * Initialize service with current doctor
   */
  initialize(doctorId: string): void {
    this.currentDoctorId = doctorId;
  }

  /**
   * Get the storage key for a doctor
   */
  private getStorageKey(doctorId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${doctorId}`;
  }

  /**
   * Get doctor profile (creates default if not exists)
   */
  async getProfile(doctorId?: string): Promise<DoctorProfile> {
    const id = doctorId || this.currentDoctorId || 'default-doctor';

    // Log the ID being used for debugging
    logDebug('doctorProfile', 'Debug message', {});

    if (!id || id === 'undefined' || id === 'null') {
      logWarn('doctorProfile', 'Warning message', {});
      const fallbackId = 'default-doctor';
      return this.getProfile(fallbackId);
    }

    // Check cache first
    if (this.profileCache.has(id)) {
      const cachedProfile = this.profileCache.get(id)!;
      // Ensure profile has all standard templates
      const migratedProfile = this.ensureStandardTemplates(cachedProfile);
      if (migratedProfile !== cachedProfile) {
        this.profileCache.set(id, migratedProfile);
      }
      return migratedProfile;
    }

    // NEW: Load profile with database-first template loading
    logDebug('doctorProfile', 'Debug message', {});

    // Try to load doctor profile from API
    let profile = await templateAPIService.loadProfile(id);
    let templatesFromDB: DoctorTemplate[] = [];

    // Load templates from database
    templatesFromDB = await this.loadTemplatesFromDatabase(id);

    if (templatesFromDB.length === 0) {
      logDebug('doctorProfile', 'Debug message', {});
      // If no templates in database, create profile with default templates
      if (!profile) {
        profile = this.createDefaultProfileWithoutTemplates(id);
      }
      // Use legacy method as fallback
      const migratedProfile = this.ensureStandardTemplates(profile);
      this.profileCache.set(id, migratedProfile);
      localStorage.setItem(this.getStorageKey(id), JSON.stringify(migratedProfile));
      return migratedProfile;
    }

    // Create profile with database templates
    if (!profile) {
      profile = this.createDefaultProfileWithoutTemplates(id);
    }

    // Update profile with database templates
    profile.templates = templatesFromDB;

    this.profileCache.set(id, profile);
    localStorage.setItem(this.getStorageKey(id), JSON.stringify(profile));
    logInfo('doctorProfile', 'Info message', {});
    return profile;
  }

  /**
   * Get doctor profile synchronously (from cache or localStorage only)
   */
  getProfileSync(doctorId?: string): DoctorProfile {
    const id = doctorId || this.currentDoctorId;
    if (!id) {
      throw new Error('No doctor ID provided');
    }

    // Check cache first
    if (this.profileCache.has(id)) {
      const cachedProfile = this.profileCache.get(id)!;
      // Ensure profile has all standard templates
      const migratedProfile = this.ensureStandardTemplates(cachedProfile);
      if (migratedProfile !== cachedProfile) {
        this.profileCache.set(id, migratedProfile);
      }
      return migratedProfile;
    }

    // Check localStorage
    const stored = localStorage.getItem(this.getStorageKey(id));
    if (stored) {
      try {
        const profile = JSON.parse(stored);
        // Ensure profile has all standard templates
        const migratedProfile = this.ensureStandardTemplates(profile);
        this.profileCache.set(id, migratedProfile);
        // Save migrated profile back to localStorage if changed
        if (migratedProfile !== profile) {
          localStorage.setItem(this.getStorageKey(id), JSON.stringify(migratedProfile));
        }
        return migratedProfile;
      } catch (e) {
        logError('doctorProfile', 'Error message', {});
      }
    }

    // Return default profile
    return this.createDefaultProfile(id);
  }

  /**
   * Load templates from database first, fallback to ensuring standard templates
   * NEW: Database-first approach for template loading
   */
  private async loadTemplatesFromDatabase(doctorId: string): Promise<DoctorTemplate[]> {
    try {
      logDebug('doctorProfile', 'Debug message', {});

      // Try to get templates from MySQL database
      const templates = await templateAPIService.getTemplates(doctorId);

      if (templates && templates.length > 0) {
        logInfo('doctorProfile', 'Info message', {});
        return templates;
      }

      logDebug('doctorProfile', 'Debug message', {});
      return [];
    } catch (error) {
      logError('doctorProfile', 'Error message', {});
      return [];
    }
  }

  /**
   * Ensure profile has all standard templates including Tess and Nikki
   * LEGACY: Only used as fallback when database is empty
   */
  private ensureStandardTemplates(profile: DoctorProfile): DoctorProfile {
    // Use the imported standardTemplates from top of file

    // Check if profile has Tess and Nikki templates
    const hasTess = profile.templates.some(
      t => t.name === 'Tess - Endocrinology Follow-up' || t.name.includes('Tess')
    );
    const hasNikki = profile.templates.some(
      t => t.name === 'Nikki - Psychiatry Follow-up' || t.name.includes('Nikki')
    );

    // If both templates exist, no migration needed
    if (hasTess && hasNikki) {
      return profile;
    }

    // Create a new profile object with added templates
    const updatedProfile = { ...profile };
    const templatesToAdd: DoctorTemplate[] = [];

    // Add Tess template if missing
    if (!hasTess) {
      const tessTemplate = standardTemplates.find(
        (t: any) => t.name === 'Tess - Endocrinology Follow-up'
      );
      if (tessTemplate) {
        templatesToAdd.push({
          ...tessTemplate,
          id: `standard_${profile.doctorId}_tess_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 0,
        });
      }
    }

    // Add Nikki template if missing
    if (!hasNikki) {
      const nikkiTemplate = standardTemplates.find(
        (t: any) => t.name === 'Nikki - Psychiatry Follow-up'
      );
      if (nikkiTemplate) {
        templatesToAdd.push({
          ...nikkiTemplate,
          id: `standard_${profile.doctorId}_nikki_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 0,
        });
      }
    }

    // Add new templates to the profile
    if (templatesToAdd.length > 0) {
      updatedProfile.templates = [...profile.templates, ...templatesToAdd];
      logDebug('doctorProfile', 'Debug message', {});
    }

    return updatedProfile;
  }

  /**
   * Create default profile for new doctor (without templates - for database-first loading)
   */
  private createDefaultProfileWithoutTemplates(doctorId: string): DoctorProfile {
    logDebug('doctorProfile', 'Debug message', {});

    const defaultProfile: DoctorProfile = {
      doctorId,
      settings: {
        aiStyle: 'formal',
        autoProcessAfterRecording: true,
        displayPreferences: {
          showInterimTranscript: true,
          highlightMedicalTerms: true,
          autoSaveInterval: 30,
        },
        recordingPreferences: {
          mode: 'dictation',
          autoStopAfterSilence: 3,
          showVideoPreview: false,
        },
        // defaultTemplateId will be set after templates are loaded from database
      },
      templates: [], // Will be populated from database
      recentTemplates: [],
      favoriteTemplates: [],
    };

    return defaultProfile;
  }

  /**
   * Create default profile for new doctor (LEGACY - with hard-coded templates)
   */
  private createDefaultProfile(doctorId: string): DoctorProfile {
    // Use the imported function
    const standardTemplates = getDefaultTemplatesForDoctor(doctorId);

    logDebug('doctorProfile', 'Debug message', {});

    const defaultProfile: DoctorProfile = {
      doctorId,
      settings: {
        aiStyle: 'formal',
        autoProcessAfterRecording: true,
        displayPreferences: {
          showInterimTranscript: true,
          highlightMedicalTerms: true,
          autoSaveInterval: 30,
        },
        recordingPreferences: {
          mode: 'dictation',
          autoStopAfterSilence: 3,
          showVideoPreview: false,
        },
        // Set the comprehensive SOAP as default
        defaultTemplateId: standardTemplates[0]?.id,
      },
      templates: standardTemplates,
      recentTemplates: [],
      favoriteTemplates: [standardTemplates[0]?.id].filter(Boolean), // Add first template as favorite
    };

    // Save the default profile
    this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  /**
   * Save doctor profile
   */
  async saveProfile(profile: DoctorProfile): Promise<void> {
    const key = this.getStorageKey(profile.doctorId);

    // Update cache
    this.profileCache.set(profile.doctorId, profile);

    // Save to localStorage immediately for offline access
    localStorage.setItem(key, JSON.stringify(profile));

    // Save to API in background (don't block)
    templateAPIService.saveProfile(profile).catch(error => {
      logError('doctorProfile', 'Error message', {});
    });
  }

  /**
   * Update doctor settings
   */
  async updateSettings(settings: Partial<DoctorSettings>, doctorId?: string): Promise<void> {
    const profile = await this.getProfile(doctorId);
    profile.settings = { ...profile.settings, ...settings };
    await this.saveProfile(profile);
  }

  /**
   * Get doctor settings
   */
  async getSettings(doctorId?: string): Promise<DoctorSettings> {
    const profile = await this.getProfile(doctorId);
    return profile.settings;
  }

  /**
   * Create a new template for doctor
   */
  async createTemplate(
    template: Omit<DoctorTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>,
    doctorId?: string
  ): Promise<DoctorTemplate> {
    try {
      const effectiveDoctorId = doctorId || this.currentDoctorId || 'default-doctor';
      const profile = await this.getProfile(effectiveDoctorId);

      if (profile.templates.length >= this.MAX_TEMPLATES_PER_DOCTOR) {
        throw new Error(`Maximum templates limit (${this.MAX_TEMPLATES_PER_DOCTOR}) reached`);
      }

      const newTemplate: DoctorTemplate = {
        ...template,
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
      };

      // Try to save to API first
      try {
        await templateAPIService.saveTemplate(newTemplate, effectiveDoctorId);
        logInfo('doctorProfile', 'Info message', {});
      } catch (apiError) {
        logWarn('doctorProfile', 'Warning message', {});
      }

      // Update local profile
      profile.templates.push(newTemplate);
      await this.saveProfile(profile);

      return newTemplate;
    } catch (error) {
      logError('doctorProfile', 'Error message', {});
      throw error;
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<DoctorTemplate>,
    doctorId?: string
  ): Promise<void> {
    const effectiveDoctorId = doctorId || this.currentDoctorId || 'default-doctor';
    const profile = await this.getProfile(effectiveDoctorId);
    const index = profile.templates.findIndex(t => t.id === templateId);

    if (index === -1) {
      throw new Error('Template not found');
    }

    const updatedTemplate = {
      ...profile.templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Try to update on API first
    try {
      await templateAPIService.updateTemplate(templateId, updatedTemplate);
      logInfo('doctorProfile', 'Info message', {});
    } catch (apiError) {
      logWarn('doctorProfile', 'Warning message', {});
    }

    // Update local profile
    profile.templates[index] = updatedTemplate;
    await this.saveProfile(profile);
  }

  /**
   * Delete a template (MySQL-first approach)
   */
  async deleteTemplate(templateId: string, doctorId?: string): Promise<void> {
    const effectiveDoctorId = doctorId || this.currentDoctorId || 'default-doctor';

    if (!effectiveDoctorId || effectiveDoctorId === 'undefined' || effectiveDoctorId === 'null') {
      throw new Error('Please log in to delete templates');
    }

    logDebug('doctorProfile', 'Debug message', {});

    try {
      // Use MySQL API directly - no localStorage fallback
      await templateAPIService.deleteTemplate(templateId);
      logInfo('doctorProfile', 'Info message', {});
    } catch (error) {
      logError('doctorProfile', 'Error message', {});
      throw new Error(
        `Failed to delete template: ${error instanceof Error ? error.message : 'Database connection failed'}`
      );
    }
  }

  /**
   * Get all templates for doctor (MySQL-first approach)
   */
  async getTemplates(doctorId?: string): Promise<DoctorTemplate[]> {
    const effectiveDoctorId = doctorId || this.currentDoctorId;

    if (!effectiveDoctorId || effectiveDoctorId === 'undefined' || effectiveDoctorId === 'null') {
      throw new Error('No doctor ID provided');
    }

    logDebug('doctorProfile', 'Debug message', {});

    try {
      // Use MySQL API directly - no localStorage fallback
      const templates = await templateAPIService.getTemplates(effectiveDoctorId);
      logInfo('doctorProfile', 'Info message', {});
      return templates;
    } catch (error) {
      logError('doctorProfile', 'Error message', {});
      throw new Error(
        `Failed to load templates: ${error instanceof Error ? error.message : 'Database connection failed'}`
      );
    }
  }

  /**
   * Get a specific template
   */
  async getTemplate(templateId: string, doctorId?: string): Promise<DoctorTemplate | null> {
    const profile = await this.getProfile(doctorId);
    return profile.templates.find(t => t.id === templateId) || null;
  }

  /**
   * Set default template (MySQL-first approach)
   */
  async setDefaultTemplate(
    templateId: string,
    visitType?: DoctorTemplate['visitType'],
    doctorId?: string
  ): Promise<void> {
    const effectiveDoctorId = doctorId || this.currentDoctorId || 'default-doctor';

    if (!effectiveDoctorId || effectiveDoctorId === 'undefined' || effectiveDoctorId === 'null') {
      throw new Error('Please log in to set default template');
    }

    logDebug('doctorProfile', 'Debug message', {});

    try {
      // Use MySQL API directly - no localStorage fallback
      await templateAPIService.setDefaultTemplate(templateId, effectiveDoctorId, visitType);
      logInfo('doctorProfile', 'Info message', {});
    } catch (error) {
      logError('doctorProfile', 'Error message', {});
      throw new Error(
        `Failed to set default template: ${error instanceof Error ? error.message : 'Database connection failed'}`
      );
    }
  }

  /**
   * Get default template for visit type or general
   */
  async getDefaultTemplate(
    visitType?: DoctorTemplate['visitType'],
    doctorId?: string
  ): Promise<DoctorTemplate | null> {
    const profile = await this.getProfile(doctorId);

    let templateId: string | undefined;

    if (visitType && profile.settings.defaultTemplateByVisitType?.[visitType]) {
      templateId = profile.settings.defaultTemplateByVisitType[visitType];
    } else {
      templateId = profile.settings.defaultTemplateId;
    }

    if (!templateId) return null;

    return await this.getTemplate(templateId, doctorId);
  }

  /**
   * Add template to recent
   */
  async addToRecent(templateId: string, doctorId?: string): Promise<void> {
    const profile = await this.getProfile(doctorId);

    // Remove if already exists
    profile.recentTemplates = profile.recentTemplates.filter(id => id !== templateId);

    // Add to beginning
    profile.recentTemplates.unshift(templateId);

    // Keep only MAX_RECENT_TEMPLATES
    profile.recentTemplates = profile.recentTemplates.slice(0, this.MAX_RECENT_TEMPLATES);

    // Increment usage count
    const template = profile.templates.find(t => t.id === templateId);
    if (template) {
      template.usageCount++;
      template.updatedAt = new Date().toISOString();
    }

    await this.saveProfile(profile);
  }

  /**
   * Toggle favorite template (MySQL-first approach)
   */
  async toggleFavorite(templateId: string, doctorId?: string): Promise<boolean> {
    const effectiveDoctorId = doctorId || this.currentDoctorId || 'default-doctor';

    if (!effectiveDoctorId || effectiveDoctorId === 'undefined' || effectiveDoctorId === 'null') {
      throw new Error('Please log in to manage favorites');
    }

    logDebug('doctorProfile', 'Debug message', {});

    try {
      // Use MySQL API directly - no localStorage fallback
      const isFavorite = await templateAPIService.toggleFavorite(templateId, effectiveDoctorId);
      logInfo('doctorProfile', 'Info message', {});
      return isFavorite;
    } catch (error) {
      logError('doctorProfile', 'Error message', {});
      throw new Error(
        `Failed to update favorites: ${error instanceof Error ? error.message : 'Database connection failed'}`
      );
    }
  }

  /**
   * Get recent templates
   */
  async getRecentTemplates(doctorId?: string): Promise<DoctorTemplate[]> {
    const profile = await this.getProfile(doctorId);
    const templates = await Promise.all(
      profile.recentTemplates.map(id => this.getTemplate(id, doctorId))
    );
    return templates.filter(t => t !== null) as DoctorTemplate[];
  }

  /**
   * Get favorite templates
   */
  async getFavoriteTemplates(doctorId?: string): Promise<DoctorTemplate[]> {
    const profile = await this.getProfile(doctorId);
    const templates = await Promise.all(
      profile.favoriteTemplates.map(id => this.getTemplate(id, doctorId))
    );
    return templates.filter(t => t !== null) as DoctorTemplate[];
  }

  /**
   * Duplicate a template (MySQL-first approach)
   */
  async duplicateTemplate(
    templateId: string,
    newName: string,
    doctorId?: string
  ): Promise<DoctorTemplate> {
    const effectiveDoctorId = doctorId || this.currentDoctorId || 'default-doctor';

    if (!effectiveDoctorId || effectiveDoctorId === 'undefined' || effectiveDoctorId === 'null') {
      throw new Error('Please log in to duplicate templates');
    }

    logDebug('doctorProfile', 'Debug message', {});

    try {
      // Use MySQL API directly - no localStorage fallback
      const newTemplateId = await templateAPIService.duplicateTemplate(
        templateId,
        newName,
        effectiveDoctorId
      );
      logInfo('doctorProfile', 'Info message', {});

      // Get the new template from API
      const templates = await templateAPIService.getTemplates(effectiveDoctorId);
      const newTemplate = templates.find(t => t.id === newTemplateId);

      if (!newTemplate) {
        throw new Error('Duplicated template not found in database');
      }

      return newTemplate;
    } catch (error) {
      logError('doctorProfile', 'Error message', {});
      throw new Error(
        `Failed to duplicate template: ${error instanceof Error ? error.message : 'Database connection failed'}`
      );
    }
  }

  /**
   * Export profile to JSON
   */
  async exportProfile(doctorId?: string): Promise<string> {
    const profile = await this.getProfile(doctorId);
    return JSON.stringify(profile, null, 2);
  }

  /**
   * Import profile from JSON
   */
  async importProfile(jsonString: string, doctorId?: string): Promise<void> {
    try {
      const imported = JSON.parse(jsonString);
      const id = doctorId || this.currentDoctorId;
      if (!id) {
        throw new Error('No doctor ID provided');
      }

      // Validate structure
      if (!imported.settings || !Array.isArray(imported.templates)) {
        throw new Error('Invalid profile structure');
      }

      // Update doctor ID
      imported.doctorId = id;

      // Save
      await this.saveProfile(imported);
    } catch (e) {
      throw new Error(
        `Failed to import profile: ${e instanceof Error ? e.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Export single template
   */
  async exportTemplate(templateId: string, doctorId?: string): Promise<string> {
    const template = await this.getTemplate(templateId, doctorId);
    if (!template) {
      throw new Error('Template not found');
    }
    return JSON.stringify(template, null, 2);
  }

  /**
   * Import template
   */
  async importTemplate(jsonString: string, doctorId?: string): Promise<DoctorTemplate> {
    try {
      const imported = JSON.parse(jsonString);

      // Remove ID and timestamps to create new
      delete imported.id;
      delete imported.createdAt;
      delete imported.updatedAt;
      delete imported.usageCount;

      return await this.createTemplate(imported, doctorId);
    } catch (e) {
      throw new Error(
        `Failed to import template: ${e instanceof Error ? e.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clear cache for a specific doctor to force reload
   */
  clearCache(doctorId?: string): void {
    const id = doctorId || this.currentDoctorId;
    if (id) {
      this.profileCache.delete(id);
      // Also clear from localStorage to force full reload
      localStorage.removeItem(this.getStorageKey(id));
      logDebug('doctorProfile', 'Debug message', {});
    }
  }

  /**
   * Clear all caches to force reload for all doctors
   */
  clearAllCaches(): void {
    // Clear all profile cache
    this.profileCache.clear();

    // Clear all localStorage entries for doctor profiles
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    logDebug('doctorProfile', 'Debug message', {});
  }
}

// Export singleton instance
export const doctorProfileService = new DoctorProfileService();
