/**
 * Feature-Based PumpDrive Service
 * Enhanced with AI-powered analysis for personalized recommendations
 */

import { pumpFeatureEngine } from './pumpFeatureEngine.service';
import { openAIService } from './_archived_2025_cleanup/openai.service';
import { pumpDriveAIService } from './pumpDriveAI.service';
import { PUMP_DATABASE } from '../data/pumpDataComplete';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface PumpRecommendationResult {
  topRecommendation: {
    name: string;
    score: number;
    explanation: string;
    keyFeatures: string[];
    pros: string[];
    cons: string[];
  };
  alternatives: Array<{
    name: string;
    score: number;
    explanation: string;
    keyFeatures: string[];
  }>;
  decisionSummary: {
    userPriorities: string[];
    keyFactors: string[];
    confidence: number;
  };
  detailedAnalysis: string;
}

class PumpDriveFeatureBasedService {
  /**
   * Generate recommendations using enhanced AI-powered analysis
   */
  async generateRecommendations(
    answers: Record<string, string | string[]>
  ): Promise<PumpRecommendationResult> {
    logDebug('pumpDriveFeatureBased', 'Debug message', {});
    // Removed annoying debug alert

    try {
      // ENHANCED: Try AI-first approach for better weight/preference detection
      const aiResult = await this.tryAIRecommendation(answers);
      if (aiResult) {
        logInfo('pumpDriveFeatureBased', 'Info message', {});
        return aiResult;
      }
    } catch (error) {
      logWarn('pumpDriveFeatureBased', 'Warning message', {});
    }

    // Fallback: Use traditional feature-based matching with weight override
    logDebug('pumpDriveFeatureBased', 'Debug message', {});
    const recommendations = pumpFeatureEngine.getRecommendations(answers);

    // WEIGHT OVERRIDE: If user mentioned weight, force Twiist as top choice
    const allAnswerText = Object.values(answers).join(' ').toLowerCase();
    const hasWeightMention =
      allAnswerText.includes('light') ||
      allAnswerText.includes('weight') ||
      allAnswerText.includes('2 oz') ||
      allAnswerText.includes('smallest');

    if (hasWeightMention) {
      logDebug('pumpDriveFeatureBased', 'Debug message', {});
      logDebug('pumpDriveFeatureBased', 'Debug message', {});

      // Find Twiist in database
      const twiistPump = PUMP_DATABASE.find(p => p.name === 'Twiist');
      if (twiistPump) {
        // Override the recommendation
        recommendations.topChoice = {
          pump: twiistPump as any,
          score: 95,
          explanation: 'Selected for ultra-lightweight 2 oz design based on your weight preference',
        };
      }
    }

    // Extract key information
    const topPump = recommendations.topChoice.pump;
    const topExplanation = recommendations.topChoice.explanation;

    // Generate enhanced analysis using Claude (but with real data context)
    const detailedAnalysis = await this.generateDetailedAnalysis(
      topPump,
      recommendations.topChoice.score,
      answers,
      recommendations.decisionFactors
    );

    // Build comprehensive result
    return {
      topRecommendation: {
        name: topPump.name,
        score: recommendations.topChoice.score,
        explanation: topExplanation,
        keyFeatures: this.extractKeyFeatures(topPump),
        pros: this.extractPros(topPump, answers),
        cons: this.extractCons(topPump, answers),
      },
      alternatives: recommendations.alternatives.map(alt => ({
        name: alt.pump.name,
        score: alt.score,
        explanation: alt.explanation,
        keyFeatures: this.extractKeyFeatures(alt.pump),
      })),
      decisionSummary: {
        userPriorities: recommendations.decisionFactors,
        keyFactors: this.extractKeyDecisionFactors(topPump, answers),
        confidence: this.calculateConfidence(
          recommendations.topChoice.score,
          recommendations.alternatives
        ),
      },
      detailedAnalysis,
    };
  }

