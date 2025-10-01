/**
 * Pump Feature Matching Engine
 * Real personalization using 23-dimension pump data
 */

import { PUMP_DATABASE, type PumpData } from '../data/pumpDataSimple';
import { type BalancedQuestion } from '../data/balancedPumpQuestions';

// Feature dimensions with weights - mapped to actual pump data dimensions
export interface FeatureDimension {
  key: string; // Key in dimensions object
  weight: number;
  type: 'string';
}

// All pump dimensions mapped to actual data structure
export const PUMP_DIMENSIONS: FeatureDimension[] = [
  { key: 'tubingStyle', weight: 10, type: 'string' },
  { key: 'algorithm', weight: 9, type: 'string' },
  { key: 'cgmCompatibility', weight: 8, type: 'string' },
  { key: 'phoneControl', weight: 7, type: 'string' },
  { key: 'waterResistance', weight: 8, type: 'string' },
  { key: 'battery', weight: 5, type: 'string' },
  { key: 'reservoirCapacity', weight: 4, type: 'string' },
  { key: 'bolusWorkflow', weight: 7, type: 'string' },
  { key: 'targetAdjustability', weight: 6, type: 'string' },
  { key: 'exerciseMode', weight: 6, type: 'string' },
  { key: 'alertsCustomization', weight: 6, type: 'string' },
  { key: 'dataSharing', weight: 5, type: 'string' },
  { key: 'userInterface', weight: 7, type: 'string' },
  { key: 'wearability', weight: 7, type: 'string' },
  { key: 'ecosystem', weight: 6, type: 'string' },
  { key: 'clinicSupport', weight: 5, type: 'string' },
  { key: 'caregiverFeatures', weight: 4, type: 'string' },
  { key: 'adhesiveTolerance', weight: 6, type: 'string' },
  { key: 'travelLogistics', weight: 4, type: 'string' },
  { key: 'occlusionHandling', weight: 5, type: 'string' },
];

// Map user answers to pump features
export interface AnswerToFeatureMapping {
  questionId: string;
  answerValue: string;
  featurePreferences: {
    dimension: string; // Key in pump dimensions
    desiredValue: string; // What we're looking for
    weight: number;
  }[];
}

