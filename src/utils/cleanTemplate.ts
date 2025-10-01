// Clean up template to ensure only valid sections with title and aiInstructions are kept
import type { Template, TemplateSection } from '../types/template.types';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export function cleanTemplateForProcessing(template: Template): Template {
  if (!template || !template.sections) return template;

  const cleanedSections: Record<string, TemplateSection> = {};
  
  Object.entries(template.sections).forEach(([key, value]) => {
    // Only keep sections that have both title and aiInstructions
    if (
      typeof value === 'object' && 
      value !== null && 
      'title' in value && 
      'aiInstructions' in value &&
      value.title && 
      value.aiInstructions
    ) {
      cleanedSections[key] = value as TemplateSection;
    }
  });

  return {
    ...template,
    sections: cleanedSections
  };
}

export function debugTemplate(template: Template): void {
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Debug message', {});
  logDebug('App', 'Template body length', template.body?.length);
  
  if (template.sections) {
    logDebug('App', 'Debug message', {});
    Object.entries(template.sections).forEach(([key, value]) => {
      logDebug('App', 'Debug message', {});
      logDebug('App', 'Debug message', {});
      
      if (typeof value === 'object' && value !== null) {
        logDebug('App', 'Debug message', {});
        logDebug('App', 'Debug message', {});
        if ('order' in value) {
          logDebug('App', 'Debug message', {});
        }
      } else if (typeof value === 'string') {
        logDebug('App', 'Debug message', {}); + '...');
      }
    });
  }
  
  logDebug('App', 'Debug message', {});
}