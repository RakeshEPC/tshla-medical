// Fix corrupted templates in localStorage
import type { Template, TemplateSection } from '../types/template.types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export function fixCorruptedTemplates(): void {
  const STORAGE_KEY = 'medical_templates_v2';

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      logDebug('App', 'Debug message', {});
      return;
    }

    const templates: Template[] = JSON.parse(stored);
    let fixedCount = 0;

    const fixedTemplates = templates.map(template => {
      if (!template.sections) return template;

      // Check if this template needs fixing
      const needsFix = Object.values(template.sections).some(
        section =>
          typeof section === 'string' ||
          (typeof section === 'object' &&
            section !== null &&
            (!section.title || !section.aiInstructions))
      );

      if (!needsFix) return template;

      logDebug('App', 'Debug message', {});
      fixedCount++;

      // Only keep valid sections with title and aiInstructions
      const fixedSections: Record<string, TemplateSection> = {};

      Object.entries(template.sections).forEach(([key, value]) => {
        if (
          typeof value === 'object' &&
          value !== null &&
          'title' in value &&
          'aiInstructions' in value &&
          value.title &&
          value.aiInstructions
        ) {
          fixedSections[key] = value as TemplateSection;
        } else {
          logDebug('App', 'Debug message', {});
        }
      });

      return {
        ...template,
        sections: fixedSections,
      };
    });

    if (fixedCount > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fixedTemplates));
      logDebug('App', 'Debug message', {});
    } else {
      logDebug('App', 'Debug message', {});
    }
  } catch (error) {
    logError('App', 'Error message', {});
  }
}

// Run this function on app startup or manually
export function initTemplatesFix(): void {
  if (typeof window !== 'undefined') {
    logDebug('App', 'Debug message', {});
    fixCorruptedTemplates();
  }
}
