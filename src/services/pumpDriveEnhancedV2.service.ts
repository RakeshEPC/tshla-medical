/**
 * Enhanced PumpDrive Service V2
 * Uses comprehensive pump database with 23 dimensions for better AI recommendations
 */

import { azureAIService } from './azureAI.service';
import { pumpDataManagerService } from './pumpDataManager.service';
import { PUMP_DATABASE } from '../data/pumpDataComplete';
import { pumpDriveLightweight } from './pumpDriveLightweight.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

interface CategoryScore {
  category: string;
  categoryTitle: string;
  transcript: string;
  topPumps: PumpRecommendation[];
  timestamp: number;
  patientNeeds: string[];
}

interface PumpRecommendation {
  pumpId: string;
  pumpName: string;
  brand: string;
  score: number;
  strengths: string[];
  considerations: string[];
  matchReason: string;
  specificFeatures?: Record<string, any>;
}

interface FinalComparison {
  userLifestyle: string[];
  patientNeeds: string[];
  pumpA: PumpDetail;
  pumpB: PumpDetail;
  comparisonMatrix: Array<{
    dimension: string;
    pumpAValue: string;
    pumpBValue: string;
    winner?: string;
  }>;
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
  technicalSpecs?: Record<string, any>;
}

interface FinalRecommendation {
  winningPump: PumpDetail;
  runnerUp?: PumpDetail;
  salesPitch: string;
  personalizedReasons: string[];
  printableSummary: string;
  detailedComparison?: any;
}

const CATEGORY_TITLES: Record<string, string> = {
  cost: '💰 Budget & Insurance',
  lifestyle: '🏃 Your Lifestyle',
  algorithm: '🎯 Control Preferences',
  easeToStart: '🚀 Getting Started',
  complexity: '📅 Daily Use & Complexity',
  support: '🤝 Support System',
};

class PumpDriveEnhancedServiceV2 {
  private categoryScores: Map<string, CategoryScore> = new Map();
  private processingQueue: Promise<any> = Promise.resolve();
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 12000; // Minimum 12 seconds between requests to avoid throttling (increased from 5)
  private isProcessingFinalReport: boolean = false;

  // Cache statistics
  private cacheHits: number = 0;
  private totalRequests: number = 0;

  /**
   * Process category completion with enhanced pump data
   */
  async processCategory(
    category: string,
    transcript: string,
    checkedQuestions: string[],
    priority?: number
  ): Promise<CategoryScore> {
    this.totalRequests++;

    // Check cache first
    const cacheKey = this.generateCacheKey(category, transcript);
    const cached = this.checkCache(cacheKey);

    if (cached) {
      this.cacheHits++;
      logInfo('pumpDriveEnhancedV2', 'Info message', {});
      return cached;
    }

    // NEW APPROACH: Just extract facts locally, NO API CALL!
    logDebug('pumpDriveEnhancedV2', 'Debug message', {});
    const facts = pumpDriveLightweight.extractCategoryFacts(category, transcript);

    // Create a simplified category score
    const categoryScore: CategoryScore = {
      category,
      categoryTitle: CATEGORY_TITLES[category],
      transcript,
      topPumps: [], // Will be populated in final report
      timestamp: Date.now(),
      patientNeeds: Object.keys(facts).filter(k => facts[k] === true),
    };

    // Store for final processing
    this.categoryScores.set(category, categoryScore);
    this.saveCategoryToSession(category, categoryScore);

    // Return immediately - no API call, no waiting!
    return categoryScore;
  }

