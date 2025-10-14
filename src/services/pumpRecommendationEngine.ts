// Enhanced Pump Recommendation Engine with Multi-Category Analysis
// Uses Claude 3.5 Sonnet for intelligent recommendations

import { PUMP_DATABASE } from '../data/pumpDataComplete';
import type { PumpDetails } from '../data/pumpDataComplete';
import { azureAIService } from './azureAI.service';

export interface UserPreferences {
  // From questionnaire answers
  tubingPreference?: number; // 1-3 scale
  controlPreference?: number;
  targetAdjustability?: number;
  appControl?: number;
  carbCounting?: number;
  automationTrust?: number;
  exerciseMode?: number;
  visibility?: number;
  clinicSupport?: number;

  // Additional patient data
  age?: number;
  techComfort?: number; // 1-10 scale
  activityLevel?: 'sedentary' | 'moderate' | 'active' | 'very_active';
  travelFrequency?: 'never' | 'occasional' | 'frequent';
  insurance?: 'excellent' | 'good' | 'limited' | 'none';
  cgmUsage?: string;
  priorityFactors?: string[]; // e.g., ['comfort', 'algorithm', 'cost', 'ease', 'support']
}

export interface CategoryRecommendation {
  category: string;
  pump: PumpDetails;
  score: number;
  reasoning: string;
  keyPoints: string[];
}

export interface ComprehensiveRecommendation {
  comfort: CategoryRecommendation;
  algorithm: CategoryRecommendation;
  cost: CategoryRecommendation;
  easeOfSetup: CategoryRecommendation;
  ongoingSupport: CategoryRecommendation;
  overallTop: CategoryRecommendation;
  summary: string;
  conversationStarters: string[];
}

class PumpRecommendationEngine {
  // Calculate comfort score based on physical wearing experience
  private calculateComfortScore(pump: PumpDetails, preferences: UserPreferences): number {
    let score = 0;

    // Tubing preference is major factor for comfort
    if (preferences.tubingPreference) {
      if (preferences.tubingPreference === 3 && pump.dimensions.tubing.type === 'tubeless') {
        score += 30;
      } else if (
        preferences.tubingPreference === 2 &&
        pump.dimensions.tubing.type === 'short-tube'
      ) {
        score += 25;
      } else if (preferences.tubingPreference === 1 && pump.dimensions.tubing.type === 'tubed') {
        score += 20;
      }
    }

    // Discretion and visibility
    if (preferences.visibility === 3 && pump.dimensions.discretion.visibility === 'low') {
      score += 20;
    }

    // Water resistance for active users
    if (
      preferences.activityLevel === 'very_active' &&
      pump.dimensions.waterResistance.submersible
    ) {
      score += 15;
    }

    // Battery convenience
    if (pump.dimensions.battery.type === 'pod-integrated') {
      score += 15; // No charging hassle
    } else if (pump.dimensions.battery.type === 'rechargeable') {
      score += 10;
    }

    // Size and weight
    if (
      pump.dimensions.discretion.size === 'compact' ||
      pump.dimensions.discretion.size === 'small'
    ) {
      score += 10;
    }

    // Interface ease
    if (pump.dimensions.interface.type === 'touchscreen') {
      score += 10;
    }

    return Math.min(100, score);
  }

  // Calculate algorithm performance score
  private calculateAlgorithmScore(pump: PumpDetails, preferences: UserPreferences): number {
    let score = 0;

    // Automation trust and capability
    if (preferences.automationTrust === 3) {
      if (pump.dimensions.algorithm.aggressiveness === 'aggressive') {
        score += 30;
      } else if (pump.dimensions.algorithm.aggressiveness === 'moderate') {
        score += 20;
      }
    }

    // Adjustment frequency (all are 5 minutes, so equal)
    score += 15;

    // Target customization
    if (preferences.targetAdjustability === 3 && pump.dimensions.targetAdjustability.customizable) {
      score += 20;
    }

    // Exercise modes for active users
    if (preferences.exerciseMode === 3 && pump.dimensions.exerciseMode.available) {
      score += 15;
    }

    // Carb counting preference
    if (
      preferences.carbCounting === 1 &&
      pump.dimensions.bolusWorkflow.carbCounting === 'not-required'
    ) {
      score += 20; // Beta Bionics iLet advantage
    } else if (
      preferences.carbCounting === 3 &&
      pump.dimensions.bolusWorkflow.carbCounting !== 'not-required'
    ) {
      score += 15;
    }

    return Math.min(100, score);
  }

