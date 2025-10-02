import { azureAIService } from './azureAI.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface ValidationResult {
  score: number; // 0-10, where 10 is highest quality
  isValid: boolean; // true if score >= 6
  reasons: string[]; // Specific reasons for the score
  suggestions: string[]; // What the user should add/improve
}

export interface CategoryValidationRules {
  minLength: number;
  requiredKeywords: string[];
  categoryName: string;
}

class PumpDriveValidationService {
  // Minimum requirements per category
  private categoryRules: Record<string, CategoryValidationRules> = {
    cost: {
      minLength: 50,
      requiredKeywords: [
        'insurance',
        'cost',
        'budget',
        'money',
        'coverage',
        'afford',
        'expense',
        'pay',
        'dollar',
        'price',
      ],
      categoryName: 'Budget & Insurance',
    },
    lifestyle: {
      minLength: 50,
      requiredKeywords: [
        'work',
        'activity',
        'exercise',
        'daily',
        'routine',
        'active',
        'lifestyle',
        'swim',
        'sports',
        'job',
        'travel',
      ],
      categoryName: 'Lifestyle',
    },
    algorithm: {
      minLength: 50,
      requiredKeywords: [
        'blood sugar',
        'glucose',
        'control',
        'a1c',
        'low',
        'high',
        'cgm',
        'monitor',
        'diabetes',
        'insulin',
      ],
      categoryName: 'Control Preferences',
    },
    easeToStart: {
      minLength: 50,
      requiredKeywords: [
        'technology',
        'tech',
        'learn',
        'computer',
        'phone',
        'app',
        'device',
        'easy',
        'difficult',
        'help',
      ],
      categoryName: 'Getting Started',
    },
    complexity: {
      minLength: 50,
      requiredKeywords: [
        'meal',
        'eat',
        'carb',
        'bolus',
        'maintenance',
        'daily',
        'routine',
        'manage',
        'remember',
        'forget',
      ],
      categoryName: 'Daily Use & Complexity',
    },
    support: {
      minLength: 50,
      requiredKeywords: [
        'doctor',
        'family',
        'help',
        'support',
        'care',
        'team',
        'spouse',
        'children',
        'emergency',
        'assist',
      ],
      categoryName: 'Support System',
    },
  };

  /**
   * Validate a user response for a specific category
   */
  async validateResponse(
    categoryId: string,
    response: string,
    checkedQuestions: string[]
  ): Promise<ValidationResult> {
    const rules = this.categoryRules[categoryId];
    if (!rules) {
      return {
        score: 0,
        isValid: false,
        reasons: ['Invalid category'],
        suggestions: ['Please select a valid category'],
      };
    }

    // Basic validation checks
    const basicChecks = this.performBasicValidation(response, rules);

    // If basic validation fails badly, don't bother with AI
    if (basicChecks.score <= 2) {
      return basicChecks;
    }

    // Use AI to validate medical relevance and quality
    const aiValidation = await this.performAIValidation(categoryId, response, rules);

    // Combine basic and AI validation
    const combinedScore = Math.min(10, (basicChecks.score + aiValidation.score) / 2);

    return {
      score: Math.round(combinedScore),
      isValid: combinedScore >= 6,
      reasons: [...basicChecks.reasons, ...aiValidation.reasons],
      suggestions: [...basicChecks.suggestions, ...aiValidation.suggestions],
    };
  }

  /**
   * Basic validation that doesn't require AI
   */
  private performBasicValidation(
    response: string,
    rules: CategoryValidationRules
  ): ValidationResult {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    let score = 10;

    // Check minimum length
    if (response.length < rules.minLength) {
      score -= 4;
      reasons.push(
        `Response too short (${response.length} characters, minimum ${rules.minLength})`
      );
      suggestions.push(`Please provide more detail about your ${rules.categoryName.toLowerCase()}`);
    }

    // Check for gibberish/repeated characters
    if (this.isGibberish(response)) {
      score -= 6;
      reasons.push('Response appears to contain gibberish or repeated characters');
      suggestions.push('Please provide meaningful information about your medical needs');
    }

    // Check for relevant keywords
    const lowerResponse = response.toLowerCase();
    const foundKeywords = rules.requiredKeywords.filter(keyword =>
      lowerResponse.includes(keyword.toLowerCase())
    );

    if (foundKeywords.length === 0) {
      score -= 3;
      reasons.push(`No relevant keywords found for ${rules.categoryName}`);
      suggestions.push(
        `Please mention topics like: ${rules.requiredKeywords.slice(0, 5).join(', ')}`
      );
    } else if (foundKeywords.length < 2) {
      score -= 1;
      reasons.push(`Limited relevant keywords found (${foundKeywords.length})`);
    }

    // Check for complete sentences
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length < 2) {
      score -= 2;
      reasons.push('Response should contain multiple complete sentences');
      suggestions.push('Please provide more detailed sentences about your situation');
    }

