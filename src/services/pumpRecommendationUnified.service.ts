/**
 * Unified Pump Recommendation Service
 * Combines persona-based and feature-based matching approaches
 */

import { pumpPersonaEngine, type PatientPersona } from './pumpPersonaEngine.service';
import { pumpFeatureEngine } from './pumpFeatureEngine.service';
import { azureAIService } from './azureAI.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface UnifiedRecommendationRequest {
  // Primary approach: Persona-based
  selectedPersona?: string;
  dealBreakers?: Record<string, string>;
  clinicalFactors?: Record<string, string>;

  // Fallback approach: Feature-based
  traditionalAnswers?: Record<string, string | string[]>;

  // Hybrid approach: Natural language
  userDescription?: string;
}

export interface UnifiedRecommendationResult {
  approach: 'persona' | 'feature' | 'hybrid';
  confidence: number;
  topRecommendation: {
    name: string;
    score: number;
    explanation: string;
    keyFeatures: string[];
    pros: string[];
    cons: string[];
    personaMatch?: string;
    clinicalNotes?: string[];
  };
  alternatives: Array<{
    name: string;
    score: number;
    explanation: string;
    keyFeatures: string[];
    personaMatch?: string;
  }>;
  methodology: {
    approach: string;
    reasoning: string;
    dataUsed: string[];
  };
}

class PumpRecommendationUnifiedService {
  /**
   * Get recommendations using the most appropriate approach
   */
  async getRecommendations(
    request: UnifiedRecommendationRequest
  ): Promise<UnifiedRecommendationResult> {
    // Determine best approach based on available data
    if (request.selectedPersona) {
      return this.getPersonaBasedRecommendations(request);
    }

    if (request.userDescription) {
      return this.getHybridRecommendations(request);
    }

    if (request.traditionalAnswers) {
      return this.getFeatureBasedRecommendations(request);
    }

    throw new Error('No sufficient data provided for recommendations');
  }

  /**
   * Persona-based recommendations (preferred approach)
   */
  private async getPersonaBasedRecommendations(
    request: UnifiedRecommendationRequest
  ): Promise<UnifiedRecommendationResult> {
    const { selectedPersona, dealBreakers = {}, clinicalFactors = {} } = request;

    if (!selectedPersona) {
      throw new Error('Persona required for persona-based recommendations');
    }

    // Get persona recommendations
    const personaResult = pumpPersonaEngine.getPersonaRecommendations(
      selectedPersona,
      dealBreakers
    );

    // Apply clinical rules
    const clinicallyAdjusted = pumpPersonaEngine.applyClinicalRules(
      personaResult.recommendations,
      clinicalFactors
    );

    if (clinicallyAdjusted.length === 0) {
      throw new Error('No pumps match your requirements after applying filters');
    }

    const topChoice = clinicallyAdjusted[0];
    const alternatives = clinicallyAdjusted.slice(1, 4);

    // Generate detailed explanation
    const detailedExplanation = await this.generatePersonaExplanation(
      topChoice,
      selectedPersona,
      dealBreakers,
      clinicalFactors
    );

    return {
      approach: 'persona',
      confidence: this.calculatePersonaConfidence(
        topChoice,
        alternatives,
        personaResult.eliminated
      ),
      topRecommendation: {
        name: topChoice.pump.name,
        score: Math.round(topChoice.matchScore),
        explanation: detailedExplanation,
        keyFeatures: this.extractKeyFeatures(topChoice.pump),
        pros: topChoice.pump.pros || [],
        cons: topChoice.pump.cons || [],
        personaMatch: topChoice.persona,
        clinicalNotes: this.getClinicalNotes(topChoice.pump, clinicalFactors),
      },
      alternatives: alternatives.map(alt => ({
        name: alt.pump.name,
        score: Math.round(alt.matchScore),
        explanation: alt.reason,
        keyFeatures: this.extractKeyFeatures(alt.pump).slice(0, 3),
        personaMatch: alt.persona,
      })),
      methodology: {
        approach: 'Persona-based matching',
        reasoning: `Matched your ${selectedPersona.replace('_', ' ')} profile with expert-curated pump recommendations`,
        dataUsed: [
          'Patient persona',
          'Deal-breaker preferences',
          'Clinical factors',
          'Pump idealFor data',
        ],
      },
    };
  }

