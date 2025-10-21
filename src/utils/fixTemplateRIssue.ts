// Fix "R:" appearing in section titles
import { doctorProfileService } from '../services/doctorProfile.service';
import { supabaseAuthService } from '../services/supabaseAuth.service';
import { logError, logWarn, logInfo, logDebug } from '../services/logger.service';

export async function fixRInSectionTitles(): Promise<boolean> {
  logDebug('fixTemplateRIssue', 'Starting fix for R: prefix in section titles', {});

  try {
    // Get current user
    const result = await supabaseAuthService.getCurrentUser();
    if (!result.success || !result.user) {
      logError('fixTemplateRIssue', 'No authenticated user', {});
      return false;
    }

    const doctorId = result.user.authUserId || result.user.id || result.user.email || 'doctor-default-001';
    doctorProfileService.initialize(doctorId);

    const templates = await doctorProfileService.getTemplates(doctorId);
    let fixedCount = 0;

    for (const template of templates) {
      let needsUpdate = false;
      const updatedSections = { ...template.sections };

      Object.entries(template.sections || {}).forEach(([key, section]) => {
        if (typeof section === 'object' && section !== null && section.title) {
          // Check if title starts with "R:" or has "R:" pattern
          if (section.title.startsWith('R:') || section.title.match(/^R\s*:/)) {
            logDebug('fixTemplateRIssue', `Found R: prefix in ${template.name}/${key}`, {});

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
        logDebug('fixTemplateRIssue', `Updating template ${template.name}`, {});
        await doctorProfileService.updateTemplate(template.id, { sections: updatedSections }, doctorId);
      }
    }

    if (fixedCount > 0) {
      logInfo('fixTemplateRIssue', `Fixed ${fixedCount} section titles`, {});
      return true;
    } else {
      logDebug('fixTemplateRIssue', 'No fixes needed', {});
      return false;
    }
  } catch (error) {
    logError('fixTemplateRIssue', 'Error fixing templates', { error });
    return false;
  }
}

// Check how "R:" affects AI processing
export async function analyzeRImpact(): Promise<{
  hasRPrefix: boolean;
  affectedTemplates: string[];
  explanation: string;
}> {
  try {
    // Get current user
    const result = await supabaseAuthService.getCurrentUser();
    if (!result.success || !result.user) {
      return {
        hasRPrefix: false,
        affectedTemplates: [],
        explanation: 'Unable to check templates - no authenticated user'
      };
    }

    const doctorId = result.user.authUserId || result.user.id || result.user.email || 'doctor-default-001';
    doctorProfileService.initialize(doctorId);

    const templates = await doctorProfileService.getTemplates(doctorId);
    const affectedTemplates: string[] = [];

    templates.forEach(template => {
      Object.entries(template.sections || {}).forEach(([key, section]) => {
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
  } catch (error) {
    logError('fixTemplateRIssue', 'Error analyzing templates', { error });
    return {
      hasRPrefix: false,
      affectedTemplates: [],
      explanation: 'Error analyzing templates'
    };
  }
}
