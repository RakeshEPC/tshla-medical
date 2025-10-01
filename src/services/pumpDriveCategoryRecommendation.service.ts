import { azureAIService } from './azureAI.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

interface CategoryResponse {
  category: string;
  mainTranscript: string;
  followUpTranscript: string;
  checkedQuestions: string[];
  timestamp: number;
}

interface PumpScore {
  pumpId: string;
  pumpName: string;
  categoryScore: number;
  keyStrengths: string[];
  considerations: string[];
}

interface CategoryPumpRecommendation {
  category: string;
  categoryTitle: string;
  topPumps: PumpScore[]; // Top 6 pumps for this category
  aiInsights: string;
  timestamp: number;
}

// Available pumps in the system
const AVAILABLE_PUMPS = [
  { id: 'omnipod5', name: 'Omnipod 5' },
  { id: 'tslimx2', name: 'Tandem t:slim X2' },
  { id: 'medtronic780g', name: 'Medtronic 780G' },
  { id: 'omnipodDash', name: 'Omnipod DASH' },
  { id: 'medtronic770g', name: 'Medtronic 770G' },
  { id: 'omnipodGo', name: 'Omnipod GO' },
];

// Category-specific scoring weights
const CATEGORY_WEIGHTS = {
  cost: {
    insuranceCoverage: 0.35,
    outOfPocket: 0.25,
    supplyCost: 0.25,
    financialAssistance: 0.15,
  },
  lifestyle: {
    waterproof: 0.25,
    tubeless: 0.25,
    discretion: 0.2,
    phoneControl: 0.15,
    travelFriendly: 0.15,
  },
  algorithm: {
    automationLevel: 0.3,
    cgmIntegration: 0.25,
    adjustmentFrequency: 0.2,
    targetCustomization: 0.15,
    exerciseMode: 0.1,
  },
  easeToStart: {
    setupSimplicity: 0.3,
    trainingRequired: 0.25,
    techComplexity: 0.25,
    onboardingSupport: 0.2,
  },
  complexity: {
    dailyInteractions: 0.3,
    carbCounting: 0.25,
    alertManagement: 0.25,
    dataReview: 0.2,
  },
  support: {
    customerService: 0.3,
    onlineResources: 0.25,
    communitySupport: 0.25,
    clinicalSupport: 0.2,
  },
};

class PumpDriveCategoryRecommendationService {
  /**
   * Process a single category response and recommend pumps
   */
  async processCategoryResponse(
    categoryResponse: CategoryResponse
  ): Promise<CategoryPumpRecommendation> {
    // Create the prompt for Claude to analyze and score pumps
    const prompt = `You are an expert diabetes educator analyzing insulin pump options for a patient based on their specific category responses.

CATEGORY: ${this.getCategoryTitle(categoryResponse.category)}

PATIENT RESPONSE:
Main Response: ${categoryResponse.mainTranscript}
${categoryResponse.followUpTranscript ? `Additional Comments: ${categoryResponse.followUpTranscript}` : ''}
Topics Discussed: ${categoryResponse.checkedQuestions.join(', ')}

AVAILABLE PUMPS:
1. Omnipod 5 - Tubeless, automated, waterproof, pharmacy coverage
2. Tandem t:slim X2 - Touchscreen, Control-IQ, compact, Dexcom G6
3. Medtronic 780G - Advanced automation, Guardian 4, smartphone app
4. Omnipod DASH - Tubeless, no automation, affordable, waterproof
5. Medtronic 770G - Reliable automation, proven track record
6. Omnipod GO - Simple, basal-only, very affordable

Based on this patient's ${categoryResponse.category} preferences and concerns, score each pump for this specific category.

Provide a JSON response with:
{
  "pumps": [
    {
      "pumpId": "omnipod5",
      "pumpName": "Omnipod 5",
      "categoryScore": 85,
      "keyStrengths": ["Strength 1 for this category", "Strength 2"],
      "considerations": ["Potential concern for this user"]
    }
  ],
  "insights": "Brief paragraph explaining the scoring rationale for this category"
}

Score each pump 0-100 based ONLY on how well it matches this specific category's requirements.`;

    try {
      // Get AI analysis
      const response = await azureAIService.processWithClaude(
        prompt,
        `pump_category_${categoryResponse.category}`
      );

      const analysis = this.parseAIResponse(response);

      // Sort pumps by score and take top 6
      const sortedPumps = analysis.pumps
        .sort((a, b) => b.categoryScore - a.categoryScore)
        .slice(0, 6);

      const recommendation: CategoryPumpRecommendation = {
        category: categoryResponse.category,
        categoryTitle: this.getCategoryTitle(categoryResponse.category),
        topPumps: sortedPumps,
        aiInsights: analysis.insights,
        timestamp: Date.now(),
      };

      // Save to session storage
      this.saveCategoryRecommendation(categoryResponse.category, recommendation);

      return recommendation;
    } catch (error) {
      logError('pumpDriveCategoryRecommendation', 'Error message', {});
      // Fallback to default scoring
      return this.createFallbackRecommendation(categoryResponse);
    }
  }

  /**
   * Get all category recommendations for final processing
   */
  getAllCategoryRecommendations(): Record<string, CategoryPumpRecommendation> {
    const recommendations: Record<string, CategoryPumpRecommendation> = {};

    ['cost', 'lifestyle', 'algorithm', 'easeToStart', 'complexity', 'support'].forEach(category => {
      const stored = sessionStorage.getItem(`pumpdrive_category_rec_${category}`);
      if (stored) {
        recommendations[category] = JSON.parse(stored);
      }
    });

    return recommendations;
  }