  /**
   * Hybrid natural language + persona approach
   */
  private async getHybridRecommendations(
    request: UnifiedRecommendationRequest
  ): Promise<UnifiedRecommendationResult> {
    const { userDescription = '' } = request;

    // Extract keywords from description
    const keywords = this.extractKeywords(userDescription);

    // Find best matching persona
    const bestPersona = pumpPersonaEngine.findBestPersona(keywords);

    if (bestPersona) {
      // Use persona-based approach with inferred persona
      return this.getPersonaBasedRecommendations({
        ...request,
        selectedPersona: bestPersona.id,
      });
    }

    // Fallback to feature-based with natural language processing
    return this.getFeatureBasedWithNLP(request);
  }

  /**
   * Feature-based recommendations (fallback)
   */
  private async getFeatureBasedRecommendations(
    request: UnifiedRecommendationRequest
  ): Promise<UnifiedRecommendationResult> {
    const { traditionalAnswers = {} } = request;

    const featureResult = pumpFeatureEngine.getRecommendations(traditionalAnswers);

    return {
      approach: 'feature',
      confidence: this.calculateFeatureConfidence(featureResult),
      topRecommendation: {
        name: featureResult.topChoice.pump.name,
        score: Math.round(featureResult.topChoice.score),
        explanation: featureResult.topChoice.explanation,
        keyFeatures: this.extractKeyFeatures(featureResult.topChoice.pump),
        pros: featureResult.topChoice.pump.pros || [],
        cons: featureResult.topChoice.pump.cons || [],
      },
      alternatives: featureResult.alternatives.map(alt => ({
        name: alt.pump.name,
        score: Math.round(alt.score),
        explanation: alt.explanation,
        keyFeatures: this.extractKeyFeatures(alt.pump).slice(0, 3),
      })),
      methodology: {
        approach: 'Feature-based matching',
        reasoning: 'Analyzed your specific preferences against detailed pump specifications',
        dataUsed: [
          'Questionnaire answers',
          '23+ pump dimensions',
          'Feature weights',
          'Compatibility rules',
        ],
      },
    };
  }

  /**
   * Generate persona-specific explanation
   */
  private async generatePersonaExplanation(
    topChoice: any,
    personaId: string,
    dealBreakers: Record<string, string>,
    clinicalFactors: Record<string, string>
  ): Promise<string> {
    const persona = pumpPersonaEngine.getAllPersonas().find(p => p.id === personaId);

    let explanation = `As ${persona?.name || 'your profile type'}, the ${topChoice.pump.name} is your ideal match. `;
    explanation += topChoice.reason;

    // Add deal-breaker considerations
    if (Object.keys(dealBreakers).length > 0) {
      explanation += ' It meets all your essential requirements';

      if (dealBreakers.tubeless_requirement === 'yes_tubeless') {
        explanation += ' with its tubeless design';
      }
      if (dealBreakers.waterproof_requirement === 'yes_waterproof') {
        explanation += ' and waterproof construction';
      }
      explanation += '.';
    }

    // Add clinical considerations
    if (clinicalFactors.insulin_needs === 'high') {
      explanation += ` With its ${topChoice.pump.dimensions.reservoirCapacity} capacity, it handles high insulin requirements effectively.`;
    }

    return explanation;
  }

  /**
   * Extract key features from pump data
   */
  private extractKeyFeatures(pump: any): string[] {
    const features: string[] = [];

    if (pump.dimensions.tubingStyle?.includes('Tubeless')) {
      features.push('Tubeless pod design');
    }
    if (
      pump.dimensions.algorithm?.includes('SmartGuard') ||
      pump.dimensions.algorithm?.includes('Control-IQ')
    ) {
      features.push('Automated insulin delivery');
    }
    if (pump.dimensions.waterResistance) {
      features.push('Water-resistant');
    }
    if (pump.dimensions.phoneControl?.includes('App')) {
      features.push('Smartphone control');
    }
    if (pump.dimensions.battery === 'AA Battery') {
      features.push('Replaceable AA battery');
    } else if (pump.dimensions.battery?.includes('Rechargeable')) {
      features.push('Rechargeable battery');
    }

    // Add from pros if available
    if (pump.pros) {
      features.push(...pump.pros.slice(0, 3));
    }

    return features.slice(0, 5);
  }

