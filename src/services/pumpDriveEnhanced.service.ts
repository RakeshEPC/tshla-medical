import { azureAIService } from './azureAI.service';
import { PUMPS } from '../lib/pumpdrive/pumpProfiles';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

interface CategoryScore {
  category: string;
  categoryTitle: string;
  transcript: string;
  topPumps: PumpRecommendation[];
  timestamp: number;
}

interface PumpRecommendation {
  pumpId: string;
  pumpName: string;
  brand: string;
  score: number;
  strengths: string[];
  considerations: string[];
  matchReason: string;
}

interface FinalComparison {
  userLifestyle: string[];
  pumpA: PumpDetail;
  pumpB: PumpDetail;
  finalQuestions: string[];
  aiRecommendation: string;
}

interface PumpDetail {
  pumpId: string;
  pumpName: string;
  brand: string;
  overallScore: number;
  pros: string[];
  cons: string[];
  perfectFor: string[];
  categoryScores: Record<string, number>;
}

interface FinalRecommendation {
  winningPump: PumpDetail;
  runnerUp?: PumpDetail;
  salesPitch: string;
  personalizedReasons: string[];
  printableSummary: string;
}

const CATEGORY_TITLES: Record<string, string> = {
  cost: '💰 Budget & Insurance',
  lifestyle: '🏃 Your Lifestyle',
  algorithm: '🎯 Control Preferences',
  easeToStart: '🚀 Getting Started',
  complexity: '📅 Daily Use & Complexity',
  support: '🤝 Support System',
};

// Detailed pump information for recommendations
const PUMP_DETAILS: Record<string, any> = {
  omnipod5: {
    name: 'Omnipod 5',
    brand: 'Insulet',
    features: [
      'Tubeless',
      'Waterproof',
      'Automated insulin delivery',
      'Smartphone control',
      'No tubing',
    ],
    costProfile: 'Pharmacy benefit coverage, higher ongoing supply costs',
    bestFor: ['Active lifestyle', 'Swimming/sports', 'Discreet wear', 'Tech-savvy users'],
  },
  'tandem-x2': {
    name: 'Tandem t:slim X2',
    brand: 'Tandem Diabetes',
    features: [
      'Control-IQ technology',
      'Touchscreen',
      'Dexcom G6 integration',
      'Small profile',
      'Predictive low glucose suspend',
    ],
    costProfile: 'DME coverage, moderate ongoing costs',
    bestFor: [
      'Advanced algorithm needs',
      'Fine-tuning control',
      'Data enthusiasts',
      'Overnight stability',
    ],
  },
  'tandem-mobi': {
    name: 'Tandem Mobi',
    brand: 'Tandem Diabetes',
    features: [
      'Smallest tubed pump',
      'Control-IQ',
      'Phone control',
      'Lightweight',
      '200-unit capacity',
    ],
    costProfile: 'DME coverage, similar to t:slim X2',
    bestFor: ['Discretion with tubing', 'Small insulin needs', 'Modern interface', 'Portability'],
  },
  'medtronic-780g': {
    name: 'Medtronic 780G',
    brand: 'Medtronic',
    features: [
      'SmartGuard technology',
      'Auto-correction boluses',
      'Meal detection',
      'Guardian 4 sensor',
      'Smartphone connectivity',
    ],
    costProfile: 'Traditional insurance coverage, bundled CGM costs',
    bestFor: [
      'Hands-off management',
      'Variable schedules',
      'Aggressive control',
      'Established support',
    ],
  },
  ilet: {
    name: 'Beta Bionics iLet',
    brand: 'Beta Bionics',
    features: [
      'Bionic pancreas',
      'No carb counting',
      'Adaptive algorithm',
      'Minimal settings',
      'Meal announcements only',
    ],
    costProfile: 'Emerging coverage, contact for options',
    bestFor: [
      'Simplicity seekers',
      'Carb counting struggles',
      'Minimal interaction',
      'Algorithm trust',
    ],
  },
  twiist: {
    name: 'Twiist',
    brand: 'Sequel MedTech',
    features: [
      'Dual hormone capability',
      'Modern touchscreen',
      'Advanced automation',
      'Customizable targets',
      'Future-ready',
    ],
    costProfile: 'New to market, variable coverage',
    bestFor: ['Early adopters', 'Tech enthusiasts', 'Advanced features', 'Customization needs'],
  },
};

class PumpDriveEnhancedService {
  private categoryScores: Map<string, CategoryScore> = new Map();

