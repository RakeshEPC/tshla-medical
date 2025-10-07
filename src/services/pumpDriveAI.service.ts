import { openAIService } from './openai.service';
import { PUMP_DATABASE } from '../data/pumpDataComplete';
import type { PumpDetails } from '../data/pumpDataComplete';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

interface CategoryResponse {
  category: string;
  mainTranscript: string;
  followUpTranscript: string;
  checkedQuestions: string[];
  timestamp: number;
}

interface PumpRecommendation {
  topChoice: {
    name: string;
    score: number;
    reasons: string[];
  };
  alternatives: Array<{
    name: string;
    score: number;
    reasons: string[];
  }>;
  keyFactors: string[];
  personalizedInsights: string;
}

class PumpDriveAIService {
  async processUserResponses(
    allResponses: Record<string, CategoryResponse>
  ): Promise<PumpRecommendation> {
    // Create a comprehensive summary of user responses
    const userProfile = this.createUserProfile(allResponses);

    // Extract preference keywords for better AI understanding
    const preferenceAnalysis = this.analyzePreferences(allResponses);

    // Create comprehensive pump database information for AI
    const pumpDetails = this.formatPumpDatabase();

    // Create the enhanced prompt for Claude 3.5
    const prompt = `You are an expert diabetes educator and insulin pump specialist. Based on the following patient responses, provide personalized insulin pump recommendations using the complete 23-dimension pump database extracted from PDF documentation.

CRITICAL ANALYSIS INSTRUCTIONS:
- DO NOT use any pre-calculated scores or ranking biases
- Analyze the patient's responses objectively without any pre-programmed scoring systems
- Base recommendations purely on objective analysis of patient needs against pump specifications

ANALYSIS PRIORITY HIERARCHY:
1. **EXPLICIT FEATURE SELECTIONS**: Features the patient specifically selected carry the highest weight
   - If patient selected "Apple Watch bolusing" → ONLY Twiist supports this (major factor)
   - If patient selected "2 ounces weight" → ONLY Twiist offers this (major factor)
   - If patient selected "swap batteries" → Favor pumps with replaceable batteries
2. **CLARIFYING RESPONSES**: Direct answers to conflict questions are second priority
3. **PERSONAL STORY KEYWORDS**: Specific medical/lifestyle needs mentioned in free text
4. **SLIDER PREFERENCES**: General lifestyle ratings are lower priority than explicit selections

CRITICAL DECISION RULES:

WEIGHT PRIORITIZATION:
- If user mentions "lightest", "lightweight", "minimal weight", or weight as a priority:
  → Twiist (2 oz - LIGHTEST) > Tandem Mobi (small) > Omnipod 5 (pod) > others
- Twiist at 2 oz is BY FAR the lightest pump available

TARGET GLUCOSE RANKINGS:
- LOWEST available targets:
  1. Twiist: 87 mg/dL (LOWEST standard target)
  2. Beta Bionics iLet: 60 mg/dL (only in special "lower than usual" mode)
  3. Medtronic 780G: 100 mg/dL (fixed aggressive target)
- If user wants "lowest target glucose" → strongly consider Twiist first

CONTROL TIGHTNESS/AGGRESSIVENESS:
- "Tightest control" or "most aggressive" means:
  1. Medtronic 780G: 100% correction (vs 60% for others) - MOST AGGRESSIVE
  2. Twiist: Aggressive microbolus-like basal modulations
  3. Others: Standard 60% correction approach
- For "best control" consider BOTH algorithm aggressiveness AND target flexibility

TECHNOLOGY FEATURES:
- "Tech-savvy" or "modern tech" priorities:
  1. Twiist: Apple Watch bolusing, emoji dosing, phone-first
  2. Tandem Mobi: Wireless charging, iPhone control
  3. t:slim X2: Touchscreen, multiple CGM options

CRITICAL PUMP FACTS:
- Apple Watch bolusing: ONLY Twiist supports this feature
- Lightest weight (2 oz): ONLY Twiist offers this
- Most aggressive algorithm: Medtronic 780G (100% correction)
- Lowest target glucose: Twiist (87 mg/dL standard target)

CONFLICT RESOLUTION:
- When patient selections conflict with slider ratings, prioritize explicit selections
- When multiple pumps match, use clarifying responses to break ties
- Always explain why selected features were/weren't prioritized in recommendation

PATIENT PROFILE:
${userProfile}

PREFERENCE ANALYSIS:
${preferenceAnalysis}

COMPLETE INSULIN PUMP DATABASE (ALL 23 DIMENSIONS):
${pumpDetails}

ANALYSIS INSTRUCTIONS:
1. Evaluate all pumps objectively using ALL 23 dimensions provided in the database
2. Consider ALL pump specifications: battery type, phone control, tubing, algorithm, CGM compatibility, target adjustability, exercise mode, bolus workflow, reservoir capacity, adhesive tolerance, water resistance, alerts customization, user interface, data sharing, clinic support, travel logistics, caregiver features, discretion/wearability, ecosystem integration, reliability/occlusion handling, cost/insurance, and software updates
3. Match patient preferences against comprehensive pump specifications
4. Prioritize features that matter most to this specific patient's lifestyle and medical needs
5. Explain reasoning based on how ALL relevant pump dimensions align with patient requirements
6. Provide balanced assessment considering the complete feature set of each pump

Please analyze the patient's needs across all 23 pump dimensions and provide:
1. Top recommended pump with detailed reasoning based on patient's specific words and comprehensive pump specifications
2. 2-3 alternative options ranked by suitability across all dimensions
3. Key factors that influenced your recommendation (include patient quotes and specific pump dimensions)
4. Personalized insights explaining how the recommended pump's complete feature set matches this patient's situation

Format your response as JSON with the following structure:
{
  "topChoice": {
    "name": "exact pump name from database",
    "score": 0-100,
    "reasons": ["specific reason based on patient words", "technical specification match", "lifestyle fit"]
  },
  "alternatives": [
    {
      "name": "exact pump name from database",
      "score": 0-100,
      "reasons": ["why this is second choice", "what it offers"]
    }
  ],
  "keyFactors": ["patient's stated priority 1", "patient's stated priority 2", "medical consideration"],
  "personalizedInsights": "Detailed explanation of why the top choice specifically matches what the patient said they wanted, including quotes from their responses where relevant"
}`;

    try {
      // Use Claude 3.5 Sonnet for processing
      const response = await openAIService.processText(prompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 });

      // Parse the JSON response
      const recommendation = this.parseClaudeResponse(response);

      // Save the recommendation
      this.saveRecommendation(recommendation);

      return recommendation;
    } catch (error) {
      logError('pumpDriveAI', 'Error message', {});
      throw error;
    }
  }

  private createUserProfile(responses: Record<string, CategoryResponse>): string {
    let profile = '';

    // Map category IDs to readable names
    const categoryNames: Record<string, string> = {
      cost: 'BUDGET & INSURANCE',
      lifestyle: 'LIFESTYLE',
      algorithm: 'CONTROL PREFERENCES',
      easeToStart: 'GETTING STARTED',
      complexity: 'DAILY USE & COMPLEXITY',
      support: 'SUPPORT SYSTEM',
    };

    // Process each category
    for (const [category, data] of Object.entries(responses)) {
      const displayName = categoryNames[category] || category.toUpperCase();
      profile += `\n${displayName} CATEGORY:\n`;
      profile += `Main Response: ${data.mainTranscript}\n`;
      if (data.followUpTranscript) {
        profile += `Additional Comments: ${data.followUpTranscript}\n`;
      }
      profile += `Topics Discussed: ${data.checkedQuestions.join(', ')}\n`;
      profile += '\n---\n';
    }

    return profile;
  }

  private analyzePreferences(responses: Record<string, CategoryResponse>): string {
    let analysis = 'PATIENT PREFERENCE SUMMARY:\n';

    // Simply provide the user's responses without biased keyword detection
    // Let the AI analyze the content naturally without pre-processing bias

    const categories = Object.keys(responses);
    analysis += `Patient provided responses across ${categories.length} categories:\n`;

    categories.forEach(category => {
      const response = responses[category];
      if (response.mainTranscript && response.mainTranscript.trim()) {
        analysis += `- ${category.toUpperCase()}: Has detailed response\n`;
      }
    });

    analysis += '\nNote: All user preferences will be considered equally by AI analysis.\n';

    return analysis;
  }

  private formatPumpDatabase(): string {
    let formattedDB = '';

    PUMP_DATABASE.forEach((pump, index) => {
      formattedDB += `\n${index + 1}. ${pump.name} (${pump.manufacturer})\n`;
      formattedDB += `════════════════════════════════════════\n`;

      // DIMENSION 1: Battery & Power
      formattedDB += `   BATTERY: ${pump.dimensions.battery?.type || pump.dimensions.batteryInfo?.type || 'N/A'} - ${pump.dimensions.battery?.details || pump.dimensions.batteryInfo?.details || 'N/A'}\n`;

      // DIMENSION 2: Phone Control & App Features
      formattedDB += `   PHONE CONTROL: ${pump.dimensions.phoneControl.bolusFromPhone ? 'Bolus from phone' : 'View only'} - ${pump.dimensions.phoneControl.details}\n`;
      if (pump.dimensions.phoneControl.appleWatch) {
        formattedDB += `   APPLE WATCH: ${pump.dimensions.phoneControl.appleWatch ? 'Supported' : 'Not supported'}\n`;
      }

      // DIMENSION 3: Tubing Style & Wear
      formattedDB += `   TUBING: ${pump.dimensions.tubing.type} - ${pump.dimensions.tubing.details}\n`;
      if (pump.dimensions.tubing.wearOptions) {
        formattedDB += `   WEAR OPTIONS: ${pump.dimensions.tubing.wearOptions}\n`;
      }

      // DIMENSION 4: Algorithm & Automation
      formattedDB += `   ALGORITHM: ${pump.dimensions.algorithm.type} (${pump.dimensions.algorithm.aggressiveness}) - ${pump.dimensions.algorithm.details}\n`;
      formattedDB += `   ADJUSTMENT FREQUENCY: ${pump.dimensions.algorithm.adjustmentFrequency}\n`;
      formattedDB += `   CARB COUNTING: ${pump.dimensions.algorithm.carbCounting ? 'Required' : 'Optional'}\n`;

      // DIMENSION 5: CGM Compatibility
      formattedDB += `   CGM COMPATIBILITY: ${pump.dimensions.cgmCompatibility.compatible.join(', ')}\n`;
      if (pump.dimensions.cgmCompatibility.future && pump.dimensions.cgmCompatibility.future.length > 0) {
        formattedDB += `   FUTURE CGM: ${pump.dimensions.cgmCompatibility.future.join(', ')}\n`;
      }

      // DIMENSION 6: Target Adjustability
      formattedDB += `   TARGET ADJUSTABILITY: ${pump.dimensions.targetAdjustability.customizable ? 'Customizable' : 'Limited'} - ${pump.dimensions.targetAdjustability.ranges}\n`;
      if (pump.dimensions.targetAdjustability.exerciseMode) {
        formattedDB += `   EXERCISE TARGET: ${pump.dimensions.targetAdjustability.exerciseMode}\n`;
      }

      // DIMENSION 7: Exercise Mode
      formattedDB += `   EXERCISE MODE: ${pump.dimensions.exerciseMode.available ? pump.dimensions.exerciseMode.details : 'Not available'}\n`;

      // DIMENSION 8: Bolus Workflow
      formattedDB += `   BOLUS WORKFLOW: ${pump.dimensions.bolusWorkflow.details}\n`;

      // DIMENSION 9: Reservoir Capacity
      const capacity = pump.dimensions.capacity || pump.dimensions.reservoirCapacity;
      if (capacity) {
        formattedDB += `   RESERVOIR CAPACITY: ${capacity.units || capacity} units - ${capacity.details || capacity.changeFrequency || 'Standard'}\n`;
      }

      // DIMENSION 10: Adhesive Tolerance
      if (pump.dimensions.adhesive || pump.dimensions.adhesiveTolerance) {
        const adhesive = pump.dimensions.adhesive || pump.dimensions.adhesiveTolerance;
        formattedDB += `   ADHESIVE: ${adhesive.type || 'Standard'} - ${adhesive.details || 'Standard wear time'}\n`;
      }

      // DIMENSION 11: Water Resistance
      formattedDB += `   WATER RESISTANCE: ${pump.dimensions.waterResistance.rating} - ${pump.dimensions.waterResistance.details}\n`;
      if (pump.dimensions.waterResistance.submersible) {
        formattedDB += `   SUBMERSIBLE: ${pump.dimensions.waterResistance.depth} for ${pump.dimensions.waterResistance.duration}\n`;
      }

      // DIMENSION 12: Alerts Customization
      if (pump.dimensions.alerts || pump.dimensions.alertsCustomization) {
        const alerts = pump.dimensions.alerts || pump.dimensions.alertsCustomization;
        formattedDB += `   ALERTS: ${alerts.customizable ? 'Customizable' : 'Standard'} - ${alerts.details}\n`;
      }

      // DIMENSION 13: User Interface
      formattedDB += `   INTERFACE: ${pump.dimensions.interface?.type || pump.dimensions.userInterface?.type || 'N/A'} - ${pump.dimensions.interface?.details || pump.dimensions.userInterface?.details || 'N/A'}\n`;

      // DIMENSION 14: Data Sharing
      if (pump.dimensions.dataSharing) {
        formattedDB += `   DATA SHARING: ${pump.dimensions.dataSharing.platform} - ${pump.dimensions.dataSharing.details}\n`;
        formattedDB += `   CAREGIVER SHARING: ${pump.dimensions.dataSharing.shareWithCaregivers ? 'Yes' : 'No'}\n`;
      }

      // DIMENSION 15: Clinic Support
      if (pump.dimensions.clinicSupport) {
        formattedDB += `   CLINIC SUPPORT: ${pump.dimensions.clinicSupport.established} network - ${pump.dimensions.clinicSupport.details}\n`;
      }

      // DIMENSION 16: Travel Logistics
      if (pump.dimensions.travel || pump.dimensions.travelLogistics) {
        const travel = pump.dimensions.travel || pump.dimensions.travelLogistics;
        formattedDB += `   TRAVEL: ${travel.supplies || travel.details}\n`;
      }

      // DIMENSION 17: Caregiver Features
      if (pump.dimensions.pediatric || pump.dimensions.caregiverFeatures) {
        const caregiver = pump.dimensions.pediatric || pump.dimensions.caregiverFeatures;
        formattedDB += `   CAREGIVER FEATURES: Remote monitoring: ${caregiver.remoteMonitoring ? 'Yes' : 'No'}, Remote bolus: ${caregiver.remoteBolus ? 'Yes' : 'No'}\n`;
        formattedDB += `   CAREGIVER APP: ${caregiver.app || 'Standard'} - ${caregiver.details}\n`;
      }

      // DIMENSION 18: Wearability & Discretion
      if (pump.dimensions.discretion || pump.dimensions.wearability) {
        const wear = pump.dimensions.discretion || pump.dimensions.wearability;
        formattedDB += `   DISCRETION: ${wear.size} size, ${wear.visibility} - ${wear.details}\n`;
      }

      // DIMENSION 19: Ecosystem Integration
      if (pump.dimensions.ecosystem) {
        formattedDB += `   ECOSYSTEM: Watch support: ${pump.dimensions.ecosystem.watchSupport ? 'Yes' : 'No'}, Integrations: ${pump.dimensions.ecosystem.integrations.join(', ')}\n`;
        formattedDB += `   ECOSYSTEM DETAILS: ${pump.dimensions.ecosystem.details}\n`;
      }

      // DIMENSION 20: Reliability & Occlusion Handling
      if (pump.dimensions.reliability) {
        formattedDB += `   RELIABILITY: Occlusion detection: ${pump.dimensions.reliability.occlusionDetection ? 'Yes' : 'No'} - ${pump.dimensions.reliability.details}\n`;
      }

      // DIMENSION 21: Cost & Insurance
      formattedDB += `   COST: ${pump.dimensions.cost.coverage} coverage - ${pump.dimensions.cost.details}\n`;
      if (pump.dimensions.cost.financialAssistance) {
        formattedDB += `   FINANCIAL ASSISTANCE: ${pump.dimensions.cost.financialAssistance}\n`;
      }

      // DIMENSION 22: Software Updates
      if (pump.dimensions.updates) {
        formattedDB += `   UPDATES: ${pump.dimensions.updates.automatic ? 'Automatic' : 'Manual'} - ${pump.dimensions.updates.details}\n`;
      }

      // Summary Information
      formattedDB += `   PROS: ${pump.pros?.join(', ') || 'N/A'}\n`;
      formattedDB += `   CONS: ${pump.cons?.join(', ') || 'N/A'}\n`;
      formattedDB += `   IDEAL FOR: ${pump.idealFor?.join(', ') || 'N/A'}\n`;
      formattedDB += `\n`;
    });

    return formattedDB;
  }

  private extractWeightInfo(pump: PumpDetails): string {
    // Provide neutral weight/size information without bias
    if (pump.dimensions.tubing.type === 'tubeless') {
      return 'Tubeless design';
    }

    if (pump.dimensions.discretion.size) {
      return `${pump.dimensions.discretion.size} size`;
    }

    return 'Standard form factor';
  }

  private parseClaudeResponse(response: string): PumpRecommendation {
    try {
      // Extract JSON from the response (Claude might include explanation text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback parsing if no clean JSON
      return this.createFallbackRecommendation();
    } catch (error) {
      logError('pumpDriveAI', 'Error message', {});
      return this.createFallbackRecommendation();
    }
  }

  private createFallbackRecommendation(): PumpRecommendation {
    logWarn('pumpDriveAI', 'Using fallback recommendation due to AI service failure', {});

    // Provide a basic fallback recommendation
    return {
      topChoice: {
        name: 'Medtronic 780G',
        score: 85,
        reasons: [
          'Well-established hybrid closed-loop system',
          'Strong clinical support and training resources',
          'Good insurance coverage',
          'Proven track record for glucose management'
        ]
      },
      alternatives: [
        {
          name: 'Tandem t:slim X2',
          score: 80,
          reasons: [
            'Touchscreen interface',
            'Dexcom G6 integration',
            'Remote software updates'
          ]
        },
        {
          name: 'Omnipod 5',
          score: 75,
          reasons: [
            'Tubeless design',
            'Phone control',
            'Automated insulin delivery'
          ]
        }
      ],
      keyFactors: [
        'Insulin pump therapy experience',
        'Technology comfort level',
        'Insurance coverage requirements'
      ],
      personalizedInsights: 'Due to a temporary service issue, we\'ve provided a general recommendation. The Medtronic 780G is a solid choice for most users with its proven hybrid closed-loop technology and excellent support network. Please contact your healthcare provider to discuss the best option for your specific needs.'
    };
  }

  private saveRecommendation(recommendation: PumpRecommendation): void {
    // Save to session storage for results page
    sessionStorage.setItem('pumpdrive_recommendation', JSON.stringify(recommendation));
    sessionStorage.setItem('pumpdrive_recommendation_timestamp', Date.now().toString());
  }

  // Legacy method for compatibility with existing results page
  async getRecommendations(formattedResponses: any[]): Promise<PumpRecommendation> {
    // Convert the old format to new format
    const responses: Record<string, CategoryResponse> = {};

    formattedResponses.forEach((item: any) => {
      const categoryKey = item.category;
      const categoryData = item.responses;

      // Convert to CategoryResponse format
      responses[categoryKey] = {
        category: categoryKey,
        mainTranscript: categoryData.mainTranscript || '',
        followUpTranscript: categoryData.followUpTranscript || '',
        checkedQuestions: categoryData.checkedQuestions || [],
        timestamp: categoryData.timestamp || Date.now(),
      };
    });

    // Use the enhanced processing method
    return await this.processUserResponses(responses);
  }

  async generateSummaryReport(responses: Record<string, CategoryResponse>): Promise<string> {
    const prompt = `Create a concise summary report of this patient's insulin pump preferences based on their responses:

${this.createUserProfile(responses)}

Provide a 2-3 paragraph summary highlighting:
1. Primary needs and concerns
2. Lifestyle factors
3. Technology comfort level
4. Support requirements`;

    try {
      const summary = await openAIService.processText(prompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 });
      return summary;
    } catch (error) {
      logError('pumpDriveAI', 'Error message', {});
      return 'Summary generation failed.';
    }
  }

  // New method for simplified flow
  async processSimplifiedFlow(): Promise<PumpRecommendation> {
    try {
      // Collect all user data from session storage
      const sliders = JSON.parse(sessionStorage.getItem('pumpDriveSliders') || '{}');
      const features = JSON.parse(sessionStorage.getItem('selectedPumpFeatures') || '[]');
      const freeTextData = JSON.parse(sessionStorage.getItem('pumpDriveFreeText') || '{}');
      const clarifyingResponses = JSON.parse(sessionStorage.getItem('pumpDriveClarifyingResponses') || '{}');

      // Try advanced AI processing first
      try {
        // Create user profile from simplified flow data
        const userProfile = this.createSimplifiedUserProfile(sliders, features, freeTextData.currentSituation || '', clarifyingResponses);

        // Format pump database
        const pumpDetails = this.formatPumpDatabase();

        // Create enhanced prompt for Claude using all 23 dimensions
        const prompt = `You are an expert diabetes educator and insulin pump specialist. Based on the following patient assessment data, provide personalized insulin pump recommendations using the complete 23-dimension pump database extracted from PDF documentation.

CRITICAL ANALYSIS INSTRUCTIONS:
- DO NOT use any pre-calculated scores or ranking biases
- Analyze the patient's responses objectively without any pre-programmed scoring systems
- Base recommendations purely on objective analysis of patient needs against pump specifications

ANALYSIS PRIORITY HIERARCHY:
1. **EXPLICIT FEATURE SELECTIONS**: Features the patient specifically selected carry the highest weight
   - If patient selected "Apple Watch bolusing" → ONLY Twiist supports this (major factor)
   - If patient selected "2 ounces weight" → ONLY Twiist offers this (major factor)
   - If patient selected "swap batteries" → Favor pumps with replaceable batteries
2. **CLARIFYING RESPONSES**: Direct answers to conflict questions are second priority
3. **PERSONAL STORY KEYWORDS**: Specific medical/lifestyle needs mentioned in free text
4. **SLIDER PREFERENCES**: General lifestyle ratings are lower priority than explicit selections

CRITICAL DECISION RULES:

WEIGHT PRIORITIZATION:
- If user mentions "lightest", "lightweight", "minimal weight", or weight as a priority:
  → Twiist (2 oz - LIGHTEST) > Tandem Mobi (small) > Omnipod 5 (pod) > others
- Twiist at 2 oz is BY FAR the lightest pump available

TARGET GLUCOSE RANKINGS:
- LOWEST available targets:
  1. Twiist: 87 mg/dL (LOWEST standard target)
  2. Beta Bionics iLet: 60 mg/dL (only in special "lower than usual" mode)
  3. Medtronic 780G: 100 mg/dL (fixed aggressive target)
- If user wants "lowest target glucose" → strongly consider Twiist first

CONTROL TIGHTNESS/AGGRESSIVENESS:
- "Tightest control" or "most aggressive" means:
  1. Medtronic 780G: 100% correction (vs 60% for others) - MOST AGGRESSIVE
  2. Twiist: Aggressive microbolus-like basal modulations
  3. Others: Standard 60% correction approach
- For "best control" consider BOTH algorithm aggressiveness AND target flexibility

TECHNOLOGY FEATURES:
- "Tech-savvy" or "modern tech" priorities:
  1. Twiist: Apple Watch bolusing, emoji dosing, phone-first
  2. Tandem Mobi: Wireless charging, iPhone control
  3. t:slim X2: Touchscreen, multiple CGM options

CRITICAL PUMP FACTS:
- Apple Watch bolusing: ONLY Twiist supports this feature
- Lightest weight (2 oz): ONLY Twiist offers this
- Most aggressive algorithm: Medtronic 780G (100% correction)
- Lowest target glucose: Twiist (87 mg/dL standard target)

CONFLICT RESOLUTION:
- When patient selections conflict with slider ratings, prioritize explicit selections
- When multiple pumps match, use clarifying responses to break ties
- Always explain why selected features were/weren't prioritized in recommendation

PATIENT ASSESSMENT DATA:
${userProfile}

COMPLETE INSULIN PUMP DATABASE (ALL 23 DIMENSIONS):
${pumpDetails}

ANALYSIS INSTRUCTIONS:
1. Evaluate all pumps objectively using ALL 23 dimensions provided in the database
2. Consider ALL pump specifications: battery type, phone control, tubing, algorithm, CGM compatibility, target adjustability, exercise mode, bolus workflow, reservoir capacity, adhesive tolerance, water resistance, alerts customization, user interface, data sharing, clinic support, travel logistics, caregiver features, discretion/wearability, ecosystem integration, reliability/occlusion handling, cost/insurance, and software updates
3. Match patient preferences (slider values, selected features, free text input, and clarifying responses) against comprehensive pump specifications
4. Prioritize features that matter most to this specific patient's lifestyle and medical needs
5. Explain reasoning based on how ALL relevant pump dimensions align with patient requirements
6. Provide balanced assessment considering the complete feature set of each pump

Please analyze the patient's needs across all 23 pump dimensions and provide:
1. Top recommended pump with detailed reasoning based on patient's specific preferences and comprehensive pump specifications
2. 2-3 alternative options ranked by suitability across all dimensions
3. Key factors that influenced your recommendation (include patient quotes and specific pump dimensions)
4. Personalized insights explaining how the recommended pump's complete feature set matches this patient's situation

Format your response as JSON with the following structure:
{
  "topChoice": {
    "name": "exact pump name from database",
    "score": 0-100,
    "reasons": ["specific reason based on patient input", "feature match", "lifestyle fit"]
  },
  "alternatives": [
    {
      "name": "exact pump name from database",
      "score": 0-100,
      "reasons": ["why this is alternative choice", "what it offers"]
    }
  ],
  "keyFactors": ["patient's stated priority 1", "patient's stated priority 2", "key consideration"],
  "personalizedInsights": "Detailed explanation of why the top choice specifically matches what the patient indicated they wanted, including references to their slider values, selected features, and free text input where relevant"
}`;

        // Use Claude for processing
        const response = await openAIService.processText(prompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 });

        // Parse the JSON response
        const recommendation = this.parseClaudeResponse(response);

        // Save the recommendation
        this.saveRecommendation(recommendation);

        return recommendation;
      } catch (aiError) {
        logError('pumpDriveAI', 'AI processing failed - using enhanced fallback', { error: aiError });

        // Use enhanced fallback that considers user inputs
        const fallbackRecommendation = this.createEnhancedFallbackRecommendation(
          sliders,
          features,
          freeTextData,
          clarifyingResponses
        );

        this.saveRecommendation(fallbackRecommendation);
        return fallbackRecommendation;
      }
    } catch (error) {
      logError('pumpDriveAI', 'Error processing simplified flow', { error });
      throw error;
    }
  }

  private createEnhancedFallbackRecommendation(
    sliders: Record<string, number>,
    features: Array<{ id: string; title: string; pumpId?: string }>,
    freeTextData: any,
    clarifyingResponses: Record<string, string>
  ): PumpRecommendation {
    logWarn('pumpDriveAI', 'Using enhanced fallback recommendation due to AI service failure', {
      slidersCount: Object.keys(sliders).length,
      featuresCount: features.length,
      hasFreeText: !!freeTextData?.currentSituation,
      clarifyingCount: Object.keys(clarifyingResponses).length
    });

    // Analyze user inputs to provide better fallback
    let topRecommendation = 'Medtronic 780G';
    let score = 85;
    let reasons = [
      'Well-established hybrid closed-loop system',
      'Strong clinical support and training resources',
      'Good insurance coverage'
    ];

    // Check for specific feature preferences
    const selectedFeatures = features.map(f => f.title.toLowerCase());

    // Check free text for weight/size preferences
    const freeTextLower = (freeTextData?.currentSituation || '').toLowerCase();

    // PRIORITY 1: Weight-specific features (Twiist is ONLY pump at 2 ounces)
    if (selectedFeatures.some(f => f.includes('2 ounces') || f.includes('weighs only') || f.includes('lightest')) ||
        freeTextLower.includes('2 ounces') || freeTextLower.includes('lightest') || freeTextLower.includes('2oz')) {
      topRecommendation = 'Twiist';
      score = 95;
      reasons = [
        'Lightest insulin pump at only 2 ounces',
        'Ultra-compact tubed design',
        'Apple Watch control and modern tech features'
      ];
    }
    // PRIORITY 2: Apple Watch (Twiist exclusive)
    else if (selectedFeatures.some(f => f.includes('apple watch')) ||
             freeTextLower.includes('apple watch')) {
      topRecommendation = 'Twiist';
      score = 94;
      reasons = [
        'Only pump with Apple Watch control',
        'Lightest weight at 2 ounces',
        'Modern smartphone integration'
      ];
    }
    // PRIORITY 3: Tubeless preference
    else if (selectedFeatures.some(f => f.includes('tubeless') || f.includes('patch')) ||
             freeTextLower.includes('tubeless') || freeTextLower.includes('no tubing')) {
      topRecommendation = 'Omnipod 5';
      score = 90;
      reasons = [
        'Completely tubeless patch design',
        'Phone control capabilities',
        'Automated insulin delivery'
      ];
    }
    // PRIORITY 4: Simple/hands-off (Beta Bionics iLet)
    else if (selectedFeatures.some(f => f.includes('no carb counting') || f.includes('simple')) ||
             freeTextLower.includes("don't want to do anything") || freeTextLower.includes('hands-off') ||
             freeTextLower.includes('simple')) {
      topRecommendation = 'Beta Bionics iLet';
      score = 88;
      reasons = [
        'No carb counting required',
        'Fully automated insulin delivery',
        'Simplest workflow of all pumps'
      ];
    }
    // PRIORITY 5: Touchscreen/tech-savvy
    else if (selectedFeatures.some(f => f.includes('touchscreen') || f.includes('phone')) ||
             sliders.techComfort >= 7) {
      topRecommendation = 'Tandem t:slim X2';
      score = 86;
      reasons = [
        'Color touchscreen interface',
        'Phone app integration',
        'Remote software updates'
      ];
    }

    return {
      topChoice: {
        name: topRecommendation,
        score,
        reasons
      },
      alternatives: [
        {
          name: 'Medtronic 780G',
          score: 85,
          reasons: ['Proven hybrid closed-loop', 'Strong clinical support']
        },
        {
          name: 'Tandem t:slim X2',
          score: 80,
          reasons: ['Touchscreen interface', 'Dexcom integration']
        }
      ].filter(alt => alt.name !== topRecommendation),
      keyFactors: [
        'Technology preferences from your selections',
        'Insulin pump therapy experience',
        'Lifestyle and activity level'
      ],
      personalizedInsights: `Based on your preferences${selectedFeatures.length > 0 ? ` (especially interest in ${selectedFeatures.slice(0, 2).join(' and ')})` : ''}, we recommend the ${topRecommendation}. While our AI service is temporarily unavailable, this recommendation considers your key requirements. Please discuss with your healthcare provider for a full personalized assessment.`
    };
  }

  private createSimplifiedUserProfile(
    sliders: Record<string, number>,
    features: Array<{ id: string; title: string; pumpId?: string }>,
    freeText: string,
    clarifyingResponses: Record<string, string>
  ): string {
    let profile = 'PATIENT PUMP ASSESSMENT PROFILE:\n\n';

    // Slider preferences
    if (Object.keys(sliders).length > 0) {
      profile += 'SLIDER PREFERENCES (1-10 scale):\n';
      Object.entries(sliders).forEach(([key, value]) => {
        const displayName = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        profile += `- ${displayName}: ${value}/10\n`;
      });
      profile += '\n';
    }

    // Selected features
    if (features.length > 0) {
      profile += 'SELECTED FEATURES (what patient specifically wants):\n';
      features.forEach(feature => {
        profile += `- ${feature.title}\n`;
      });
      profile += '\n';
    }

    // Free text input
    if (freeText.trim()) {
      profile += 'PATIENT\'S PERSONAL STORY:\n';
      profile += `"${freeText}"\n\n`;
    }

    // Clarifying responses
    if (Object.keys(clarifyingResponses).length > 0) {
      profile += 'CLARIFYING RESPONSES:\n';
      Object.entries(clarifyingResponses).forEach(([question, answer]) => {
        profile += `Q: ${question}\n`;
        profile += `A: ${answer}\n\n`;
      });
    }

    return profile;
  }

  /**
   * Process a prompt with Claude AI for general pump-related queries
   * Used for generating clarifying questions and other AI tasks
   */
  async processWithClaude(prompt: string, context?: string): Promise<string> {
    try {
      logDebug('pumpDriveAI', 'Processing prompt with Claude AI', { context });

      // Use the azureAI service to process the prompt
      const response = await openAIService.processText(prompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 });

      logInfo('pumpDriveAI', 'Successfully processed prompt with Claude AI', {});
      return response;
    } catch (error) {
      logError('pumpDriveAI', 'Failed to process prompt with Claude AI', { error });
      throw new Error('AI processing failed. Please try again.');
    }
  }

  /**
   * Process follow-up questions about pump recommendations
   * Uses complete context including original recommendation and user data
   */
  async processFollowUpQuestion(question: string, userContext: any): Promise<string> {
    const maxRetries = 2;
    const retryDelay = 1500; // 1.5 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logDebug('pumpDriveAI', `Processing follow-up question (attempt ${attempt}/${maxRetries})`, { question });

        // Format pump database with all 23 dimensions
        const pumpDetails = this.formatPumpDatabase();

        // Create comprehensive context for the follow-up question
        const prompt = `You're a friendly diabetes educator helping someone understand their insulin pump recommendation. Answer their question in a conversational, easy-to-understand way.

THEIR RECOMMENDATION:
Top Choice: ${userContext.currentRecommendation?.topRecommendation?.name || 'Not available'}
Score: ${userContext.currentRecommendation?.topRecommendation?.score || 'N/A'}/100

Alternative Options:
${userContext.currentRecommendation?.alternatives?.map((alt: any, index: number) =>
  `${index + 1}. ${alt.name} (Score: ${alt.score}/100)`
).join('\n') || 'None provided'}

WHAT THEY TOLD US:
Preferences: ${Object.entries(userContext.sliders || {}).map(([key, value]) => `${key}: ${value}/10`).join(', ')}

Features they wanted: ${(userContext.features || []).map((f: any) => f.name || f.title || f.id || f).join(', ')}

Their story: "${userContext.freeText?.currentSituation || userContext.freeText?.userStory || 'Not provided'}"

Clarifying answers: ${Object.entries(userContext.clarifyingResponses || {}).map(([q, a]) => `Q: ${q} A: ${a}`).join('\n') || 'None'}

PUMP DATABASE WITH ALL FEATURES:
${pumpDetails}

THEIR QUESTION:
"${question}"

HOW TO ANSWER:
• Start with a friendly response like "Great question!" or "I'm happy to explain that!"
• Use bullet points to make it easy to read
• Explain things simply - avoid medical jargon
• Use "you" and "your" (not "patient")
• Compare specific features when relevant
• Be honest about trade-offs
• End with encouragement

RESPONSE FORMAT:
Great question! Here's why [explanation]:

• [Key point 1]
• [Key point 2]
• [Key point 3]

Key differences:
• [Pump A]: [specific feature]
• [Pump B]: [specific feature]

Bottom line: [Simple summary of why this choice makes sense for them]

Keep it friendly, clear, and helpful!`;

        // Process the follow-up question with Claude
        const response = await openAIService.processText(prompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 });

        logInfo('pumpDriveAI', `Successfully processed follow-up question on attempt ${attempt}`, {});
        return response;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;

        if (isLastAttempt) {
          logError('pumpDriveAI', `Failed to process follow-up question after ${maxRetries} attempts`, { error, question });

          // Provide a helpful fallback response based on the question
          const fallbackResponse = this.generateFallbackResponse(question, userContext);
          return fallbackResponse;
        } else {
          logWarn('pumpDriveAI', `Follow-up question failed on attempt ${attempt}, retrying...`, { error, question });

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // This should never be reached due to the fallback above, but just in case
    throw new Error('Unable to process your question right now. Please try again.');
  }

  /**
   * Generate a helpful fallback response when Azure AI fails
   */
  private generateFallbackResponse(question: string, userContext: any): string {
    const topChoice = userContext.currentRecommendation?.topRecommendation?.name || 'the recommended pump';
    const questionLower = question.toLowerCase();

    if (questionLower.includes('why not') || questionLower.includes("wasn't") || questionLower.includes('why didn\'t')) {
      return `Great question! I'd love to help explain the reasoning behind your recommendation, but I'm having some technical difficulties right now.

Based on your preferences, ${topChoice} was recommended because it best matches what you told us about your lifestyle and priorities. Each pump has different strengths, and the recommendation considers factors like:

• Your technology comfort level
• Activity and lifestyle preferences
• Specific features you selected
• Your personal story and needs

Please try asking your question again in a moment, or feel free to discuss these insights with your healthcare provider for more detailed guidance.`;
    }

    if (questionLower.includes('happy') || questionLower.includes('satisfied') || questionLower.includes('right choice')) {
      return `Great question! Based on what you shared with us, ${topChoice} seems like it could be a great fit for your lifestyle and preferences.

The recommendation takes into account:
• Your specific feature preferences
• Your comfort with technology
• Your activity level and daily routine
• The priorities you mentioned

Of course, the best way to know if you'll be happy with any pump is to discuss it thoroughly with your healthcare provider, who knows your medical history and can provide personalized guidance.

Please try asking again in a moment for more detailed insights, or feel free to explore the recommendation details above!`;
    }

    // Generic fallback
    return `I'd be happy to help answer your question about pump recommendations, but I'm experiencing some technical difficulties right now.

Your recommendation for ${topChoice} was based on carefully analyzing your preferences, lifestyle, and the features that matter most to you.

Please try asking your question again in a moment, and I'll do my best to provide you with a detailed, helpful response. You can also discuss these recommendations with your healthcare provider for additional guidance.`;
  }
}

export const pumpDriveAIService = new PumpDriveAIService();