  /**
   * Get clinical notes for a pump
   */
  private getClinicalNotes(pump: any, clinicalFactors: Record<string, string>): string[] {
    const notes: string[] = [];

    if (clinicalFactors.experience === 'new') {
      if (pump.name.includes('Beta Bionics')) {
        notes.push('Excellent choice for beginners - minimal learning curve');
      } else if (pump.name.includes('Omnipod')) {
        notes.push('Tubeless design simplifies initial pump adoption');
      }
    }

    if (clinicalFactors.insulin_needs === 'high') {
      notes.push(`${pump.dimensions.reservoirCapacity} capacity suitable for high-dose users`);
    }

    return notes;
  }

  /**
   * Calculate confidence for persona-based recommendations
   */
  private calculatePersonaConfidence(
    topChoice: any,
    alternatives: any[],
    eliminated: string[]
  ): number {
    let confidence = 80; // Base confidence for persona matching

    // Higher confidence if clear winner
    if (alternatives.length > 0) {
      const gap = topChoice.matchScore - alternatives[0].matchScore;
      if (gap > 15) confidence += 15;
      else if (gap > 10) confidence += 10;
      else if (gap > 5) confidence += 5;
    }

    // Lower confidence if many pumps eliminated
    if (eliminated.length > 3) confidence -= 10;

    return Math.min(Math.max(confidence, 60), 95);
  }

  /**
   * Calculate confidence for feature-based recommendations
   */
  private calculateFeatureConfidence(featureResult: any): number {
    const topScore = featureResult.topChoice.score;
    const secondScore = featureResult.alternatives[0]?.score || 0;

    if (topScore - secondScore > 20) return 90;
    if (topScore - secondScore > 15) return 85;
    if (topScore - secondScore > 10) return 80;
    return 75;
  }

  /**
   * Extract keywords from user description
   */
  private extractKeywords(description: string): string[] {
    const text = description.toLowerCase();
    const keywords: string[] = [];

    // Tech-related keywords
    if (/\b(app|smartphone|phone|tech|data|control)\b/.test(text)) {
      keywords.push('technology', 'app', 'data');
    }

    // Activity keywords
    if (/\b(swim|sport|active|exercise|water|beach)\b/.test(text)) {
      keywords.push('active', 'swimming', 'sports');
    }

    // Simplicity keywords
    if (/\b(simple|easy|basic|minimal|straightforward)\b/.test(text)) {
      keywords.push('simple', 'easy', 'minimal');
    }

    // Control keywords
    if (/\b(control|tight|precise|aggressive|data)\b/.test(text)) {
      keywords.push('control', 'precision', 'data');
    }

    return keywords;
  }

  /**
   * Feature-based with NLP processing
   */
  private async getFeatureBasedWithNLP(
    request: UnifiedRecommendationRequest
  ): Promise<UnifiedRecommendationResult> {
    // Convert natural language to traditional answers using AI
    const traditionalAnswers = await this.convertDescriptionToAnswers(
      request.userDescription || ''
    );

    return this.getFeatureBasedRecommendations({
      ...request,
      traditionalAnswers,
    });
  }

  /**
   * Convert natural language description to structured answers
   */
  private async convertDescriptionToAnswers(description: string): Promise<Record<string, string>> {
    const prompt = `
Convert this patient description into pump preference answers:
"${description}"

Map to these categories:
- primary_priority: simplicity, technology, cost, lifestyle
- form_factor: tubeless, tubing, either  
- tech_comfort: low, medium, high
- activity_level: very_active, moderately_active, less_active
- control_philosophy: full_auto, alert_auto, wake_me, alert_only

Return JSON with mappings or null if unclear.
`;

    try {
      const response = await azureAIService.generateResponse(prompt);
      return JSON.parse(response || '{}');
    } catch (error) {
      logWarn('pumpRecommendationUnified', 'Warning message', {});
      return {};
    }
  }
}

export const pumpRecommendationUnifiedService = new PumpRecommendationUnifiedService();