  /**
   * Old method preserved for reference
   */
  private async processCategory_OLD(
    category: string,
    transcript: string,
    checkedQuestions: string[],
    priority?: number
  ): Promise<CategoryScore> {
    // Queue this request to prevent concurrent API calls
    this.processingQueue = this.processingQueue.then(async () => {
      // Add delay between requests to avoid throttling
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        const delay = this.minRequestInterval - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      this.lastRequestTime = Date.now();
    });

    await this.processingQueue;

    // Extract patient needs from transcript
    const patientNeeds = pumpDataManagerService.extractPatientNeeds(transcript);

    // Get comprehensive pump context for this category
    const pumpContext = pumpDataManagerService.getPumpContextForCategory(category);

    // Store priority for later weighting
    if (priority) {
      sessionStorage.setItem(`pumpdrive_priority_${category}`, priority.toString());
    }

    const prompt = `As an expert insulin pump advisor, analyze this patient's ${CATEGORY_TITLES[category]} preferences.
${priority ? `NOTE: This is their #${priority} priority category, so it should have higher weight in recommendations.` : ''}

PATIENT RESPONSE:
${transcript}

TOPICS DISCUSSED:
${checkedQuestions.join(', ')}

EXTRACTED PATIENT NEEDS:
${patientNeeds.join(', ')}

${pumpContext}

Based on the DETAILED PUMP SPECIFICATIONS above and the patient's specific needs, recommend the TOP 2 PUMPS for ${CATEGORY_TITLES[category]}.

Consider these specific factors for ${category}:
${this.getCategorySpecificFactors(category)}

Return a detailed analysis in JSON format:
{
  "topPumps": [
    {
      "pumpId": "pump_id",
      "pumpName": "Full pump name",
      "brand": "Manufacturer",
      "score": 95,
      "strengths": [
        "Specific strength related to patient's ${category} needs",
        "Another relevant strength with specific details",
        "Include technical specs that matter"
      ],
      "considerations": [
        "Potential limitation for this patient",
        "Trade-off to consider"
      ],
      "matchReason": "Detailed explanation of why this pump excels for THIS patient's specific ${category} needs",
      "specificFeatures": {
        "relevantSpec1": "value",
        "relevantSpec2": "value"
      }
    }
  ],
  "patientInsights": [
    "Key insight about patient's ${category} priorities",
    "Another observation about their needs"
  ]
}`;

    try {
      const response = await azureAIService.generateResponse('', prompt);
      const parsed = this.parseResponse(response);

      // Use intelligent scoring based on patient needs
      const scoredPumps = pumpDataManagerService.scorePumpsForPatient(category, patientNeeds);

      // Merge AI recommendations with data-driven scoring
      const enhancedPumps = this.mergeRecommendations(parsed.topPumps, scoredPumps);

      const categoryScore: CategoryScore = {
        category,
        categoryTitle: CATEGORY_TITLES[category],
        transcript,
        topPumps: enhancedPumps.slice(0, 2),
        timestamp: Date.now(),
        patientNeeds,
      };

      // Store for final processing
      this.categoryScores.set(category, categoryScore);
      this.saveCategoryToSession(category, categoryScore);

      return categoryScore;
    } catch (error) {
      logError('pumpDriveEnhancedV2', 'Error message', {});
      return this.getDataDrivenFallback(category, transcript, patientNeeds);
    }
  }

  /**
   * Get category-specific factors for AI consideration
   */
  private getCategorySpecificFactors(category: string): string {
    const factors: Record<string, string> = {
      cost: `
- Insurance coverage type (DME vs Pharmacy)
- Upfront costs vs ongoing supply costs
- Financial assistance programs available
- Battery costs (rechargeable vs replaceable)
- Supply replacement frequency`,

      lifestyle: `
- Water resistance and submersibility specs
- Tubing vs tubeless design impact
- Phone control capabilities (view only vs full bolus)
- Size and discretion when worn
- Travel convenience and supply logistics
- Exercise and activity compatibility`,

      algorithm: `
- Algorithm aggressiveness (conservative/moderate/aggressive)
- Target range customization options
- Exercise mode availability and settings
- CGM compatibility and integration
- Auto-correction frequency and amount
- Predictive capabilities`,

      easeToStart: `
- User interface type (touchscreen/buttons/phone-only)
- Training availability and requirements
- Setup complexity
- Learning curve considerations
- Clinic support and familiarity
- Initial configuration needs`,

      complexity: `
- Daily interaction requirements
- Alert customization and frequency
- Bolus workflow (carb counting requirements)
- Reservoir capacity and change frequency
- Menu navigation complexity
- Maintenance requirements`,

      support: `
- Manufacturer support quality
- Clinic/provider familiarity
- Caregiver features and remote monitoring
- Data sharing capabilities
- Online community and resources
- Software update process`,
    };

    return factors[category] || 'Consider all relevant factors for this category';
  }

  /**
   * Merge AI recommendations with data-driven scoring
   */
  private mergeRecommendations(
    aiPumps: any[],
    scoredPumps: Array<{ pumpId: string; score: number; reasons: string[] }>
  ): PumpRecommendation[] {
    const merged: PumpRecommendation[] = [];

    // Handle undefined or invalid scoredPumps
    if (!scoredPumps || !Array.isArray(scoredPumps) || scoredPumps.length === 0) {
      logWarn('pumpDriveEnhancedV2', 'Warning message', {});
      return [];
    }

    // Handle undefined or invalid aiPumps
    if (!aiPumps || !Array.isArray(aiPumps)) {
      logWarn('pumpDriveEnhancedV2', 'Warning message', {});
      // Return data-driven recommendations only
      return scoredPumps.slice(0, 2).map(sp => {
        const pump = PUMP_DATABASE.find(p => p.id === sp.pumpId);
        return {
          pumpId: sp.pumpId,
          pumpName: pump?.name || sp.pumpId,
          brand: pump?.brand || 'Unknown',
          score: sp.score,
          strengths: sp.reasons || [],
          considerations: [],
          matchReason: (sp.reasons && sp.reasons[0]) || 'Good match based on your needs',
          specificFeatures: pump,
        };
      });
    }

    // Create a map for quick lookup
    const scoreMap = new Map(scoredPumps.map(sp => [sp.pumpId, sp]));

    aiPumps.forEach(aiPump => {
      const dataScore = scoreMap.get(aiPump.pumpId);
      const pump = PUMP_DATABASE.find(p => p.id === aiPump.pumpId);

      if (pump) {
        merged.push({
          ...aiPump,
          score: dataScore ? Math.round((aiPump.score + dataScore.score) / 2) : aiPump.score,
          strengths: [...aiPump.strengths, ...(dataScore?.reasons || [])].filter(
            (v, i, a) => a.indexOf(v) === i
          ), // Remove duplicates
          pumpName: pump.name,
          brand: pump.manufacturer,
          specificFeatures: {
            ...aiPump.specificFeatures,
            waterRating: pump.dimensions.waterResistance,
            phoneControl: pump.dimensions.phoneControl,
            battery: pump.dimensions.battery,
          },
        });
      }
    });

    // Add any highly-scored pumps that AI might have missed
    scoredPumps.forEach(sp => {
      if (sp.score > 80 && !merged.find(m => m.pumpId === sp.pumpId)) {
        const pump = PUMP_DATABASE.find(p => p.id === sp.pumpId);
        if (pump) {
          merged.push({
            pumpId: sp.pumpId,
            pumpName: pump.name,
            brand: pump.manufacturer,
            score: sp.score,
            strengths: sp.reasons,
            considerations: pump.cons || [],
            matchReason: `High compatibility score based on your stated needs`,
            specificFeatures: {
              waterRating: pump.dimensions.waterResistance,
              phoneControl: pump.dimensions.phoneControl,
            },
          });
        }
      }
    });

    return merged.sort((a, b) => b.score - a.score);
  }

  /**
   * Get comprehensive comparison with detailed pump data
   */
  async getFinalComparison(): Promise<FinalComparison> {
    // NEW: Single API call for everything!
    logDebug('pumpDriveEnhancedV2', 'Debug message', {});

    // Prevent multiple simultaneous final report generations
    if (this.isProcessingFinalReport) {
      logDebug('pumpDriveEnhancedV2', 'Debug message', {});
      await new Promise(resolve => setTimeout(resolve, 2000)); // Much shorter wait now!
    }

    this.isProcessingFinalReport = true;

    try {
      // No more queue delays needed since we only make 1 API call total!

      const allScores = this.getAllCategoryScores();

      // If no scores, provide default pumps
      if (allScores.size === 0) {
        logDebug('pumpDriveEnhancedV2', 'Debug message', {});
        return this.getDefaultComparison();
      }

      // Collect all category responses with extracted facts
      const categoryResponses: Record<string, any> = {};
      allScores.forEach((score, category) => {
        const facts = pumpDriveLightweight.extractCategoryFacts(category, score.transcript);
        categoryResponses[category] = {
          transcript: score.transcript,
          facts,
          categoryTitle: score.categoryTitle,
        };
      });

      // NEW: Single comprehensive prompt with ALL data
      const prompt = `You are an expert diabetes educator analyzing a patient's complete insulin pump preferences.

PATIENT RESPONSES BY CATEGORY:
${Object.entries(categoryResponses)
  .map(
    ([category, data]) =>
      `${data.categoryTitle.toUpperCase()}:
  Response: "${data.transcript}"
  Extracted Facts: ${JSON.stringify(data.facts, null, 2)}`
  )
  .join('\n\n')}

AVAILABLE INSULIN PUMPS:
${PUMP_DATABASE.map(pump => `- ${pump.name}: ${pump.brand}`).join('\n')}

TASK: Based on ALL the patient's responses together, recommend the TOP 3 insulin pumps.
Consider how different factors interact (e.g., travel + water = need waterproof).
Weight priorities based on emphasis and repetition in their responses.

Return JSON with comprehensive analysis:
{
  "topPump": {
    "name": "Tandem t:slim X2" (example),
    "score": 95,
    "keyReasons": ["Matches your need for...", "Perfect for your...", "Addresses your concern about..."],
    "perfectFor": "One sentence why this is THE best choice for this specific patient"
  },
  "secondPump": {
    "name": "Omnipod 5" (example),
    "score": 88,
    "keyReasons": ["Good for...", "Helps with..."],
    "betterIf": "Would be better if you prioritize X over Y"
  },
  "thirdPump": {
    "name": "Medtronic 780G" (example),
    "score": 82,
    "keyReasons": ["Reason 1", "Reason 2"],
    "consider": "Consider this if..."
  },
  "userLifestyle": ["Key lifestyle point 1", "Point 2", "Point 3"],
  "patientSummary": {
    "primaryNeeds": ["Most important need", "Second need", "Third need"],
    "lifestyle": "One sentence lifestyle summary",
    "dealBreakers": ["Any absolute requirements"],
    "tradeoffs": ["Willing to compromise on..."]
  },
  "finalQuestions": ["Key decision question 1", "Question 2", "Question 3"],
  "aiRecommendation": "Personalized recommendation paragraph explaining why the top pump is best..."
}`;

      try {
        // SINGLE API CALL for everything!
        logDebug('pumpDriveEnhancedV2', 'Debug message', {});
        const response = await azureAIService.generateResponse('', prompt);
        const result = this.parseResponse(response);

        // Map the new format to the expected format
        const topPumpData = PUMP_DATABASE.find(
          p =>
            p.name.toLowerCase().includes(result.topPump?.name?.toLowerCase()) ||
            p.name === result.topPump?.name
        );
        const secondPumpData = PUMP_DATABASE.find(
          p =>
            p.name.toLowerCase().includes(result.secondPump?.name?.toLowerCase()) ||
            p.name === result.secondPump?.name
        );

        return {
          userLifestyle: result.userLifestyle || [],
          patientNeeds: result.patientSummary?.primaryNeeds || [],
          pumpA: {
            pumpId: topPumpData?.id || 'tandem_tslim_x2',
            pumpName: result.topPump?.name || 'Tandem t:slim X2',
            brand: topPumpData?.brand || 'Tandem',
            score: result.topPump?.score || 90,
            pros: result.topPump?.keyReasons || [],
            cons: [],
            perfectFor: [result.topPump?.perfectFor || 'Recommended based on your needs'],
            technicalSpecs: topPumpData
              ? {
                  waterResistance: topPumpData.dimensions.waterResistance,
                  phoneControl: topPumpData.dimensions.phoneControl,
                  algorithm: topPumpData.dimensions.algorithm,
                  cgmCompatibility: topPumpData.dimensions.cgmCompatibility,
                }
              : {},
          },
          pumpB: {
            pumpId: secondPumpData?.id || 'omnipod_5',
            pumpName: result.secondPump?.name || 'Omnipod 5',
            brand: secondPumpData?.brand || 'Insulet',
            score: result.secondPump?.score || 85,
            pros: result.secondPump?.keyReasons || [],
            cons: [],
            perfectFor: [result.secondPump?.betterIf || 'Alternative option'],
            technicalSpecs: secondPumpData
              ? {
                  waterResistance: secondPumpData.dimensions.waterResistance,
                  phoneControl: secondPumpData.dimensions.phoneControl,
                  algorithm: secondPumpData.dimensions.algorithm,
                  cgmCompatibility: secondPumpData.dimensions.cgmCompatibility,
                }
              : {},
          },
          comparisonMatrix: [],
          finalQuestions: result.finalQuestions || [],
          aiRecommendation:
            result.aiRecommendation || 'Based on your responses, we recommend the top pump above.',
        };
      } catch (error) {
        logError('pumpDriveEnhancedV2', 'Error message', {});
        return this.getEnhancedFallbackComparison(pumpA, pumpB, allPatientNeeds);
      }
    } finally {
      this.isProcessingFinalReport = false;
    }
  }

  /**
   * Aggregate all patient needs from all categories
   */
  private getDefaultComparison(): FinalComparison {
    // Provide sensible defaults when no user data exists
    return {
      userLifestyle: ['Information needed from user'],
      patientNeeds: ['Complete assessment required'],
      pumpA: {
        pumpId: 'tandem_tslim_x2',
        pumpName: 'Tandem t:slim X2',
        brand: 'Tandem',
        overallScore: 85,
        pros: ['Touchscreen interface', 'Control-IQ technology', 'Dexcom G6 integration'],
        cons: ['Requires CGM for full features', 'Battery life'],
        perfectFor: ['Tech-savvy users', 'Those wanting automation'],
        categoryScores: {},
      },
      pumpB: {
        pumpId: 'omnipod_5',
        pumpName: 'Omnipod 5',
        brand: 'Insulet',
        overallScore: 82,
        pros: ['Tubeless design', 'Waterproof', 'Smartphone control'],
        cons: ['Pod changes every 3 days', 'Limited insulin capacity'],
        perfectFor: ['Active lifestyles', 'Those wanting freedom from tubing'],
        categoryScores: {},
      },
      comparisonMatrix: [],
      finalQuestions: ['What matters most to you in pump selection?'],
      aiRecommendation: 'Please complete the assessment for personalized recommendations',
    };
  }

  private getDefaultPumps() {
    return [
      { pumpId: 'tandem_tslim_x2', score: 85 },
      { pumpId: 'omnipod_5', score: 82 },
    ];
  }

  private aggregatePatientNeeds(allScores: Map<string, CategoryScore>): string[] {
    const needs = new Set<string>();
    allScores.forEach(score => {
      score.patientNeeds?.forEach(need => needs.add(need));
    });
    return Array.from(needs);
  }

  /**
   * Get priority dimensions based on patient needs
   */
  private getPriorityDimensions(patientNeeds: string[]): string[] {
    const dimensions: string[] = [];

    patientNeeds.forEach(need => {
      const needLower = need.toLowerCase();
      if (needLower.includes('water')) dimensions.push('waterResistance');
      if (needLower.includes('phone')) dimensions.push('phoneControl');
      if (needLower.includes('tub')) dimensions.push('tubingStyle');
      if (needLower.includes('simple')) dimensions.push('bolusWorkflow');
      if (needLower.includes('control')) dimensions.push('algorithm');
      if (needLower.includes('exercise')) dimensions.push('exerciseMode');
      if (needLower.includes('discre')) dimensions.push('wearability');
    });

    // Add essential dimensions if not already included
    if (!dimensions.includes('algorithm')) dimensions.push('algorithm');
    if (!dimensions.includes('cgmCompatibility')) dimensions.push('cgmCompatibility');
    if (!dimensions.includes('costInsurance')) dimensions.push('costInsurance');

    return dimensions;
  }

  /**
   * Enhanced fallback with data-driven recommendations
   */
  private getDataDrivenFallback(
    category: string,
    transcript: string,
    patientNeeds: string[]
  ): CategoryScore {
    // Use the pump scoring system even in fallback
    const scores = pumpDataManagerService.scorePumpsForPatient(category, patientNeeds);
    const topPumps = scores.slice(0, 2);

    const recommendations: PumpRecommendation[] = topPumps.map(tp => {
      const pump = PUMP_DATABASE.find(p => p.id === tp.pumpId);
      return {
        pumpId: tp.pumpId,
        pumpName: pump?.name || tp.pumpId,
        brand: pump?.manufacturer || 'Unknown',
        score: tp.score,
        strengths: tp.reasons,
        considerations: pump?.cons?.slice(0, 2) || [],
        matchReason: `Scored highly for your ${category} needs based on: ${tp.reasons.slice(0, 2).join(', ')}`,
        specificFeatures: {
          waterResistance: pump?.dimensions.waterResistance,
          phoneControl: pump?.dimensions.phoneControl,
        },
      };
    });

    return {
      category,
      categoryTitle: CATEGORY_TITLES[category],
      transcript,
      topPumps: recommendations,
      timestamp: Date.now(),
      patientNeeds,
    };
  }

  /**
   * Enhanced fallback comparison using pump database
   */
  private getEnhancedFallbackComparison(
    pumpA: PumpDetail,
    pumpB: PumpDetail,
    patientNeeds: string[]
  ): FinalComparison {
    const pumpAData = PUMP_DATABASE.find(p => p.id === pumpA.pumpId);
    const pumpBData = PUMP_DATABASE.find(p => p.id === pumpB.pumpId);

    return {
      userLifestyle: patientNeeds,
      patientNeeds,
      pumpA: {
        ...pumpA,
        pros: pumpAData?.pros || [],
        cons: pumpAData?.cons || [],
        perfectFor: pumpAData?.idealFor || [],
        technicalSpecs: {
          waterResistance: pumpAData?.dimensions.waterResistance,
          phoneControl: pumpAData?.dimensions.phoneControl,
        },
      },
      pumpB: {
        ...pumpB,
        pros: pumpBData?.pros || [],
        cons: pumpBData?.cons || [],
        perfectFor: pumpBData?.idealFor || [],
        technicalSpecs: {
          waterResistance: pumpBData?.dimensions.waterResistance,
          phoneControl: pumpBData?.dimensions.phoneControl,
        },
      },
      comparisonMatrix: [],
      finalQuestions: [
        `Which matters more: ${pumpA.pumpName}'s strengths or ${pumpB.pumpName}'s advantages?`,
        'How important is the specific technical difference between these pumps?',
        'Which pump better aligns with your daily routine?',
      ],
      aiRecommendation: `Both ${pumpA.pumpName} and ${pumpB.pumpName} scored highly for your needs.`,
    };
  }

  // ... (keep all other existing methods like calculateOverallScores, saveCategoryToSession, etc.)

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
      const pumpInfo = PUMP_DATABASE.find(p => p.id === pumpId);
      pumpDetails.push({
        pumpId,
        pumpName: pumpInfo?.name || pumpId,
        brand: pumpInfo?.manufacturer || 'Unknown',
        overallScore: Math.round(scores.total / scores.count),
        pros: pumpInfo?.pros || [],
        cons: pumpInfo?.cons || [],
        perfectFor: pumpInfo?.idealFor || [],
        categoryScores: scores.categories,
      });
    });

    return pumpDetails.sort((a, b) => b.overallScore - a.overallScore);
  }

  private saveCategoryToSession(category: string, score: CategoryScore): void {
    sessionStorage.setItem(`pumpdrive_enhanced_v2_${category}`, JSON.stringify(score));

    // Cache the result
    const cacheKey = this.generateCacheKey(category, score.transcript);
    this.setCache(cacheKey, score);

    // Also save to pumpdrive_responses for the report page
    const responses = JSON.parse(sessionStorage.getItem('pumpdrive_responses') || '{}');
    responses[category] = {
      transcript: score.transcript,
      mainTranscript: score.transcript,
      followUpTranscript: '',
      keyPoints: [],
      timestamp: score.timestamp,
    };
    sessionStorage.setItem('pumpdrive_responses', JSON.stringify(responses));
  }

  /**
   * Cache helper methods
   */
  private generateCacheKey(category: string, transcript: string): string {
    // Create a simple hash from category and first 100 chars of transcript
    const key = `${category}_${transcript.substring(0, 100)}`;
    return btoa(key)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32);
  }

  private checkCache(key: string): CategoryScore | null {
    const cached = localStorage.getItem(`pump_cache_${key}`);
    if (cached) {
      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      // Use cache if less than 1 hour old
      if (age < 3600000) {
        return data.score;
      }
    }
    return null;
  }

  private setCache(key: string, score: CategoryScore): void {
    const cacheData = {
      score,
      timestamp: Date.now(),
    };
    localStorage.setItem(`pump_cache_${key}`, JSON.stringify(cacheData));

    // Also update cache statistics
    this.updateCacheStats();
  }

  private updateCacheStats(): void {
    const stats = {
      hitRate: this.totalRequests > 0 ? Math.round((this.cacheHits / this.totalRequests) * 100) : 0,
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      timestamp: Date.now(),
    };
    localStorage.setItem('pump_cache_stats', JSON.stringify(stats));
    logDebug('pumpDriveEnhancedV2', 'Debug message', {});
  }

  public getCacheStats() {
    return {
      hitRate: this.totalRequests > 0 ? Math.round((this.cacheHits / this.totalRequests) * 100) : 0,
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
    };
  }

  private getAllCategoryScores(): Map<string, CategoryScore> {
    const scores = new Map<string, CategoryScore>();

    // First try to get actual user responses from pumpdrive_responses
    const userResponses = JSON.parse(sessionStorage.getItem('pumpdrive_responses') || '{}');

    ['cost', 'lifestyle', 'algorithm', 'easeToStart', 'complexity', 'support'].forEach(category => {
      // Check for user's actual response first
      if (userResponses[category]) {
        const userResponse = userResponses[category];
        scores.set(category, {
          category: category,
          categoryTitle: CATEGORY_TITLES[category],
          transcript: userResponse.mainTranscript || userResponse.transcript || '',
          topPumps: [],
          timestamp: userResponse.timestamp || Date.now(),
          patientNeeds: pumpDataManagerService.extractPatientNeeds(
            userResponse.mainTranscript || userResponse.transcript || ''
          ),
        });
      } else {
        // Fall back to enhanced v2 storage or in-memory scores
        const stored = sessionStorage.getItem(`pumpdrive_enhanced_v2_${category}`);
        if (stored) {
          scores.set(category, JSON.parse(stored));
        } else if (this.categoryScores.has(category)) {
          scores.set(category, this.categoryScores.get(category)!);
        }
      }
    });

    return scores;
  }

  private parseResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logError('pumpDriveEnhancedV2', 'Error message', {});
    }
    return {};
  }

  clearAllData(): void {
    this.categoryScores.clear();
    ['cost', 'lifestyle', 'algorithm', 'easeToStart', 'complexity', 'support'].forEach(category => {
      sessionStorage.removeItem(`pumpdrive_enhanced_v2_${category}`);
    });
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

    // Get comprehensive pump details
    const pumpDetails = pumpDataManagerService.getPumpSummaryForRecommendation(topPump.pumpId);
    const pumpData = PUMP_DATABASE.find(p => p.id === topPump.pumpId);

    const prompt = `Create an enthusiastic, personalized sales pitch for why ${topPump.pumpName} is THE PERFECT pump for this patient.

PATIENT COMPLETE PROFILE:
${Array.from(allScores.values())
  .map(
    cs =>
      `${cs.categoryTitle}: ${cs.transcript.slice(0, 150)}...
  Specific needs: ${cs.patientNeeds?.join(', ') || 'N/A'}`
  )
  .join('\n')}

FINAL CLARIFICATIONS:
${finalAnswers}

WINNING PUMP DETAILS:
${pumpDetails}

Create an exciting, personalized recommendation:
1. Enthusiastic sales pitch (2-3 paragraphs) that addresses THEIR SPECIFIC needs and concerns
2. 5-6 personalized reasons using their actual words and situations
3. A professional summary for their healthcare provider

Format as JSON:
{
  "salesPitch": "Exciting, personalized pitch using their specific situations...",
  "personalizedReasons": [
    "Because you specifically mentioned [exact thing from transcript], the ${topPump.pumpName}'s [specific feature with technical detail] is perfect",
    "Your concern about [specific worry] is addressed by [specific pump feature and how it works]"
  ],
  "printableSummary": "Professional clinical summary with technical specifications..."
}`;

    try {
      const response = await azureAIService.generateResponse('', prompt);
      const parsed = this.parseResponse(response);

      return {
        winningPump: {
          ...topPump,
          technicalSpecs: {
            waterResistance: pumpData?.dimensions.waterResistance,
            phoneControl: pumpData?.dimensions.phoneControl,
            algorithm: pumpData?.dimensions.algorithm,
            cgmCompatibility: pumpData?.dimensions.cgmCompatibility,
            capacity: pumpData?.dimensions.capacity,
            cost: pumpData?.dimensions.cost,
          },
        },
        runnerUp: pumpTotals[1],
        salesPitch: parsed.salesPitch,
        personalizedReasons: parsed.personalizedReasons,
        printableSummary: this.generateEnhancedPrintableSummary(
          topPump,
          parsed,
          allScores,
          pumpData
        ),
      };
    } catch (error) {
      logError('pumpDriveEnhancedV2', 'Error message', {});
      return this.getFallbackRecommendation(topPump);
    }
  }

  private generateEnhancedPrintableSummary(
    pump: PumpDetail,
    recommendation: any,
    allScores: Map<string, CategoryScore>,
    pumpData: any
  ): string {
    return `
INSULIN PUMP RECOMMENDATION SUMMARY
====================================
Date: ${new Date().toLocaleDateString()}

RECOMMENDED PUMP: ${pump.pumpName} (${pump.brand})
Overall Match Score: ${pump.overallScore}%

TECHNICAL SPECIFICATIONS:
• Water Resistance: ${pumpData?.dimensions.waterResistance || 'N/A'}
• Phone Control: ${pumpData?.dimensions.phoneControl?.details || 'N/A'}
• Algorithm Type: ${pumpData?.dimensions.algorithm?.type || 'N/A'} (${pumpData?.dimensions.algorithm?.aggressiveness || 'N/A'})
• CGM Compatibility: ${pumpData?.dimensions.cgmCompatibility?.compatible?.join(', ') || 'N/A'}
• Reservoir Capacity: ${pumpData?.dimensions.capacity?.units || 'N/A'} units
• Insurance Coverage: ${pumpData?.dimensions.cost?.coverage || 'N/A'}

PATIENT PRIORITIES & NEEDS:
${Array.from(allScores.values())
  .map(cs => `• ${cs.categoryTitle}: ${cs.patientNeeds?.join(', ') || 'General preferences'}`)
  .join('\n')}

WHY THIS PUMP IS RECOMMENDED:
${recommendation.personalizedReasons?.join('\n') || 'Comprehensive match across all categories'}

KEY FEATURES MATCHING PATIENT NEEDS:
${pump.pros
  .slice(0, 5)
  .map(pro => `• ${pro}`)
  .join('\n')}

CONSIDERATIONS:
${pump.cons
  .slice(0, 3)
  .map(con => `• ${con}`)
  .join('\n')}

CLINICAL NOTES:
${recommendation.printableSummary || 'Based on comprehensive assessment of patient preferences across all categories.'}

Next Steps:
1. Contact insurance for ${pumpData?.dimensions.cost?.coverage || 'coverage'} verification
2. Schedule pump training with certified trainer
3. Coordinate with endocrinologist for initial settings
4. Join ${pump.pumpName} user support community

Contact: ${pumpData?.contact || 'Manufacturer representative'}

This recommendation was generated using AI-assisted analysis of patient preferences
combined with comprehensive pump specifications database.
Please review with your healthcare provider.
    `.trim();
  }

  private getFallbackRecommendation(pump: PumpDetail): FinalRecommendation {
    const pumpData = PUMP_DATABASE.find(p => p.id === pump.pumpId);

    return {
      winningPump: {
        ...pump,
        technicalSpecs: {
          waterResistance: pumpData?.dimensions.waterResistance,
          phoneControl: pumpData?.dimensions.phoneControl,
        },
      },
      salesPitch: `Congratulations! ${pump.pumpName} is an excellent choice that aligns perfectly with your needs. ${pumpData?.pros?.join('. ')}`,
      personalizedReasons: [
        'Matches your stated priorities across all categories',
        'Offers the best balance of features for your lifestyle',
        'Provides the support and reliability you need',
        ...(pumpData?.idealFor?.map(i => `Perfect for ${i}`) || []),
      ],
      printableSummary: this.generateEnhancedPrintableSummary(
        pump,
        {
          personalizedReasons: ['Comprehensive match across all categories'],
          printableSummary:
            'AI-assisted recommendation based on patient preferences and pump specifications',
        },
        new Map(),
        pumpData
      ),
    };
  }
}

export const pumpDriveEnhancedServiceV2 = new PumpDriveEnhancedServiceV2();
