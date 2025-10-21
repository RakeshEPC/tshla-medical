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
  complexity?: {
    score: number; // 0-100
    level: 'simple' | 'moderate' | 'complex' | 'very_complex';
    recommendedModel: 'gpt-4o-mini' | 'gpt-4o';
    factors: {
      sectionCount: number;
      requiredSections: number;
      instructionLength: number;
    };
  };
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

// Import Supabase services
import { supabase } from '../lib/supabase';
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

    // NEW: Load profile with Supabase-first template loading
    logDebug('doctorProfile', 'Loading doctor profile', { doctorId: id });

    // Check localStorage for existing profile
    const stored = localStorage.getItem(this.getStorageKey(id));
    let profile: DoctorProfile | null = null;

    if (stored) {
      try {
        profile = JSON.parse(stored);
      } catch (e) {
        logError('doctorProfile', 'Error parsing stored profile', { error: e });
      }
    }

    // Load templates from Supabase database
    const templatesFromDB = await this.loadTemplatesFromDatabase(id);

    if (templatesFromDB.length === 0) {
      logDebug('doctorProfile', 'No templates in Supabase, using fallback', {});
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

    // Update profile with Supabase templates
    profile.templates = templatesFromDB;

    this.profileCache.set(id, profile);
    localStorage.setItem(this.getStorageKey(id), JSON.stringify(profile));
    logInfo('doctorProfile', `Profile loaded with ${templatesFromDB.length} templates from Supabase`, {});
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
   * Load templates from Supabase database
   * NEW: Supabase-first approach for template loading
   */
  private async loadTemplatesFromDatabase(doctorId: string): Promise<DoctorTemplate[]> {
    try {
      logDebug('doctorProfile', 'Loading templates from Supabase', { doctorId });

      // Get staff_id from medical_staff table
      const { data: staffData, error: staffError } = await supabase
        .from('medical_staff')
        .select('id')
        .eq('auth_user_id', doctorId)
        .maybeSingle();

      if (staffError) {
        logError('doctorProfile', 'Error finding medical staff', { error: staffError });
        // Still try to load system templates even if there's an error
      }

      // Build query to load templates from Supabase
      let query;
      if (staffData?.id) {
        // User has medical_staff record: load their templates AND system templates
        // NOTE: Database uses 'created_by' field, not 'staff_id'
        query = supabase
          .from('templates')
          .select('*')
          .or(`created_by.eq.${staffData.id},is_system_template.eq.true`)
          .order('created_at', { ascending: false });
      } else {
        // No medical_staff record: load only system templates
        logWarn('doctorProfile', 'No medical staff record found, loading system templates only', { doctorId });
        query = supabase
          .from('templates')
          .select('*')
          .eq('is_system_template', true)
          .order('created_at', { ascending: false });
      }

      const { data: templates, error } = await query;

      if (error) {
        logError('doctorProfile', 'Error loading templates from Supabase', { error });
        return [];
      }

      if (templates && templates.length > 0) {
        logInfo('doctorProfile', `Loaded ${templates.length} templates from Supabase`, {});

        // Convert Supabase format to DoctorTemplate format
        return templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          visitType: (t.template_type as DoctorTemplate['visitType']) || 'general',
          isDefault: false, // Will be set from doctor settings
          sections: t.sections || {},
          generalInstructions: '',
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          usageCount: t.usage_count || 0,
        }));
      }

      logDebug('doctorProfile', 'No templates found in Supabase', {});
      return [];
    } catch (error) {
      logError('doctorProfile', 'Exception loading templates', { error });
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

    // Note: Templates are saved individually to Supabase via createTemplate/updateTemplate methods
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
   * Create a new template for doctor (Supabase)
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

      // Get staff_id from medical_staff table
      const { data: staffData, error: staffError } = await supabase
        .from('medical_staff')
        .select('id')
        .eq('auth_user_id', effectiveDoctorId)
        .maybeSingle();

      if (staffError || !staffData) {
        throw new Error('Medical staff record not found');
      }

      // Insert into Supabase
      // NOTE: Database uses 'created_by' field to match schema, not 'staff_id'
      const { data: newTemplate, error} = await supabase
        .from('templates')
        .insert({
          created_by: staffData.id,
          name: template.name,
          specialty: template.description || 'General',
          template_type: template.visitType || 'general',
          sections: template.sections,
          macros: {},
          quick_phrases: [],
          is_system_template: false,
          is_shared: false,
          usage_count: 0,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create template: ${error.message}`);
      }

      logInfo('doctorProfile', 'Template created in Supabase', { templateId: newTemplate.id });

      // Convert to DoctorTemplate format
      const doctorTemplate: DoctorTemplate = {
        id: newTemplate.id,
        name: newTemplate.name,
        description: newTemplate.specialty || template.description || '',
        visitType: (newTemplate.template_type as DoctorTemplate['visitType']) || 'general',
        isDefault: false,
        sections: newTemplate.sections || {},
        generalInstructions: template.generalInstructions || '',
        createdAt: newTemplate.created_at,
        updatedAt: newTemplate.updated_at,
        usageCount: 0,
      };

      // Calculate and add complexity
      doctorTemplate.complexity = this.calculateTemplateComplexity(doctorTemplate);

      // Update local profile cache
      profile.templates.push(doctorTemplate);
      await this.saveProfile(profile);

      return doctorTemplate;
    } catch (error) {
      logError('doctorProfile', 'Error creating template', { error });
      throw error;
    }
  }

  /**
   * Update an existing template (Supabase)
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

    // Update in Supabase
    const { error } = await supabase
      .from('templates')
      .update({
        name: updates.name,
        specialty: updates.description,
        template_type: updates.visitType,
        sections: updates.sections,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId);

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    logInfo('doctorProfile', 'Template updated in Supabase', { templateId });

    // Update local profile
    const updatedTemplate = {
      ...profile.templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate complexity if sections or instructions changed
    if (updates.sections || updates.generalInstructions) {
      updatedTemplate.complexity = this.calculateTemplateComplexity(updatedTemplate);
    }

    profile.templates[index] = updatedTemplate;
    await this.saveProfile(profile);
  }

  /**
   * Delete a template (Supabase)
   */
  async deleteTemplate(templateId: string, doctorId?: string): Promise<void> {
    const effectiveDoctorId = doctorId || this.currentDoctorId || 'default-doctor';

    if (!effectiveDoctorId || effectiveDoctorId === 'undefined' || effectiveDoctorId === 'null') {
      throw new Error('Please log in to delete templates');
    }

    logDebug('doctorProfile', 'Deleting template from Supabase', { templateId });

    try {
      // Delete from Supabase
      const { error } = await supabase.from('templates').delete().eq('id', templateId);

      if (error) {
        throw new Error(`Failed to delete template: ${error.message}`);
      }

      logInfo('doctorProfile', 'Template deleted from Supabase', { templateId });

      // Clear cache to force reload
      this.clearCache(effectiveDoctorId);
    } catch (error) {
      logError('doctorProfile', 'Error deleting template', { error });
      throw new Error(
        `Failed to delete template: ${error instanceof Error ? error.message : 'Database error'}`
      );
    }
  }

  /**
   * Get all templates for doctor (Supabase)
   */
  async getTemplates(doctorId?: string): Promise<DoctorTemplate[]> {
    const effectiveDoctorId = doctorId || this.currentDoctorId;

    if (!effectiveDoctorId || effectiveDoctorId === 'undefined' || effectiveDoctorId === 'null') {
      throw new Error('No doctor ID provided');
    }

    logDebug('doctorProfile', 'Getting templates from Supabase', { doctorId: effectiveDoctorId });

    try {
      // Load from database (this handles Supabase internally)
      const templates = await this.loadTemplatesFromDatabase(effectiveDoctorId);
      logInfo('doctorProfile', `Retrieved ${templates.length} templates`, {});
      return templates;
    } catch (error) {
      logError('doctorProfile', 'Error getting templates', { error });
      throw new Error(
        `Failed to load templates: ${error instanceof Error ? error.message : 'Database error'}`
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
   * Set default template (localStorage-based)
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

    logDebug('doctorProfile', 'Setting default template', { templateId, visitType });

    try {
      const profile = await this.getProfile(effectiveDoctorId);

      // Update settings with default template
      if (visitType) {
        // Set default for specific visit type
        if (!profile.settings.defaultTemplateByVisitType) {
          profile.settings.defaultTemplateByVisitType = {};
        }
        profile.settings.defaultTemplateByVisitType[visitType] = templateId;
      } else {
        // Set general default template
        profile.settings.defaultTemplateId = templateId;
      }

      await this.saveProfile(profile);
      logInfo('doctorProfile', 'Default template set', { templateId, visitType });
    } catch (error) {
      logError('doctorProfile', 'Error setting default template', { error });
      throw new Error(
        `Failed to set default template: ${error instanceof Error ? error.message : 'Failed to update settings'}`
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
   * Toggle favorite template (localStorage-based)
   */
  async toggleFavorite(templateId: string, doctorId?: string): Promise<boolean> {
    const effectiveDoctorId = doctorId || this.currentDoctorId || 'default-doctor';

    if (!effectiveDoctorId || effectiveDoctorId === 'undefined' || effectiveDoctorId === 'null') {
      throw new Error('Please log in to manage favorites');
    }

    logDebug('doctorProfile', 'Toggling favorite template', { templateId });

    try {
      const profile = await this.getProfile(effectiveDoctorId);

      // Check if template is already a favorite
      const index = profile.favoriteTemplates.indexOf(templateId);

      if (index > -1) {
        // Remove from favorites
        profile.favoriteTemplates.splice(index, 1);
        await this.saveProfile(profile);
        logInfo('doctorProfile', 'Template removed from favorites', { templateId });
        return false;
      } else {
        // Add to favorites
        profile.favoriteTemplates.push(templateId);
        await this.saveProfile(profile);
        logInfo('doctorProfile', 'Template added to favorites', { templateId });
        return true;
      }
    } catch (error) {
      logError('doctorProfile', 'Error toggling favorite', { error });
      throw new Error(
        `Failed to update favorites: ${error instanceof Error ? error.message : 'Failed to update profile'}`
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
   * Duplicate a template (Supabase)
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

    logDebug('doctorProfile', 'Duplicating template', { templateId, newName });

    try {
      // Get the original template
      const originalTemplate = await this.getTemplate(templateId, effectiveDoctorId);

      if (!originalTemplate) {
        throw new Error('Template not found');
      }

      // Create a new template based on the original
      const newTemplate = await this.createTemplate(
        {
          name: newName,
          description: originalTemplate.description,
          visitType: originalTemplate.visitType,
          sections: originalTemplate.sections,
          generalInstructions: originalTemplate.generalInstructions,
        },
        effectiveDoctorId
      );

      logInfo('doctorProfile', 'Template duplicated successfully', {
        originalId: templateId,
        newId: newTemplate.id
      });

      return newTemplate;
    } catch (error) {
      logError('doctorProfile', 'Error duplicating template', { error });
      throw new Error(
        `Failed to duplicate template: ${error instanceof Error ? error.message : 'Duplication failed'}`
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

  /**
   * Calculate template complexity for cost optimization
   * Returns score, level, and recommended model
   */
  calculateTemplateComplexity(template: DoctorTemplate): DoctorTemplate['complexity'] {
    let score = 0;
    const factors = {
      sectionCount: 0,
      requiredSections: 0,
      instructionLength: 0,
    };

    // 1. Section Count (30 points max)
    const sectionCount = Object.keys(template.sections).length;
    factors.sectionCount = sectionCount;

    if (sectionCount <= 5) {
      score += 5;
    } else if (sectionCount <= 8) {
      score += 15;
    } else {
      score += 30;
    }

    // 2. Required Sections (15 points max)
    const requiredCount = Object.values(template.sections).filter(s => s.required).length;
    factors.requiredSections = requiredCount;
    score += Math.min(requiredCount * 3, 15);

    // 3. Custom AI Instructions Length (25 points max)
    let totalInstructionLength = 0;

    if (template.generalInstructions) {
      totalInstructionLength += template.generalInstructions.length;
      score += Math.min(template.generalInstructions.length / 50, 10);
    }

    Object.values(template.sections).forEach(section => {
      if (section.aiInstructions) {
        totalInstructionLength += section.aiInstructions.length;
        score += Math.min(section.aiInstructions.length / 100, 5);
      }
    });

    factors.instructionLength = totalInstructionLength;

    // 4. Specialty-specific complexity (10 points max)
    const complexSpecialties = ['cardiology', 'neurology', 'oncology', 'psychiatry'];
    const templateName = template.name.toLowerCase();
    if (complexSpecialties.some(s => templateName.includes(s))) {
      score += 10;
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Determine complexity level and recommended model
    let level: 'simple' | 'moderate' | 'complex' | 'very_complex';
    let recommendedModel: 'gpt-4o-mini' | 'gpt-4o';

    if (score < 30) {
      level = 'simple';
      recommendedModel = 'gpt-4o-mini';
    } else if (score < 50) {
      level = 'moderate';
      recommendedModel = 'gpt-4o-mini';
    } else if (score < 70) {
      level = 'complex';
      recommendedModel = 'gpt-4o';
    } else {
      level = 'very_complex';
      recommendedModel = 'gpt-4o';
    }

    // Override for templates with extensive instructions (>500 chars)
    if (totalInstructionLength > 500) {
      recommendedModel = 'gpt-4o';
    }

    logDebug('doctorProfile', 'Template complexity calculated', {
      templateName: template.name,
      score,
      level,
      recommendedModel,
    });

    return {
      score,
      level,
      recommendedModel,
      factors,
    };
  }
}

// Export singleton instance
export const doctorProfileService = new DoctorProfileService();