  // Calculate cost-effectiveness score
  private calculateCostScore(pump: PumpDetails, preferences: UserPreferences): number {
    let score = 0;

    // Insurance coverage type
    if (pump.dimensions.cost.coverage === 'pharmacy') {
      score += 30; // Often easier to get covered
    } else if (pump.dimensions.cost.coverage === 'both') {
      score += 25; // Flexible options
    } else {
      score += 15; // DME only
    }

    // Financial assistance programs
    if (pump.dimensions.cost.financialAssistance) {
      score += 25;
    }

    // Pod systems may have higher ongoing costs but easier coverage
    if (pump.dimensions.tubing.type === 'tubeless') {
      score += 10; // Pharmacy benefits often better
    }

    // Battery costs (AA batteries vs rechargeable)
    if (
      pump.dimensions.battery.type === 'rechargeable' ||
      pump.dimensions.battery.type === 'pod-integrated'
    ) {
      score += 15; // No battery purchases
    }

    // Supply simplicity
    if (pump.name === 'Omnipod 5') {
      score += 10; // Simple pod replacements
    }

    // Travel programs
    if (pump.dimensions.travel.loanerProgram) {
      score += 10; // t:slim X2 advantage
    }

    return Math.min(100, score);
  }

  // Calculate ease of setup score
  private calculateEaseOfSetupScore(pump: PumpDetails, preferences: UserPreferences): number {
    let score = 0;

    // Simplicity of interface
    if (pump.dimensions.interface.type === 'touchscreen') {
      score += 20;
    } else if (pump.dimensions.interface.type === 'phone-only') {
      if (preferences.techComfort && preferences.techComfort >= 7) {
        score += 25; // Tech-savvy users prefer phone control
      } else {
        score += 10;
      }
    }

    // CGM compatibility with current CGM
    if (
      preferences.cgmUsage &&
      pump.dimensions.cgmCompatibility.compatible.includes(preferences.cgmUsage)
    ) {
      score += 25;
    }

    // No carb counting requirement (Beta Bionics iLet)
    if (pump.dimensions.bolusWorkflow.carbCounting === 'not-required') {
      score += 20;
    }

    // Clinic familiarity
    if (
      pump.dimensions.clinicSupport.established === 'large' ||
      pump.dimensions.clinicSupport.established === 'broad'
    ) {
      score += 20;
    }

    // Automatic updates
    if (pump.dimensions.updates.automatic) {
      score += 15;
    }

    return Math.min(100, score);
  }

  // Calculate ongoing support needs score (lower is better - less burden)
  private calculateSupportScore(pump: PumpDetails, preferences: UserPreferences): number {
    let score = 0;

    // Established support network
    if (
      pump.dimensions.clinicSupport.established === 'large' ||
      pump.dimensions.clinicSupport.established === 'broad'
    ) {
      score += 30;
    } else if (pump.dimensions.clinicSupport.established === 'growing') {
      score += 15;
    }

    // Remote monitoring for caregivers
    if (pump.dimensions.pediatric.remoteMonitoring) {
      score += 20;
    }

    // Simplified alerts (less alarm fatigue)
    if (pump.name === 'Beta Bionics iLet') {
      score += 15; // Only 4 essential alerts
    }

    // Data sharing platform quality
    if (pump.dimensions.dataSharing.platform) {
      score += 15;
    }

    // Reliability and occlusion handling
    if (pump.dimensions.reliability.occlusionDetection) {
      score += 10;
    }

    // Ecosystem maturity
    if (pump.dimensions.ecosystem.integrations.length > 1) {
      score += 10;
    }

    return Math.min(100, score);
  }

