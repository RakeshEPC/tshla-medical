/**
 * PumpDrive Validated Processing Service
 * Ensures meaningful responses before proceeding to next category
 * Combines efficiency with quality by validating each category response
 */

import { azureAIService } from './azureAI.service';
import { aiRequestQueue } from './aiRequestQueue.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

interface CategoryValidation {
  isValid: boolean;
  confidence: number;
  extractedInsights: string[];
  concerns: string[];
  requiresRedo?: boolean;
  redoReason?: string;
}

interface ProcessedCategoryData {
  category: string;
  transcript: string;
  validation: CategoryValidation;
  insights: {
    primary: string[];
    secondary: string[];
    preferences: Record<string, any>;
  };
  recommendationWeights: Record<string, number>;
  timestamp: number;
}

class PumpDriveValidatedService {
  /**
   * Process and validate category response with AI
   * This ensures we get meaningful data before moving to next category
   */
  async processCategoryWithValidation(
    category: string,
    transcript: string,
    categoryTitle: string
  ): Promise<ProcessedCategoryData> {
    logDebug('pumpDriveValidated', 'Debug message', {});

    // First validate if the response is meaningful
    const validation = await this.validateCategoryResponse(category, transcript, categoryTitle);

    if (!validation.isValid) {
      throw new Error(
        validation.redoReason || 'Response needs more detail to provide accurate recommendations'
      );
    }

    // If valid, extract insights using AI
    const insights = await this.extractCategoryInsights(category, transcript, categoryTitle);

    return {
      category,
      transcript,
      validation,
      insights,
      recommendationWeights: this.calculateCategoryWeights(category, insights),
      timestamp: Date.now(),
    };
  }

  /**
   * Validate category response using AI to check for meaningful content
   */
  private async validateCategoryResponse(
    category: string,
    transcript: string,
    categoryTitle: string
  ): Promise<CategoryValidation> {
    const validationPrompt = `
You are validating a patient's response about insulin pump preferences for the category "${categoryTitle}".

Patient Response: "${transcript}"

Analyze if this response provides meaningful information for insulin pump selection. 

Return a JSON response with:
{
  "isValid": boolean (true if response has useful info, false if junk/gibberish),
  "confidence": number (0-1, how confident you are),
  "extractedInsights": ["insight1", "insight2"] (what useful info you found),
  "concerns": ["concern1"] (any concerns about the response),
  "requiresRedo": boolean (if patient should answer again),
  "redoReason": "string" (why they need to provide more info)
}

Examples of INVALID responses:
- "asdf jklh random stuff"
- "I don't know anything"
- "test test test"
- Single words like "yes", "no", "good", "fine"
- Very short phrases under 20 characters
- Completely off-topic responses
- Repetitive text or keyboard mashing

Examples of VALID responses:
- Actual preferences with reasons: "I prefer simple devices because I'm not tech-savvy"
- Specific experiences: "I had issues with my last pump getting wet when swimming"
- Real concerns: "Cost is important since my insurance only covers certain brands"
- Lifestyle details: "I travel frequently for work and need something portable"
- Medical context: "My A1C has been around 7.5 and I want tighter control"

Requirements for VALID response:
1. At least 15 characters (about 3-4 words minimum)
2. Contains at least ONE piece of relevant information about the topic
3. Makes sense in context (not random text)

Be very lenient - even very short responses are valid if they contain real information:
- "I have Blue Cross" is VALID (insurance info)
- "No insurance" is VALID (relevant info)
- "Budget is tight" is VALID (financial info)
- "$150 per month max" is VALID (budget info)
- "asdf test test" is INVALID (nonsense)
- "yes" or "no" alone is INVALID (too vague)

IMPORTANT: If they mention ANY relevant detail about the category topic, mark it as VALID.
Focus on whether they're sharing real information, NOT on length or completeness.
`;

    try {
      const response = await aiRequestQueue.queueRequest(async () => {
        return await azureAIService.generateResponse('', validationPrompt);
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isValid: parsed.isValid || false,
          confidence: parsed.confidence || 0,
          extractedInsights: parsed.extractedInsights || [],
          concerns: parsed.concerns || [],
          requiresRedo: parsed.requiresRedo || false,
          redoReason: parsed.redoReason || 'Please provide more detailed information',
        };
      }
    } catch (error) {
      logError('pumpDriveValidated', 'Error message', {});
    }

    // Default to requiring more info if validation fails
    return {
      isValid: false,
      confidence: 0,
      extractedInsights: [],
      concerns: ['Unable to validate response'],
      requiresRedo: true,
      redoReason: 'Please provide more specific information about your preferences and needs',
    };
  }