  /**
   * Process category completion and return top 2 pumps for that category
   */
  async processCategory(
    category: string,
    transcript: string,
    checkedQuestions: string[]
  ): Promise<CategoryScore> {
    const prompt = `As an expert insulin pump advisor, analyze this patient's ${CATEGORY_TITLES[category]} preferences.

PATIENT RESPONSE:
${transcript}

TOPICS DISCUSSED:
${checkedQuestions.join(', ')}

Evaluate these 6 insulin pumps for THIS SPECIFIC CATEGORY ONLY:
1. Omnipod 5 - Tubeless, automated, waterproof
2. Tandem t:slim X2 - Advanced Control-IQ, touchscreen
3. Tandem Mobi - Smallest tubed pump, phone control
4. Medtronic 780G - SmartGuard, auto-corrections
5. Beta Bionics iLet - No carb counting, simple
6. Twiist - Dual hormone capable, modern

Return the TOP 2 PUMPS for ${CATEGORY_TITLES[category]} based on the patient's specific needs.

Format as JSON:
{
  "topPumps": [
    {
      "pumpId": "pump_id",
      "pumpName": "Name", 
      "brand": "Brand",
      "score": 95,
      "strengths": ["Specific strength for this category", "Another strength"],
      "considerations": ["Potential concern"],
      "matchReason": "Why this pump excels in this category for this patient"
    }
  ]
}`;

    try {
      const response = await azureAIService.generateResponse('', prompt);
      const parsed = this.parseResponse(response);

      const categoryScore: CategoryScore = {
        category,
        categoryTitle: CATEGORY_TITLES[category],
        transcript,
        topPumps: parsed.topPumps.slice(0, 2), // Ensure only top 2
        timestamp: Date.now(),
      };

      // Store for final processing
      this.categoryScores.set(category, categoryScore);
      this.saveCategoryToSession(category, categoryScore);

      return categoryScore;
    } catch (error) {
      logError('pumpDriveEnhanced', 'Error message', {});
      return this.getFallbackCategoryRecommendation(category, transcript);
    }
  }

  /**
   * Get comprehensive comparison after all categories complete
   */
  async getFinalComparison(): Promise<FinalComparison> {
    const allScores = this.getAllCategoryScores();

    // Aggregate pump scores across all categories
    const pumpTotals = this.calculateOverallScores(allScores);

    // Get top 2 pumps overall
    const [pumpA, pumpB] = pumpTotals.slice(0, 2);

    const prompt = `Based on all category responses, create a comprehensive comparison between ${pumpA.pumpName} and ${pumpB.pumpName}.

CATEGORY PREFERENCES:
${Array.from(allScores.values())
  .map(cs => `${cs.categoryTitle}: ${cs.transcript.slice(0, 200)}...`)
  .join('\n\n')}

Generate:
1. User's lifestyle summary points (5-6 key points)
2. Detailed pros/cons for each pump
3. 3-4 clarifying questions to make final decision
4. Your expert recommendation

Format as JSON:
{
  "userLifestyle": ["Key lifestyle point 1", "Point 2"],
  "pumpA": {
    "pros": ["Pro 1", "Pro 2", "Pro 3"],
    "cons": ["Con 1", "Con 2"],
    "perfectFor": ["Perfect if you...", "Also great for..."]
  },
  "pumpB": {
    "pros": ["Pro 1", "Pro 2", "Pro 3"],
    "cons": ["Con 1", "Con 2"],
    "perfectFor": ["Perfect if you...", "Also great for..."]
  },
  "finalQuestions": [
    "Which matters more to you: [specific tradeoff]?",
    "How important is [specific feature difference]?"
  ],
  "aiRecommendation": "Based on everything discussed, [pump] appears to be the better choice because..."
}`;

    try {
      const response = await azureAIService.generateResponse('', prompt);
      const comparison = this.parseResponse(response);

      return {
        userLifestyle: comparison.userLifestyle,
        pumpA: {
          ...pumpA,
          ...comparison.pumpA,
        },
        pumpB: {
          ...pumpB,
          ...comparison.pumpB,
        },
        finalQuestions: comparison.finalQuestions,
        aiRecommendation: comparison.aiRecommendation,
      };
    } catch (error) {
      logError('pumpDriveEnhanced', 'Error message', {});
      return this.getFallbackComparison(pumpA, pumpB);
    }
  }