// Comprehensive answer-to-feature mappings using actual pump data
export const ANSWER_MAPPINGS: AnswerToFeatureMapping[] = [
  // Primary Priority mappings
  {
    questionId: 'primary_priority',
    answerValue: 'simplicity',
    featurePreferences: [
      { dimension: 'userInterface', desiredValue: 'Touchscreen', weight: 10 }, // Favors t:slim X2
      { dimension: 'algorithm', desiredValue: 'simplicity', weight: 9 }, // Favors Beta Bionics iLet
      { dimension: 'userInterface', desiredValue: 'Minimalist', weight: 8 }, // Favors Beta Bionics iLet
    ],
  },
  {
    questionId: 'primary_priority',
    answerValue: 'technology',
    featurePreferences: [
      { dimension: 'algorithm', desiredValue: 'Control-IQ', weight: 9 }, // Favor t:slim X2 and Mobi
      { dimension: 'phoneControl', desiredValue: 'App', weight: 10 },
      { dimension: 'userInterface', desiredValue: 'Phone', weight: 8 },
      { dimension: 'dataSharing', desiredValue: 'Share', weight: 7 },
    ],
  },
  {
    questionId: 'primary_priority',
    answerValue: 'cost',
    featurePreferences: [
      { dimension: 'battery', desiredValue: 'AA Battery', weight: 8 },
      { dimension: 'reservoirCapacity', desiredValue: '300 units', weight: 7 },
      { dimension: 'clinicSupport', desiredValue: 'Large installed base', weight: 6 },
    ],
  },
  {
    questionId: 'primary_priority',
    answerValue: 'lifestyle',
    featurePreferences: [
      { dimension: 'waterResistance', desiredValue: 'Water-resistant', weight: 10 },
      { dimension: 'tubingStyle', desiredValue: 'Tubeless pod', weight: 9 },
      { dimension: 'wearability', desiredValue: 'Discreet', weight: 8 },
    ],
  },

  // Form Factor mappings
  {
    questionId: 'form_factor',
    answerValue: 'tubeless',
    featurePreferences: [
      { dimension: 'tubingStyle', desiredValue: 'Tubeless pod', weight: 10 },
      { dimension: 'waterResistance', desiredValue: 'Water-resistant', weight: 8 },
      { dimension: 'wearability', desiredValue: 'Discreet', weight: 7 },
    ],
  },
  {
    questionId: 'form_factor',
    answerValue: 'tubing',
    featurePreferences: [
      { dimension: 'tubingStyle', desiredValue: 'Tubed pump', weight: 10 },
      { dimension: 'reservoirCapacity', desiredValue: '300 units', weight: 7 },
      { dimension: 'battery', desiredValue: 'AA Battery', weight: 6 },
    ],
  },

  // Tech Comfort mappings
  {
    questionId: 'tech_comfort',
    answerValue: 'low',
    featurePreferences: [
      { dimension: 'userInterface', desiredValue: 'Buttons', weight: 9 },
      { dimension: 'algorithm', desiredValue: 'Basic', weight: 8 },
      { dimension: 'clinicSupport', desiredValue: 'Large installed base', weight: 8 },
    ],
  },
  {
    questionId: 'tech_comfort',
    answerValue: 'high',
    featurePreferences: [
      { dimension: 'phoneControl', desiredValue: 'App', weight: 10 },
      { dimension: 'userInterface', desiredValue: 'Phone', weight: 9 },
      { dimension: 'algorithm', desiredValue: 'Control-IQ', weight: 8 },
      { dimension: 'dataSharing', desiredValue: 'Share', weight: 7 },
    ],
  },

  // Control Philosophy mappings
  {
    questionId: 'control_philosophy',
    answerValue: 'full_auto',
    featurePreferences: [
      { dimension: 'algorithm', desiredValue: 'auto-corr', weight: 10 }, // Matches multiple pumps
      { dimension: 'cgmCompatibility', desiredValue: 'Dexcom', weight: 8 },
      { dimension: 'phoneControl', desiredValue: 'App', weight: 7 },
    ],
  },
  {
    questionId: 'control_philosophy',
    answerValue: 'wake_me',
    featurePreferences: [
      { dimension: 'alertsCustomization', desiredValue: 'On-pump options', weight: 10 },
      { dimension: 'bolusWorkflow', desiredValue: 'Carb + auto-corr support', weight: 8 },
      { dimension: 'userInterface', desiredValue: 'Buttons', weight: 7 },
    ],
  },

  // Activity Level mappings
  {
    questionId: 'activity_level',
    answerValue: 'very_active',
    featurePreferences: [
      { dimension: 'waterResistance', desiredValue: 'Water-resistant', weight: 10 },
      { dimension: 'exerciseMode', desiredValue: 'Activity temp target', weight: 9 },
      { dimension: 'tubingStyle', desiredValue: 'Tubeless pod', weight: 8 },
      { dimension: 'wearability', desiredValue: 'Discreet', weight: 7 },
    ],
  },

  // Discretion mappings
  {
    questionId: 'discretion_needs',
    answerValue: 'very_important',
    featurePreferences: [
      { dimension: 'tubingStyle', desiredValue: 'Tubeless pod', weight: 10 },
      { dimension: 'wearability', desiredValue: 'Discreet', weight: 9 },
      { dimension: 'phoneControl', desiredValue: 'Full app control', weight: 7 },
    ],
  },

  // Budget mappings
  {
    questionId: 'budget_reality',
    answerValue: 'upfront',
    featurePreferences: [
      { dimension: 'battery', desiredValue: 'AA Battery', weight: 8 },
      { dimension: 'clinicSupport', desiredValue: 'Large installed base', weight: 7 },
    ],
  },
  {
    questionId: 'budget_reality',
    answerValue: 'ongoing',
    featurePreferences: [
      { dimension: 'reservoirCapacity', desiredValue: '300 units', weight: 8 },
      { dimension: 'adhesiveTolerance', desiredValue: 'Set + separate CGM', weight: 6 },
    ],
  },

  // Add mappings that specifically favor other pumps
  {
    questionId: 'primary_priority',
    answerValue: 'lifestyle',
    featurePreferences: [
      { dimension: 'tubingStyle', desiredValue: 'Tubeless pod', weight: 10 }, // Omnipod 5
      { dimension: 'phoneControl', desiredValue: 'Phone or controller', weight: 8 }, // Omnipod 5
      { dimension: 'userInterface', desiredValue: 'Phone or controller', weight: 7 }, // Omnipod 5
    ],
  },

  // Balance cost preferences to help other pumps
  {
    questionId: 'primary_priority',
    answerValue: 'cost',
    featurePreferences: [
      { dimension: 'battery', desiredValue: 'Rechargeable', weight: 9 }, // t:slim X2, Mobi, Beta Bionics, Twiist
      { dimension: 'clinicSupport', desiredValue: 'support', weight: 6 }, // All pumps match partially
      { dimension: 'tubingStyle', desiredValue: 'compact', weight: 7 }, // Twiist advantage
    ],
  },

  {
    questionId: 'form_factor',
    answerValue: 'either',
    featurePreferences: [
      { dimension: 'userInterface', desiredValue: 'Phone-first', weight: 8 }, // Tandem Mobi
      { dimension: 'tubingStyle', desiredValue: 'Very short', weight: 7 }, // Tandem Mobi
      { dimension: 'userInterface', desiredValue: 'Phone-forward', weight: 6 }, // Twiist
    ],
  },

  {
    questionId: 'tech_comfort',
    answerValue: 'medium',
    featurePreferences: [
      { dimension: 'userInterface', desiredValue: 'Touchscreen', weight: 9 }, // t:slim X2
      { dimension: 'algorithm', desiredValue: 'Control-IQ', weight: 8 }, // t:slim X2
      { dimension: 'phoneControl', desiredValue: 'Mobile bolus', weight: 7 }, // t:slim X2
    ],
  },

  {
    questionId: 'control_philosophy',
    answerValue: 'alert_auto',
    featurePreferences: [
      { dimension: 'algorithm', desiredValue: 'adaptive', weight: 10 }, // Twiist
      { dimension: 'userInterface', desiredValue: 'Phone-forward', weight: 9 }, // Twiist
      { dimension: 'phoneControl', desiredValue: 'Phone-centric', weight: 8 }, // Twiist
    ],
  },

  {
    questionId: 'control_philosophy',
    answerValue: 'alert_only',
    featurePreferences: [
      { dimension: 'algorithm', desiredValue: 'Meal-announce', weight: 10 }, // Beta Bionics
      { dimension: 'userInterface', desiredValue: 'Minimalist', weight: 9 }, // Beta Bionics
      { dimension: 'tubingStyle', desiredValue: 'simple sets', weight: 8 }, // Beta Bionics
    ],
  },

  // Add more specific mappings for Beta Bionics & Twiist
  {
    questionId: 'primary_priority',
    answerValue: 'simplicity',
    featurePreferences: [
      { dimension: 'algorithm', desiredValue: 'Meal-announce', weight: 10 }, // Beta Bionics wins
      { dimension: 'userInterface', desiredValue: 'Minimalist', weight: 9 }, // Beta Bionics wins
      { dimension: 'tubingStyle', desiredValue: 'simple', weight: 7 }, // Beta Bionics advantage
    ],
  },

  {
    questionId: 'tech_comfort',
    answerValue: 'medium',
    featurePreferences: [
      { dimension: 'userInterface', desiredValue: 'Phone-forward', weight: 10 }, // Twiist wins
      { dimension: 'algorithm', desiredValue: 'adaptive', weight: 9 }, // Twiist wins
      { dimension: 'battery', desiredValue: 'Rechargeable', weight: 8 }, // Multiple winners
    ],
  },

  // Reduce Medtronic's unfair advantage by making tech_comfort:low less biased
  {
    questionId: 'tech_comfort',
    answerValue: 'low',
    featurePreferences: [
      { dimension: 'userInterface', desiredValue: 'simple', weight: 8 }, // Broader match
      { dimension: 'algorithm', desiredValue: 'simplicity', weight: 9 }, // Beta Bionics advantage
      { dimension: 'clinicSupport', desiredValue: 'support', weight: 6 }, // All pumps match
    ],
  },

  // Add activity mappings that favor different pumps
  {
    questionId: 'activity_level',
    answerValue: 'moderately_active',
    featurePreferences: [
      { dimension: 'battery', desiredValue: 'Rechargeable', weight: 8 }, // Multiple winners
      { dimension: 'tubingStyle', desiredValue: 'short', weight: 7 }, // Tandem Mobi
      { dimension: 'userInterface', desiredValue: 'Phone', weight: 6 }, // Multiple winners
    ],
  },

  {
    questionId: 'discretion_needs',
    answerValue: 'somewhat_important',
    featurePreferences: [
      { dimension: 'tubingStyle', desiredValue: 'compact', weight: 9 }, // Twiist
      { dimension: 'userInterface', desiredValue: 'Phone-forward', weight: 8 }, // Twiist
      { dimension: 'battery', desiredValue: 'new platform', weight: 6 }, // Twiist
    ],
  },
];