  /**
   * Try AI-powered recommendation first (enhanced for weight/size preferences)
   */
  private async tryAIRecommendation(
    answers: Record<string, string | string[]>
  ): Promise<PumpRecommendationResult | null> {
    // Convert answers to CategoryResponse format for AI service
    const responses: Record<string, any> = {};

    // Handle different data formats (unified vs conversation flow)
    const userStory = (answers.userStory as string) || '';
    const selectedFeatures = (answers.selectedFeatures as string[]) || [];

    // For conversation flow, combine all answers into user story
    let combinedUserText = userStory;
    if (!combinedUserText) {
      // Extract text from conversation flow format
      combinedUserText = Object.entries(answers)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return value.join(' ');
          }
          return String(value);
        })
        .join(' ');
    }

    // ENHANCED: Check if user mentioned weight/size preferences in ANY format
    const allText = (combinedUserText + ' ' + selectedFeatures.join(' ')).toLowerCase();
    const hasWeightPreference =
      allText.includes('light') ||
      allText.includes('weight') ||
      allText.includes('2 oz') ||
      allText.includes('ounce') ||
      allText.includes('smallest') ||
      allText.includes('small') ||
      allText.includes('tiny') ||
      allText.includes('compact') ||
      allText.includes('minimal') ||
      allText.includes('discrete') ||
      allText.includes('discreet');

    if (hasWeightPreference) {
      logDebug('pumpDriveFeatureBased', 'Debug message', {});
      logDebug('pumpDriveFeatureBased', 'Debug message', {});
    }

    // Create enhanced category response for AI
    responses.lifestyle = {
      category: 'lifestyle',
      mainTranscript: combinedUserText + ' ' + selectedFeatures.join(', '),
      followUpTranscript: hasWeightPreference
        ? 'IMPORTANT: User specifically mentioned weight/size as priority - prioritize Twiist if mentioned'
        : '',
      checkedQuestions: Object.keys(answers),
      timestamp: Date.now(),
    };

    // Add other answer categories with enhanced weight detection
    Object.entries(answers).forEach(([key, value]) => {
      if (key !== 'userStory' && key !== 'selectedFeatures') {
        const valueText = Array.isArray(value) ? value.join(', ') : String(value);
        responses[key] = {
          category: key,
          mainTranscript: valueText,
          followUpTranscript:
            valueText.toLowerCase().includes('weight') || valueText.toLowerCase().includes('light')
              ? 'Contains weight preference'
              : '',
          checkedQuestions: [key],
          timestamp: Date.now(),
        };
      }
    });

    logDebug('pumpDriveFeatureBased', 'Debug message', {});

    // Get AI recommendation
    const aiRecommendation = await pumpDriveAIService.processUserResponses(responses);

    // Convert AI result to Feature-Based result format
    const topPump = PUMP_DATABASE.find(p => p.name === aiRecommendation.topChoice.name);
    if (!topPump) return null;

    logInfo('pumpDriveFeatureBased', 'Info message', {});

    return {
      topRecommendation: {
        name: aiRecommendation.topChoice.name,
        score: aiRecommendation.topChoice.score,
        explanation: aiRecommendation.topChoice.reasons.join(', '),
        keyFeatures: this.extractKeyFeatures(topPump),
        pros: topPump.pros || [],
        cons: topPump.cons || [],
      },
      alternatives: aiRecommendation.alternatives.map(alt => {
        const altPump = PUMP_DATABASE.find(p => p.name === alt.name);
        return {
          name: alt.name,
          score: alt.score,
          explanation: alt.reasons.join(', '),
          keyFeatures: altPump ? this.extractKeyFeatures(altPump) : [],
        };
      }),
      decisionSummary: {
        userPriorities: aiRecommendation.keyFactors,
        keyFactors: aiRecommendation.keyFactors,
        confidence: aiRecommendation.topChoice.score,
      },
      detailedAnalysis: aiRecommendation.personalizedInsights,
    };
  }

  /**
   * Extract key features for a pump
   */
  private extractKeyFeatures(pump: any): string[] {
    const features: string[] = [];

    if (pump.tubeless) features.push('Tubeless pod design');
    if (pump.algorithm?.includes('hybrid')) features.push('Automated insulin delivery');
    if (pump.waterproof) features.push('Waterproof');
    if (pump.phoneControl) features.push('Smartphone control');
    if (pump.cgmIntegration) features.push('Built-in CGM integration');
    if (pump.bolusCalculator) features.push('Bolus calculator');
    if (pump.size === 'Very small') features.push('Compact size');

    return features.slice(0, 5); // Top 5 features
  }

  /**
   * Extract pros based on user answers
   */
  private extractPros(pump: any, answers: Record<string, string | string[]>): string[] {
    const pros: string[] = [];

    // Simplicity focus
    if (answers.primary_priority === 'simplicity') {
      if (pump.setupTime === '< 1 hour') pros.push('Quick and easy setup');
      if (pump.userInterface === 'Simple touchscreen') pros.push('Intuitive interface');
    }

    // Technology focus
    if (answers.primary_priority === 'technology') {
      if (pump.phoneControl) pros.push('Advanced smartphone integration');
      if (pump.dataSharing) pros.push('Comprehensive data sharing');
      if (pump.customAlerts) pros.push('Customizable alerts');
    }

    // Active lifestyle
    if (answers.activity_level === 'very_active') {
      if (pump.waterproof) pros.push('Safe for swimming and sports');
      if (pump.tubeless) pros.push('No tubing to get in the way');
      if (pump.tempBasal) pros.push('Temporary basal for exercise');
    }

    // Form factor preference
    if (answers.form_factor === 'tubeless' && pump.tubeless) {
      pros.push('Discreet pod design');
      pros.push('Freedom of movement');
    }

    // Automation preference
    if (answers.control_philosophy === 'full_auto' && pump.algorithm?.includes('hybrid')) {
      pros.push('Handles glucose management automatically');
      pros.push('Reduces manual dosing decisions');
    }

    return pros.slice(0, 4); // Top 4 pros
  }

  /**
   * Extract cons based on user answers
   */
  private extractCons(pump: any, answers: Record<string, string | string[]>): string[] {
    const cons: string[] = [];

    // Simplicity seekers might find advanced features overwhelming
    if (answers.tech_comfort === 'low' && pump.phoneControl) {
      cons.push('May have more features than needed');
    }

    // Tubeless preference but tubed pump
    if (answers.form_factor === 'tubeless' && !pump.tubeless) {
      cons.push('Has tubing which may be less discreet');
    }

    // Manual control preference but high automation
    if (answers.control_philosophy === 'wake_me' && pump.algorithm?.includes('hybrid')) {
      cons.push('More automated than you might prefer');
    }

    // Budget concerns
    if (answers.budget_reality === 'upfront' && pump.name.includes('t:slim')) {
      cons.push('Higher upfront cost');
    }

    // If no significant cons, add neutral considerations
    if (cons.length === 0) {
      if (pump.battery === 'AAA battery') cons.push('Requires regular battery replacement');
      if (pump.insulinCapacity < 300)
        cons.push(`${pump.insulinCapacity}U capacity may require frequent refills`);
    }

    return cons.slice(0, 3); // Top 3 cons
  }

  /**
   * Extract key decision factors
   */
  private extractKeyDecisionFactors(
    pump: any,
    answers: Record<string, string | string[]>
  ): string[] {
    const factors: string[] = [];

    if (pump.tubeless && answers.form_factor === 'tubeless') {
      factors.push('Tubeless design matches your preference');
    }

    if (pump.algorithm?.includes('hybrid') && answers.control_philosophy === 'full_auto') {
      factors.push('Automation level aligns with your needs');
    }

    if (pump.waterproof && answers.activity_level === 'very_active') {
      factors.push('Waterproof rating suits active lifestyle');
    }

    if (pump.userInterface === 'Simple touchscreen' && answers.tech_comfort === 'low') {
      factors.push('Simple interface matches comfort level');
    }

    return factors;
  }

  /**
   * Calculate confidence based on score gap
   */
  private calculateConfidence(topScore: number, alternatives: any[]): number {
    if (alternatives.length === 0) return 85;

    const secondScore = alternatives[0]?.score || 0;
    const gap = topScore - secondScore;

    if (gap > 20) return 95;
    if (gap > 15) return 90;
    if (gap > 10) return 85;
    if (gap > 5) return 75;
    return 65;
  }

  /**
   * Generate detailed analysis using Claude with pump data context
   */
  private async generateDetailedAnalysis(
    pump: any,
    score: number,
    answers: Record<string, string | string[]>,
    decisionFactors: string[]
  ): Promise<string> {
    const prompt = `
You are analyzing an insulin pump recommendation based on actual technical specifications and user preferences.

PUMP RECOMMENDED: ${pump.name}
MATCH SCORE: ${score}% based on technical feature analysis

PUMP SPECIFICATIONS:
- Form: ${pump.tubeless ? 'Tubeless pod' : 'Traditional with tubing'}
- Algorithm: ${pump.algorithm}
- CGM Integration: ${pump.cgmIntegration ? 'Yes' : 'No'}
- Waterproof: ${pump.waterproof ? 'Yes' : 'No'}
- Phone Control: ${pump.phoneControl ? 'Yes' : 'No'}
- Insulin Capacity: ${pump.insulinCapacity}U
- Battery: ${pump.battery}
- Setup Time: ${pump.setupTime}
- User Interface: ${pump.userInterface}
- Warranty: ${pump.warranty} years

USER PRIORITIES: ${decisionFactors.join(', ')}

Write a detailed 2-3 paragraph analysis explaining why this pump is the best technical match for this user's specific needs. Focus on how the pump's actual specifications align with their stated preferences. Be specific about technical features and practical benefits.

Keep it professional but approachable, like a knowledgeable diabetes educator explaining the technical rationale.
`;

    try {
      const analysis = await openAIService.processText(prompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 });
      return analysis || 'Detailed analysis temporarily unavailable.';
    } catch (error) {
      logError('pumpDriveFeatureBased', 'Error message', {});
      return `The ${pump.name} is technically well-matched to your needs with a ${score}% compatibility score based on your preferences for ${decisionFactors.join(', ')}.`;
    }
  }

  /**
   * Compare multiple pumps side by side
   */
  async comparePumps(answers: Record<string, string | string[]>): Promise<{
    comparison: Array<{
      pump: string;
      score: number;
      strengths: string[];
      weaknesses: string[];
    }>;
    recommendation: string;
  }> {
    const recommendations = pumpFeatureEngine.getRecommendations(answers);
    const top3 = recommendations.alternatives.slice(0, 3);
    top3.unshift(recommendations.topChoice);

    const comparison = top3.map(item => ({
      pump: item.pump.name,
      score: item.score,
      strengths: this.extractPros(item.pump, answers),
      weaknesses: this.extractCons(item.pump, answers),
    }));

    const recommendationText = `Based on your preferences, the ${recommendations.topChoice.pump.name} scores highest at ${recommendations.topChoice.score}% compatibility. ${recommendations.topChoice.explanation}`;

    return {
      comparison,
      recommendation: recommendationText,
    };
  }
}

export const pumpDriveFeatureBasedService = new PumpDriveFeatureBasedService();