  /**
   * Extract meaningful insights from validated category response
   */
  private async extractCategoryInsights(
    category: string,
    transcript: string,
    categoryTitle: string
  ): Promise<any> {
    const extractionPrompt = `
Extract specific insights for insulin pump selection from this patient response about "${categoryTitle}":

Patient Response: "${transcript}"

Category: ${category}

Extract and return JSON with relevant insights:

${this.getCategorySpecificPrompt(category)}

Focus on actionable insights that will help recommend the best insulin pump.
Be specific and detailed in your analysis.
`;

    try {
      const response = await aiRequestQueue.queueRequest(async () => {
        return await azureAIService.generateResponse('', extractionPrompt);
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logError('pumpDriveValidated', 'Error message', {});
    }

    return {
      primary: [],
      secondary: [],
      preferences: {},
    };
  }

  /**
   * Get category-specific extraction prompts
   */
  private getCategorySpecificPrompt(category: string): string {
    switch (category) {
      case 'cost':
        return `
{
  "primary": ["main cost concerns"],
  "secondary": ["secondary factors"],
  "preferences": {
    "hasInsurance": boolean,
    "insuranceType": "type if mentioned",
    "budgetConstraints": "specific concerns",
    "preferredCoverage": "dme vs pharmacy",
    "deductibleStatus": "met or not met"
  }
}`;

      case 'lifestyle':
        return `
{
  "primary": ["main lifestyle factors"],
  "secondary": ["additional considerations"],
  "preferences": {
    "activityLevel": "active/moderate/sedentary",
    "specificActivities": ["activities mentioned"],
    "travelFrequency": "how often",
    "waterActivities": "swimming, showering needs",
    "discretionNeeds": "visibility preferences",
    "workEnvironment": "job type/requirements"
  }
}`;

      case 'algorithm':
        return `
{
  "primary": ["control preferences"],
  "secondary": ["automation needs"],
  "preferences": {
    "controlStyle": "hands-on vs automated",
    "tightness": "tight vs flexible control",
    "techComfort": "comfort with technology",
    "currentManagement": "how they manage now",
    "cgmExperience": "CGM usage/preferences"
  }
}`;

      case 'easeToStart':
        return `
{
  "primary": ["learning preferences"],
  "secondary": ["support factors"],
  "preferences": {
    "learningStyle": "simple vs comprehensive",
    "supportSystem": "family/spouse help",
    "previousExperience": "past pump use",
    "trainingNeeds": "how much help needed",
    "techSkills": "comfort with new devices"
  }
}`;

      case 'complexity':
        return `
{
  "primary": ["complexity tolerance"],
  "secondary": ["feature priorities"],
  "preferences": {
    "featureImportance": "basic vs advanced features",
    "menuComplexity": "simple vs detailed menus",
    "customization": "how much they want to customize",
    "maintenanceComfort": "comfort with upkeep"
  }
}`;

      case 'support':
        return `
{
  "primary": ["support needs"],
  "secondary": ["resource preferences"],
  "preferences": {
    "supportImportance": "how critical support is",
    "preferredChannels": "phone, online, in-person",
    "responseTimeNeeds": "urgency requirements",
    "educationPreference": "learning resources wanted"
  }
}`;

      default:
        return `
{
  "primary": ["main insights"],
  "secondary": ["additional factors"],
  "preferences": {}
}`;
    }
  }

  /**
   * Calculate recommendation weights based on extracted insights
   */
  private calculateCategoryWeights(category: string, insights: any): Record<string, number> {
    const weights: Record<string, number> = {};

    // Convert insights to numerical weights for pump scoring
    // This is category-specific logic based on the insights extracted

    switch (category) {
      case 'cost':
        weights.costImportance = insights.preferences?.budgetConstraints ? 0.9 : 0.5;
        weights.insuranceWeight = insights.preferences?.hasInsurance ? 0.8 : 0.3;
        break;

      case 'lifestyle':
        weights.activityWeight = insights.preferences?.activityLevel === 'active' ? 0.9 : 0.4;
        weights.discretionWeight = insights.preferences?.discretionNeeds ? 0.8 : 0.3;
        break;

      // Add more category-specific weighting logic
    }

    return weights;
  }

  /**
   * Check if we have enough validated data to generate final recommendation
   */
  canGenerateFinalRecommendation(processedCategories: ProcessedCategoryData[]): boolean {
    // Need at least 3 categories with high confidence
    const highConfidenceCategories = processedCategories.filter(
      cat => cat.validation.confidence > 0.7
    );

    return highConfidenceCategories.length >= 3;
  }

  /**
   * Generate error message when validation fails
   */
  getValidationErrorMessage(validation: CategoryValidation, categoryTitle: string): string {
    if (validation.redoReason) {
      return `For ${categoryTitle}: ${validation.redoReason}`;
    }

    return `Please provide more specific information about your ${categoryTitle.toLowerCase()} to get accurate pump recommendations.`;
  }
}

export const pumpDriveValidated = new PumpDriveValidatedService();