export class PumpFeatureEngine {
  private userProfile: Map<string, { value: string; weight: number }[]> = new Map();

  /**
   * Process user answers and build feature preference profile
   */
  processAnswers(answers: Record<string, string | string[]>): void {
    this.userProfile.clear();

    for (const [questionId, answer] of Object.entries(answers)) {
      if (!answer || answer === 'skip') continue;

      // Handle single or multiple answers
      const answerValues = Array.isArray(answer) ? answer : [answer];

      for (const answerValue of answerValues) {
        const mappings = ANSWER_MAPPINGS.filter(
          m => m.questionId === questionId && m.answerValue === answerValue
        );

        for (const mapping of mappings) {
          for (const pref of mapping.featurePreferences) {
            if (!this.userProfile.has(pref.dimension)) {
              this.userProfile.set(pref.dimension, []);
            }
            this.userProfile.get(pref.dimension)!.push({
              value: pref.desiredValue,
              weight: pref.weight,
            });
          }
        }
      }
    }
  }

  // calculatePumpScores method removed - using pure AI recommendations only

  /**
   * Generate personalized explanation for pump recommendation
   */
  generateExplanation(pump: PumpData, matchDetails: any, answers: Record<string, string>): string {
    const explanations: string[] = [];

    // Start with pump name and key feature
    explanations.push(`The ${pump.name} stands out as your best match.`);

    // Add top matching features
    const topMatches = Object.entries(matchDetails)
      .filter(([_, details]: [string, any]) => details.percentage >= 60)
      .sort((a: any, b: any) => b[1].percentage - a[1].percentage)
      .slice(0, 3);

    if (topMatches.length > 0) {
      explanations.push(`Key strengths that match your needs:`);
      for (const [dimension, details] of topMatches) {
        const featureExplanation = this.explainFeature(pump, dimension, details);
        if (featureExplanation) {
          explanations.push(`• ${featureExplanation}`);
        }
      }
    }

    // Add specific answer-based insights
    if (
      answers.primary_priority === 'simplicity' &&
      pump.dimensions.userInterface?.includes('Buttons')
    ) {
      explanations.push(
        `Perfect for your preference for simplicity with its ${pump.dimensions.userInterface}.`
      );
    }

    if (answers.form_factor === 'tubeless' && pump.dimensions.tubingStyle?.includes('Tubeless')) {
      explanations.push(`The tubeless design gives you the freedom and discretion you wanted.`);
    }

    if (
      answers.control_philosophy === 'full_auto' &&
      pump.dimensions.algorithm?.includes('SmartGuard')
    ) {
      explanations.push(
        `Its ${pump.dimensions.algorithm} provides the automation you're looking for.`
      );
    }

    // Add practical considerations
    if (pump.dimensions.waterResistance) {
      explanations.push(`${pump.dimensions.waterResistance} for active lifestyles.`);
    }

    return explanations.join(' ');
  }