  // Get pump recommendation for a specific category
  private getCategoryRecommendation(
    category: 'comfort' | 'algorithm' | 'cost' | 'easeOfSetup' | 'ongoingSupport',
    preferences: UserPreferences
  ): CategoryRecommendation {
    const scores = PUMP_DATABASE.map(pump => {
      let score: number;
      switch (category) {
        case 'comfort':
          score = this.calculateComfortScore(pump, preferences);
          break;
        case 'algorithm':
          score = this.calculateAlgorithmScore(pump, preferences);
          break;
        case 'cost':
          score = this.calculateCostScore(pump, preferences);
          break;
        case 'easeOfSetup':
          score = this.calculateEaseOfSetupScore(pump, preferences);
          break;
        case 'ongoingSupport':
          score = this.calculateSupportScore(pump, preferences);
          break;
      }
      return { pump, score };
    });

    // Sort by score and get the top pump
    scores.sort((a, b) => b.score - a.score);
    const topPump = scores[0];

    // Generate reasoning based on category
    const reasoning = this.generateCategoryReasoning(category, topPump.pump, preferences);
    const keyPoints = this.generateKeyPoints(category, topPump.pump);

    return {
      category: this.getCategoryTitle(category),
      pump: topPump.pump,
      score: topPump.score,
      reasoning,
      keyPoints,
    };
  }

  private getCategoryTitle(category: string): string {
    const titles: Record<string, string> = {
      comfort: 'Daily Comfort & Wearability',
      algorithm: 'Algorithm Performance & Control',
      cost: 'Cost-Effectiveness & Coverage',
      easeOfSetup: 'Ease of Getting Started',
      ongoingSupport: 'Ongoing Support & Management',
    };
    return titles[category] || category;
  }

  private generateCategoryReasoning(
    category: string,
    pump: PumpDetails,
    preferences: UserPreferences
  ): string {
    switch (category) {
      case 'comfort':
        return `The ${pump.name} offers the best comfort for your lifestyle. ${
          pump.dimensions.tubing.type === 'tubeless'
            ? 'Its tubeless design means no tubing to manage during daily activities.'
            : pump.dimensions.tubing.type === 'short-tube'
              ? 'Its short-tube design minimizes tubing management while maintaining flexibility.'
              : 'Its traditional tubing provides reliable insulin delivery with familiar wear options.'
        } ${pump.dimensions.discretion.details}`;

      case 'algorithm':
        return `The ${pump.name} provides ${pump.dimensions.algorithm.aggressiveness} algorithm performance with ${pump.dimensions.algorithm.type}. ${pump.dimensions.algorithm.details} This pump adjusts insulin ${pump.dimensions.algorithm.adjustmentFrequency.toLowerCase()}, ${
          pump.dimensions.bolusWorkflow.carbCounting === 'not-required'
            ? 'and uniquely does not require carb counting.'
            : 'with flexible carb counting options.'
        }`;

      case 'cost':
        return `The ${pump.name} offers excellent value through ${pump.dimensions.cost.coverage} coverage. ${
          pump.dimensions.cost.financialAssistance
            ? `Financial assistance available: ${pump.dimensions.cost.financialAssistance}. `
            : ''
        }${pump.dimensions.cost.details}`;

      case 'easeOfSetup':
        return `The ${pump.name} is one of the easiest to start with. ${
          pump.dimensions.clinicSupport.established === 'large' ||
          pump.dimensions.clinicSupport.established === 'broad'
            ? 'Most clinics are very familiar with this system. '
            : ''
        }${pump.dimensions.interface.details} ${
          pump.dimensions.bolusWorkflow.carbCounting === 'not-required'
            ? 'No carb counting required makes it especially simple to learn.'
            : ''
        }`;

      case 'ongoingSupport':
        return `The ${pump.name} requires ${
          pump.name === 'Beta Bionics iLet'
            ? 'minimal ongoing management with only 4 essential alerts and no carb counting.'
            : pump.name === 'Omnipod 5'
              ? 'simple pod changes every 3 days with no other maintenance.'
              : `standard pump maintenance with ${pump.dimensions.clinicSupport.details.toLowerCase()}.`
        } ${pump.dimensions.dataSharing.details}`;

      default:
        return '';
    }
  }