  /**
   * Process final questions and get ultimate recommendation
   */
  async getFinalRecommendation(
    finalAnswers: string,
    selectedPumpId?: string
  ): Promise<FinalRecommendation> {
    const allScores = this.getAllCategoryScores();
    const pumpTotals = this.calculateOverallScores(allScores);
    const topPump = selectedPumpId
      ? pumpTotals.find(p => p.pumpId === selectedPumpId) || pumpTotals[0]
      : pumpTotals[0];

    const prompt = `Create an enthusiastic, personalized sales pitch for why ${topPump.pumpName} is THE PERFECT pump for this patient.

PATIENT PROFILE:
${Array.from(allScores.values())
  .map(cs => `${cs.categoryTitle}: ${cs.transcript.slice(0, 150)}...`)
  .join('\n')}

FINAL CLARIFICATIONS:
${finalAnswers}

Create:
1. Exciting sales pitch (2-3 paragraphs) that makes them EXCITED about their choice
2. 5-6 personalized reasons why this pump is perfect for THEM specifically
3. A printable summary they can share with their doctor

Format as JSON:
{
  "salesPitch": "Exciting, personalized pitch...",
  "personalizedReasons": [
    "Because you mentioned [specific thing], this pump's [feature] is perfect",
    "Your [lifestyle aspect] aligns perfectly with [pump benefit]"
  ],
  "printableSummary": "Professional summary for healthcare provider..."
}`;

    try {
      const response = await azureAIService.generateResponse('', prompt);
      const parsed = this.parseResponse(response);

      return {
        winningPump: topPump,
        runnerUp: pumpTotals[1],
        salesPitch: parsed.salesPitch,
        personalizedReasons: parsed.personalizedReasons,
        printableSummary: this.generatePrintableSummary(topPump, parsed, allScores),
      };
    } catch (error) {
      logError('pumpDriveEnhanced', 'Error message', {});
      return this.getFallbackRecommendation(topPump);
    }
  }

  /**
   * Helper methods
   */
  private calculateOverallScores(allScores: Map<string, CategoryScore>): PumpDetail[] {
    const pumpScoreMap = new Map<
      string,
      { total: number; count: number; categories: Record<string, number> }
    >();

    // Aggregate scores
    allScores.forEach(categoryScore => {
      categoryScore.topPumps.forEach(pump => {
        const existing = pumpScoreMap.get(pump.pumpId) || { total: 0, count: 0, categories: {} };
        existing.total += pump.score;
        existing.count += 1;
        existing.categories[categoryScore.category] = pump.score;
        pumpScoreMap.set(pump.pumpId, existing);
      });
    });

    // Calculate averages and create details
    const pumpDetails: PumpDetail[] = [];
    pumpScoreMap.forEach((scores, pumpId) => {
      const pumpInfo = PUMP_DETAILS[pumpId] || {};
      pumpDetails.push({
        pumpId,
        pumpName: pumpInfo.name || pumpId,
        brand: pumpInfo.brand || 'Unknown',
        overallScore: Math.round(scores.total / scores.count),
        pros: pumpInfo.features || [],
        cons: [], // Will be filled by AI
        perfectFor: pumpInfo.bestFor || [],
        categoryScores: scores.categories,
      });
    });

    return pumpDetails.sort((a, b) => b.overallScore - a.overallScore);
  }

  private saveCategoryToSession(category: string, score: CategoryScore): void {
    sessionStorage.setItem(`pumpdrive_enhanced_${category}`, JSON.stringify(score));
  }

  private getAllCategoryScores(): Map<string, CategoryScore> {
    const scores = new Map<string, CategoryScore>();

    ['cost', 'lifestyle', 'algorithm', 'easeToStart', 'complexity', 'support'].forEach(category => {
      const stored = sessionStorage.getItem(`pumpdrive_enhanced_${category}`);
      if (stored) {
        scores.set(category, JSON.parse(stored));
      } else if (this.categoryScores.has(category)) {
        scores.set(category, this.categoryScores.get(category)!);
      }
    });

    return scores;
  }

  private generatePrintableSummary(
    pump: PumpDetail,
    recommendation: any,
    allScores: Map<string, CategoryScore>
  ): string {
    return `
INSULIN PUMP RECOMMENDATION SUMMARY
====================================
Date: ${new Date().toLocaleDateString()}

RECOMMENDED PUMP: ${pump.pumpName} (${pump.brand})
Overall Match Score: ${pump.overallScore}%

PATIENT PRIORITIES:
${Array.from(allScores.values())
  .map(cs => `• ${cs.categoryTitle}: Key focus areas discussed`)
  .join('\n')}

WHY THIS PUMP IS RECOMMENDED:
${recommendation.personalizedReasons.join('\n')}

KEY FEATURES MATCHING PATIENT NEEDS:
${pump.pros
  .slice(0, 5)
  .map(pro => `• ${pro}`)
  .join('\n')}

CLINICAL SUMMARY:
${recommendation.printableSummary || 'Based on comprehensive assessment of patient preferences across all categories.'}

Next Steps:
1. Contact insurance for coverage verification
2. Schedule pump training with certified trainer
3. Coordinate with endocrinologist for settings
4. Join pump-specific support community

This recommendation was generated using AI-assisted analysis of patient preferences.
Please review with your healthcare provider.
    `.trim();
  }

