// Fix "R:" appearing in section titles
import { templateStorage } from '../lib/templateStorage';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export function fixRInSectionTitles(): void {
  logDebug('App', 'Debug message', {});

  const templates = templateStorage.getTemplates();
  let fixedCount = 0;

  templates.forEach(template => {
    let needsUpdate = false;
    const updatedSections = { ...template.sections };

    Object.entries(template.sections).forEach(([key, section]) => {
      if (typeof section === 'object' && section !== null && section.title) {
        // Check if title starts with "R:" or has "R:" pattern
        if (section.title.startsWith('R:') || section.title.match(/^R\s*:/)) {
          logDebug('App', 'Debug message', {});

          // Remove "R:" from the beginning
          updatedSections[key] = {
            ...section,
            title: section.title.replace(/^R\s*:\s*/, '').trim(),
          };
          needsUpdate = true;
          fixedCount++;
        }
      }
    });

    if (needsUpdate) {
      logDebug('App', 'Debug message', {});
      templateStorage.updateTemplate(template.id, { sections: updatedSections });
    }
  });

  if (fixedCount > 0) {
    logDebug('App', 'Debug message', {});
    return true;
  } else {
    logDebug('App', 'Debug message', {});
    return false;
  }
}

// Check how "R:" affects AI processing
export function analyzeRImpact(): {
  hasRPrefix: boolean;
  affectedTemplates: string[];
  explanation: string;
} {
  const templates = templateStorage.getTemplates();
  const affectedTemplates: string[] = [];

  templates.forEach(template => {
    Object.entries(template.sections).forEach(([key, section]) => {
      if (typeof section === 'object' && section !== null && section.title) {
        if (section.title.startsWith('R:') || section.title.match(/^R\s*:/)) {
          if (!affectedTemplates.includes(template.name)) {
            affectedTemplates.push(template.name);
          }
        }
      }
    });
  });

  const hasRPrefix = affectedTemplates.length > 0;

  let explanation = '';
  if (hasRPrefix) {
    explanation = `The "R:" prefix in section titles can affect AI processing in several ways:
    
1. **Section Recognition**: The AI might not properly recognize section names like "R: Subjective" as "Subjective", leading to incorrect categorization.

2. **Content Extraction**: When the AI looks for specific sections (e.g., "Assessment"), it might miss sections labeled as "R: Assessment".

3. **Output Formatting**: The processed note will include the "R:" prefix in section headers, making the output look unprofessional.

4. **Template Matching**: The enhanced template processor expects standard section names. The "R:" prefix can cause the processor to skip these sections or process them incorrectly.

5. **Data Extraction**: Features like medication extraction or follow-up time parsing rely on finding the correct sections. The "R:" prefix disrupts this pattern matching.

Affected templates: ${affectedTemplates.join(', ')}

The "R:" likely came from copying/pasting or a formatting issue when creating the template. It should be removed for proper AI processing.`;
  } else {
    explanation =
      'No "R:" prefixes found in templates. The issue might be in the display or processing logic rather than the template data itself.';
  }

  return {
    hasRPrefix,
    affectedTemplates,
    explanation,
  };
}