    return {
      score: Math.max(0, score),
      isValid: score >= 6,
      reasons,
      suggestions,
    };
  }

  /**
   * AI-based validation using Claude
   */
  private async performAIValidation(
    categoryId: string,
    response: string,
    rules: CategoryValidationRules
  ): Promise<ValidationResult> {
    try {
      const prompt = `You are a medical AI validator. Rate this patient response for the "${rules.categoryName}" category on a scale of 0-10.

RESPONSE TO VALIDATE:
"${response}"

CATEGORY: ${rules.categoryName}
EXPECTED TOPICS: ${rules.requiredKeywords.join(', ')}

Rate this response (0-10) based on:
1. Medical relevance to ${rules.categoryName.toLowerCase()}
2. Contains specific, actionable information
3. Shows genuine patient concerns/needs
4. Provides enough detail for pump recommendations
5. Not generic/vague responses

Return JSON:
{
  "score": 0-10,
  "medicalRelevance": "high/medium/low",
  "reasons": ["specific reason 1", "specific reason 2"],
  "suggestions": ["what patient should add", "how to improve response"]
}`;

      const aiResponse = await azureAIService.generateResponse('', prompt);

      // Try to parse AI response
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            score: Math.min(10, Math.max(0, parsed.score || 5)),
            isValid: (parsed.score || 5) >= 6,
            reasons: parsed.reasons || ['AI validation completed'],
            suggestions: parsed.suggestions || [],
          };
        }
      } catch (parseError) {
        logWarn('pumpDriveValidation', 'Warning message', {});
      }

      // Fallback if AI parsing fails
      return {
        score: 5,
        isValid: true,
        reasons: ['AI validation completed with basic scoring'],
        suggestions: [],
      };
    } catch (error) {
      logError('pumpDriveValidation', 'Error message', {});
      // Return neutral validation if AI fails
      return {
        score: 5,
        isValid: true,
        reasons: ['AI validation unavailable'],
        suggestions: [],
      };
    }
  }

  /**
   * Check if text appears to be gibberish
   */
  private isGibberish(text: string): boolean {
    // Check for repeated characters (like "aaaaaaa" or "123123123")
    const repeatedPattern = /(.)\1{4,}/;
    if (repeatedPattern.test(text)) return true;

    // Check for keyboard mashing patterns
    const keyboardPatterns = [/qwerty/i, /asdf/i, /zxcv/i, /hjkl/i, /123456/i, /abcdef/i];
    if (keyboardPatterns.some(pattern => pattern.test(text))) return true;

    // Check ratio of vowels to consonants (gibberish usually has poor ratio)
    const vowels = text.match(/[aeiou]/gi)?.length || 0;
    const consonants = text.match(/[bcdfghjklmnpqrstvwxyz]/gi)?.length || 0;
    const total = vowels + consonants;

    if (total > 10) {
      const vowelRatio = vowels / total;
      // Normal text has vowel ratio between 0.2 and 0.5
      if (vowelRatio < 0.1 || vowelRatio > 0.7) return true;
    }

    return false;
  }

  /**
   * Validate all category responses before generating recommendations
   */
  async validateAllCategories(responses: Record<string, any>): Promise<{
    valid: boolean;
    validCount: number;
    totalCount: number;
    categoryResults: Record<string, ValidationResult>;
    overallSuggestions: string[];
  }> {
    const categoryResults: Record<string, ValidationResult> = {};
    let validCount = 0;

    for (const [categoryId, data] of Object.entries(responses)) {
      const fullResponse = data.followUpTranscript
        ? `${data.mainTranscript}\n\n${data.followUpTranscript}`
        : data.mainTranscript;

      const validation = await this.validateResponse(
        categoryId,
        fullResponse || '',
        data.checkedQuestions || []
      );

      categoryResults[categoryId] = validation;
      if (validation.isValid) validCount++;
    }

    const totalCount = Object.keys(responses).length;
    const valid = validCount >= 4; // Need at least 4 valid categories

    const overallSuggestions: string[] = [];
    if (!valid) {
      overallSuggestions.push(
        `You need at least 4 high-quality category responses to get recommendations. Currently ${validCount}/${totalCount} are valid.`
      );

      const invalidCategories = Object.entries(categoryResults)
        .filter(([_, result]) => !result.isValid)
        .map(([categoryId, _]) => this.categoryRules[categoryId]?.categoryName || categoryId);

      if (invalidCategories.length > 0) {
        overallSuggestions.push(
          `Please improve your responses for: ${invalidCategories.join(', ')}`
        );
      }
    }

    return {
      valid,
      validCount,
      totalCount,
      categoryResults,
      overallSuggestions,
    };
  }
}

export const pumpDriveValidationService = new PumpDriveValidationService();