  private parseResponse(response: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logError('pumpDriveEnhanced', 'Error message', {});
    }
    return {};
  }

  private getFallbackCategoryRecommendation(category: string, transcript: string): CategoryScore {
    // Smart fallbacks based on category
    const fallbackPumps: Record<string, PumpRecommendation[]> = {
      lifestyle: [
        {
          pumpId: 'omnipod5',
          pumpName: 'Omnipod 5',
          brand: 'Insulet',
          score: 92,
          strengths: ['Tubeless freedom', 'Waterproof', 'Discreet'],
          considerations: ['Higher supply costs'],
          matchReason: 'Perfect for active lifestyles',
        },
        {
          pumpId: 'tandem-mobi',
          pumpName: 'Tandem Mobi',
          brand: 'Tandem',
          score: 85,
          strengths: ['Smallest tubed pump', 'Modern features'],
          considerations: ['Has tubing'],
          matchReason: 'Great balance of size and features',
        },
      ],
      cost: [
        {
          pumpId: 'medtronic-780g',
          pumpName: 'Medtronic 780G',
          brand: 'Medtronic',
          score: 88,
          strengths: ['Established insurance coverage', 'Bundled supplies'],
          considerations: ['Higher upfront cost'],
          matchReason: 'Best insurance coverage options',
        },
        {
          pumpId: 'tandem-x2',
          pumpName: 'Tandem t:slim X2',
          brand: 'Tandem',
          score: 85,
          strengths: ['Competitive pricing', 'Software updates included'],
          considerations: ['Separate CGM costs'],
          matchReason: 'Good value with upgrade path',
        },
      ],
    };

    return {
      category,
      categoryTitle: CATEGORY_TITLES[category],
      transcript,
      topPumps: fallbackPumps[category] || fallbackPumps.lifestyle,
      timestamp: Date.now(),
    };
  }

  private getFallbackComparison(pumpA: PumpDetail, pumpB: PumpDetail): FinalComparison {
    return {
      userLifestyle: [
        'Values technology and automation',
        'Seeks balance between control and convenience',
        'Prioritizes reliability and support',
      ],
      pumpA: {
        ...pumpA,
        pros: pumpA.pros.slice(0, 3),
        cons: ['May have learning curve', 'Check insurance coverage'],
        perfectFor: pumpA.perfectFor.slice(0, 2),
      },
      pumpB: {
        ...pumpB,
        pros: pumpB.pros.slice(0, 3),
        cons: ['Different workflow than pump A', 'Consider your priorities'],
        perfectFor: pumpB.perfectFor.slice(0, 2),
      },
      finalQuestions: [
        "Which pump's unique features appeal to you more?",
        'How important is the specific difference between these pumps?',
        'Which aligns better with your daily routine?',
      ],
      aiRecommendation: `Both pumps are excellent choices. ${pumpA.pumpName} scores slightly higher overall.`,
    };
  }

  private getFallbackRecommendation(pump: PumpDetail): FinalRecommendation {
    return {
      winningPump: pump,
      salesPitch: `Congratulations! ${pump.pumpName} is an excellent choice that aligns perfectly with your needs. This pump will transform your diabetes management with its advanced features and user-friendly design.`,
      personalizedReasons: [
        'Matches your stated priorities across all categories',
        'Offers the best balance of features for your lifestyle',
        'Provides the support and reliability you need',
      ],
      printableSummary: this.generatePrintableSummary(
        pump,
        {
          personalizedReasons: ['Comprehensive match across all categories'],
          printableSummary: 'AI-assisted recommendation based on patient preferences',
        },
        new Map()
      ),
    };
  }

  /**
   * Clear all stored data for fresh start
   */
  clearAllData(): void {
    this.categoryScores.clear();
    ['cost', 'lifestyle', 'algorithm', 'easeToStart', 'complexity', 'support'].forEach(category => {
      sessionStorage.removeItem(`pumpdrive_enhanced_${category}`);
    });
  }
}

export const pumpDriveEnhancedService = new PumpDriveEnhancedService();