  private generateKeyPoints(category: string, pump: PumpDetails): string[] {
    const points: string[] = [];

    switch (category) {
      case 'comfort':
        points.push(`${pump.dimensions.tubing.type} design`);
        if (pump.dimensions.waterResistance.submersible) {
          points.push(`Waterproof to ${pump.dimensions.waterResistance.depth}`);
        }
        points.push(pump.dimensions.battery.details);
        if (pump.dimensions.discretion.details) {
          points.push(pump.dimensions.discretion.details);
        }
        break;

      case 'algorithm':
        points.push(`${pump.dimensions.algorithm.type} algorithm`);
        points.push(`Adjusts ${pump.dimensions.algorithm.adjustmentFrequency.toLowerCase()}`);
        if (pump.dimensions.targetAdjustability.customizable) {
          points.push('Customizable glucose targets');
        }
        if (pump.dimensions.exerciseMode.available) {
          points.push(
            `Exercise mode: ${pump.dimensions.exerciseMode.targetRange || pump.dimensions.exerciseMode.type}`
          );
        }
        break;

      case 'cost':
        points.push(`${pump.dimensions.cost.coverage} coverage`);
        if (pump.dimensions.cost.financialAssistance) {
          points.push(pump.dimensions.cost.financialAssistance);
        }
        if (
          pump.dimensions.battery.type === 'rechargeable' ||
          pump.dimensions.battery.type === 'pod-integrated'
        ) {
          points.push('No battery costs');
        }
        break;

      case 'easeOfSetup':
        points.push(`${pump.dimensions.interface.type} interface`);
        points.push(`${pump.dimensions.clinicSupport.established} clinic support`);
        if (pump.dimensions.cgmCompatibility.compatible.length > 0) {
          points.push(`Works with ${pump.dimensions.cgmCompatibility.compatible.join(', ')}`);
        }
        break;

      case 'ongoingSupport':
        if (pump.dimensions.pediatric.remoteMonitoring) {
          points.push('Remote monitoring available');
        }
        points.push(pump.dimensions.updates.details);
        if (pump.dimensions.alerts.customizable) {
          points.push('Customizable alerts');
        } else if (pump.name === 'Beta Bionics iLet') {
          points.push('Only 4 essential alerts');
        }
        break;
    }

    return points;
  }