  /**
   * Explain a specific feature match
   */
  private explainFeature(pump: PumpData, dimension: string, details: any): string | null {
    const value = pump.dimensions[dimension];

    switch (dimension) {
      case 'tubingStyle':
        return value?.includes('Tubeless')
          ? 'Tubeless pod design for maximum freedom'
          : `${value} design`;
      case 'algorithm':
        return `${value} for optimal glucose control`;
      case 'waterResistance':
        return value ? `${value} design` : null;
      case 'phoneControl':
        return value?.includes('Full')
          ? 'Complete smartphone control via app'
          : `${value} capability`;
      case 'cgmCompatibility':
        return value ? `Compatible with ${value} for automated adjustments` : null;
      case 'userInterface':
        return `${value} interface for easy operation`;
      case 'reservoirCapacity':
        return `${value} insulin capacity`;
      case 'battery':
        return `${value} for convenient power management`;
      case 'wearability':
        return `${value} design for comfort`;
      case 'exerciseMode':
        return value ? `${value} for active users` : null;
      default:
        return value ? `${dimension}: ${value}` : null;
    }
  }

  /**
   * Get pump recommendations with full details - DEPRECATED
   * Use pumpDriveAI.service.ts for AI-based recommendations instead
   */
  getRecommendations(answers: Record<string, string | string[]>): {
    topChoice: { pump: PumpData; score: number; explanation: string };
    alternatives: Array<{ pump: PumpData; score: number; explanation: string }>;
    decisionFactors: string[];
  } {
    throw new Error('Feature-based scoring removed. Use pumpDriveAI.service.ts for AI recommendations.');
  }

  /**
   * Extract key decision factors from user answers
   */
  private extractDecisionFactors(answers: Record<string, string | string[]>): string[] {
    const factors: string[] = [];

    if (answers.primary_priority) {
      const priorityMap: Record<string, string> = {
        simplicity: 'Ease of use is your top priority',
        technology: 'Advanced features matter most to you',
        cost: 'Budget considerations are important',
        lifestyle: 'Active lifestyle compatibility is crucial',
      };
      factors.push(priorityMap[answers.primary_priority as string] || '');
    }

    if (answers.form_factor === 'tubeless') {
      factors.push('You prefer tubeless pod design');
    } else if (answers.form_factor === 'tubing') {
      factors.push('You prefer traditional tubed pumps');
    }

    if (answers.control_philosophy === 'full_auto') {
      factors.push('You want maximum automation');
    } else if (answers.control_philosophy === 'wake_me') {
      factors.push('You prefer manual control with alerts');
    }

    return factors.filter(f => f.length > 0);
  }
}

export const pumpFeatureEngine = new PumpFeatureEngine();