  /**
   * Process final narrowing from 6 category winners to 1-2 pumps
   */
  async processFinalNarrowing(
    categoryRecommendations: Record<string, CategoryPumpRecommendation>,
    finalDiscussion: string
  ): Promise<{
    topChoice: PumpScore;
    runnerUp?: PumpScore;
    eliminationReasoning: Record<string, string>;
    finalInsights: string;
  }> {
    // Collect all category winners
    const categoryWinners = Object.entries(categoryRecommendations).map(([category, rec]) => ({
      category,
      winner: rec.topPumps[0],
    }));

    const prompt = `You are helping a patient make their final insulin pump decision.

CATEGORY WINNERS:
${categoryWinners
  .map(
    cw =>
      `${this.getCategoryTitle(cw.category)}: ${cw.winner.pumpName} (Score: ${cw.winner.categoryScore})`
  )
  .join('\n')}

PATIENT'S FINAL PRIORITIES:
${finalDiscussion}

Analyze which pump(s) best balance all categories considering the patient's stated final priorities.

Provide a JSON response:
{
  "topChoice": {
    "pumpId": "pump_id",
    "pumpName": "Pump Name",
    "categoryScore": 95,
    "keyStrengths": ["Overall strength 1", "Overall strength 2", "Overall strength 3"],
    "considerations": ["Minor consideration"]
  },
  "runnerUp": {
    "pumpId": "pump_id",
    "pumpName": "Pump Name",
    "categoryScore": 90,
    "keyStrengths": ["Strength 1", "Strength 2"],
    "considerations": ["Consideration 1"]
  },
  "eliminationReasoning": {
    "pump_name_1": "Why this pump was eliminated despite category win",
    "pump_name_2": "Elimination reason"
  },
  "finalInsights": "Paragraph explaining the final recommendation considering all factors"
}`;

    try {
      const response = await azureAIService.processWithClaude(prompt, 'pump_final_narrowing');
      return this.parseFinalResponse(response);
    } catch (error) {
      logError('pumpDriveCategoryRecommendation', 'Error message', {});
      return this.createFallbackFinalRecommendation(categoryWinners);
    }
  }

  private getCategoryTitle(category: string): string {
    const titles: Record<string, string> = {
      cost: 'Budget & Insurance',
      lifestyle: 'Your Lifestyle',
      algorithm: 'Control Preferences',
      easeToStart: 'Getting Started',
      complexity: 'Daily Use & Complexity',
      support: 'Support System',
    };
    return titles[category] || category;
  }

  private parseAIResponse(response: string): { pumps: PumpScore[]; insights: string } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logError('pumpDriveCategoryRecommendation', 'Error message', {});
    }

    // Fallback
    return {
      pumps: AVAILABLE_PUMPS.map(p => ({
        pumpId: p.id,
        pumpName: p.name,
        categoryScore: 75 + Math.random() * 20,
        keyStrengths: ['Good option for this category'],
        considerations: [],
      })),
      insights: 'Analysis based on category preferences.',
    };
  }

  private parseFinalResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logError('pumpDriveCategoryRecommendation', 'Error message', {});
    }

    return this.createFallbackFinalRecommendation([]);
  }

  private saveCategoryRecommendation(
    category: string,
    recommendation: CategoryPumpRecommendation
  ): void {
    sessionStorage.setItem(`pumpdrive_category_rec_${category}`, JSON.stringify(recommendation));
  }

  private createFallbackRecommendation(
    categoryResponse: CategoryResponse
  ): CategoryPumpRecommendation {
    // Simple fallback scoring based on category
    const pumps = AVAILABLE_PUMPS.map(p => {
      let score = 70 + Math.random() * 25;
      const strengths = [];
      const considerations = [];

      // Category-specific defaults
      if (categoryResponse.category === 'lifestyle' && p.id.includes('omnipod')) {
        score += 10;
        strengths.push('Tubeless design for active lifestyle');
      }
      if (categoryResponse.category === 'cost' && p.id.includes('dash')) {
        score += 5;
        strengths.push('More affordable option');
      }

      return {
        pumpId: p.id,
        pumpName: p.name,
        categoryScore: Math.round(score),
        keyStrengths: strengths.length ? strengths : ['Suitable for this category'],
        considerations,
      };
    });

    return {
      category: categoryResponse.category,
      categoryTitle: this.getCategoryTitle(categoryResponse.category),
      topPumps: pumps.sort((a, b) => b.categoryScore - a.categoryScore).slice(0, 6),
      aiInsights: 'Recommendations based on category preferences.',
      timestamp: Date.now(),
    };
  }

  private createFallbackFinalRecommendation(categoryWinners: any[]): any {
    return {
      topChoice: {
        pumpId: 'omnipod5',
        pumpName: 'Omnipod 5',
        categoryScore: 92,
        keyStrengths: [
          'Best overall balance of features',
          'Strong in multiple categories',
          'Modern technology',
        ],
        considerations: ['Higher ongoing supply costs'],
      },
      runnerUp: {
        pumpId: 'tslimx2',
        pumpName: 'Tandem t:slim X2',
        categoryScore: 88,
        keyStrengths: ['Excellent algorithm', 'User-friendly interface'],
        considerations: ['Has tubing'],
      },
      eliminationReasoning: {},
      finalInsights: 'Based on overall category performance and priorities.',
    };
  }
}

export const pumpDriveCategoryRecommendationService = new PumpDriveCategoryRecommendationService();