  // Generate comprehensive recommendations
  async generateComprehensiveRecommendations(
    preferences: UserPreferences
  ): Promise<ComprehensiveRecommendation> {
    // Get recommendations for each category
    const comfort = this.getCategoryRecommendation('comfort', preferences);
    const algorithm = this.getCategoryRecommendation('algorithm', preferences);
    const cost = this.getCategoryRecommendation('cost', preferences);
    const easeOfSetup = this.getCategoryRecommendation('easeOfSetup', preferences);
    const ongoingSupport = this.getCategoryRecommendation('ongoingSupport', preferences);

    // Calculate overall top recommendation
    const overallScores = PUMP_DATABASE.map(pump => {
      const totalScore =
        this.calculateComfortScore(pump, preferences) * 0.25 +
        this.calculateAlgorithmScore(pump, preferences) * 0.3 +
        this.calculateCostScore(pump, preferences) * 0.15 +
        this.calculateEaseOfSetupScore(pump, preferences) * 0.15 +
        this.calculateSupportScore(pump, preferences) * 0.15;

      return { pump, score: totalScore };
    });

    overallScores.sort((a, b) => b.score - a.score);
    const overallTop = {
      category: 'Overall Best Match',
      pump: overallScores[0].pump,
      score: Math.round(overallScores[0].score),
      reasoning: `Considering all factors, the ${overallScores[0].pump.name} is your best overall match. It balances your preferences across comfort, algorithm performance, cost, ease of setup, and ongoing support needs.`,
      keyPoints: [
        `Best overall score: ${Math.round(overallScores[0].score)}%`,
        `Top choice in ${this.countTopCategories(overallScores[0].pump, [comfort, algorithm, cost, easeOfSetup, ongoingSupport])} categories`,
        'Balances all your priorities effectively',
      ],
    };

    // Generate summary using AI if available
    const summary = await this.generateAISummary(preferences, {
      comfort,
      algorithm,
      cost,
      easeOfSetup,
      ongoingSupport,
      overallTop,
    });

    // Generate conversation starters
    const conversationStarters = this.generateConversationStarters(overallTop.pump, preferences);

    return {
      comfort,
      algorithm,
      cost,
      easeOfSetup,
      ongoingSupport,
      overallTop,
      summary,
      conversationStarters,
    };
  }

  private countTopCategories(pump: PumpDetails, categories: CategoryRecommendation[]): number {
    return categories.filter(cat => cat.pump.name === pump.name).length;
  }

  private async generateAISummary(
    preferences: UserPreferences,
    recommendations: any
  ): Promise<string> {
    // For now, return a structured summary
    // In production, this would call Claude 3.5 via Bedrock
    const topPump = recommendations.overallTop.pump.name;
    const comfortPump = recommendations.comfort.pump.name;
    const algorithmPump = recommendations.algorithm.pump.name;

    let summary = `Based on your preferences and lifestyle, here's your personalized pump analysis:\n\n`;

    if (topPump === comfortPump && topPump === algorithmPump) {
      summary += `**Clear Winner:** The ${topPump} excels across multiple categories and is your best choice for both daily comfort and diabetes management.\n\n`;
    } else {
      summary += `**Your Best Options:**\n`;
      summary += `• **For daily comfort:** ${comfortPump} - ${recommendations.comfort.pump.dimensions.tubing.type} design\n`;
      summary += `• **For best control:** ${algorithmPump} - ${recommendations.algorithm.pump.dimensions.algorithm.type}\n`;
      summary += `• **Overall best match:** ${topPump}\n\n`;
    }

    summary += `**Key Insights:**\n`;
    if (preferences.automationTrust === 3) {
      summary += `• You trust automation, making advanced algorithms a priority\n`;
    }
    if (preferences.tubingPreference === 3) {
      summary += `• Tubeless or minimal tubing is important for your lifestyle\n`;
    }
    if (preferences.carbCounting === 1) {
      summary += `• Simplified meal management without carb counting would benefit you\n`;
    }

    return summary;
  }

  private generateConversationStarters(pump: PumpDetails, preferences: UserPreferences): string[] {
    const starters: string[] = [];

    starters.push(`Tell me more about ${pump.name}'s ${pump.dimensions.algorithm.type} algorithm`);

    if (pump.dimensions.tubing.type === 'tubeless') {
      starters.push('How do I manage pod changes and placement sites?');
    } else {
      starters.push('What are my infusion set options?');
    }

    if (preferences.activityLevel === 'active' || preferences.activityLevel === 'very_active') {
      starters.push('How does this pump handle exercise and sports?');
    }

    starters.push('What training and support is available in my area?');
    starters.push('Can you compare insurance coverage options?');

    return starters;
  }
}

export const pumpRecommendationEngine = new PumpRecommendationEngine();
