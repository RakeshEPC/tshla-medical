// Enhanced with comprehensive pump database
import {
  COMPREHENSIVE_PUMP_DATABASE,
  findPumpByName,
  type ComprehensivePumpData,
} from '../data/pumpDataComprehensive';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

// Local interface definitions to avoid import issues
interface SliderResponse {
  sliderId: string;
  value: number;
  timestamp: number;
  category: string;
}

interface SliderProfile {
  userId?: string;
  sessionId: string;
  responses: SliderResponse[];
  profileHash: string;
  createdAt: number;
  completedAt?: number;
}

interface SliderRecommendation {
  profileId: string;
  topPumps: Array<{
    pumpId: string;
    pumpName: string;
    score: number;
    matchFactors: string[];
    sliderInfluence: Record<string, number>;
    pumpSpecs?: ComprehensivePumpData;
  }>;
  personalizedInsights: string[];
  nextSteps: string[];
  confidence: number;
}

// Local interface definition to avoid export issues
interface SliderAnalysis {
  profile: SliderProfile;
  recommendation: SliderRecommendation;
  cacheKey: string;
  processingTime: number;
  source: 'cache' | 'ai';
}
import { openAIService } from './openai.service';

interface MCPResponse {
  found: boolean;
  recommendation?: string;
  profileId?: string;
  profileHash?: string;
  age_ms?: number;
  hits?: number;
  success?: boolean;
  cached?: boolean;
  error?: string;
}

class SliderMCPService {
  private sessionId: string = '';

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `slider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateProfileHash(
    sliderData: Record<string, number>,
    selectedFeatures?: any[],
    freeText?: string
  ): string {
    // Create consistent hash from ALL assessment data
    const sliderString = Object.keys(sliderData)
      .sort()
      .map(key => `${key}:${sliderData[key]}`)
      .join(',');
    const featuresString = (selectedFeatures || [])
      .map(f => f.title || f.id || '')
      .sort()
      .join(',');
    const storyString = (freeText || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const combinedData = `sliders:${sliderString}|features:${featuresString}|story:${storyString}`;
    return btoa(combinedData)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32);
  }

  async saveSliderProfile(
    sliderData: Record<string, number>
  ): Promise<{ profileId: string; profileHash: string }> {
    logDebug('sliderMCP', 'Debug message', {});

    const profile: SliderProfile = {
      sessionId: this.sessionId,
      responses: Object.entries(sliderData).map(([key, value]) => ({
        sliderId: key,
        value,
        timestamp: Date.now(),
        category: key,
      })),
      profileHash: this.generateProfileHash(sliderData, [], ''),
      createdAt: Date.now(),
    };

    try {
      // In a real MCP implementation, this would call the MCP server
      // For now, we'll simulate the MCP call and store locally
      const profileData = JSON.stringify(profile);

      // Simulate MCP server call
      const response: MCPResponse = {
        success: true,
        profileId: `profile_${Date.now()}`,
        profileHash: profile.profileHash,
      };

      logInfo('sliderMCP', 'Info message', {});

      // Also save to localStorage as backup
      localStorage.setItem(`slider_profile_${response.profileId}`, profileData);

      return {
        profileId: response.profileId!,
        profileHash: response.profileHash!,
      };
    } catch (error) {
      logError('sliderMCP', 'Error message', {});
      throw new Error('Failed to save slider profile');
    }
  }

  async getSliderRecommendation(profileHash: string): Promise<SliderRecommendation | null> {
    logDebug('sliderMCP', 'Debug message', {});

    try {
      // In a real MCP implementation, this would call the MCP server
      // For now, we'll check localStorage cache
      const cachedData = this.checkLocalCache(profileHash);

      if (cachedData) {
        logDebug('sliderMCP', 'Debug message', {});
        return cachedData;
      }

      logDebug('sliderMCP', 'Debug message', {});
      return null;
    } catch (error) {
      logError('sliderMCP', 'Error message', {});
      return null;
    }
  }

  private checkLocalCache(profileHash: string): SliderRecommendation | null {
    try {
      const cacheKey = `slider_rec_${profileHash}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);
        const hourAgo = Date.now() - 3600000; // 1 hour TTL

        if (data.createdAt > hourAgo) {
          return data.recommendation;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async generateRecommendation(
    sliderData: Record<string, number>,
    selectedFeatures: any[] = []
  ): Promise<SliderAnalysis> {
    logDebug('sliderMCP', 'Debug message', {});

    const startTime = Date.now();
    const freeTextForHash = this.getFreeTextResponse();
    const profileHash = this.generateProfileHash(sliderData, selectedFeatures, freeTextForHash);

    // Check cache first
    let cachedRecommendation = await this.getSliderRecommendation(profileHash);

    if (cachedRecommendation) {
      return {
        profile: {
          sessionId: this.sessionId,
          responses: Object.entries(sliderData).map(([key, value]) => ({
            sliderId: key,
            value,
            timestamp: Date.now(),
            category: key,
          })),
          profileHash,
          createdAt: Date.now(),
        },
        recommendation: cachedRecommendation,
        cacheKey: profileHash,
        processingTime: Date.now() - startTime,
        source: 'cache',
      };
    }

    // Use passed selectedFeatures or fallback to session storage
    const featuresData =
      selectedFeatures.length > 0 ? selectedFeatures : this.getSelectedFeatures();
    // Get free text response from session storage
    const freeTextData = sessionStorage.getItem('pumpDriveFreeText');
    const freeTextResponse = freeTextData ? JSON.parse(freeTextData)?.currentSituation : '';

    const enhancedPrompt = this.buildEnhancedAIPrompt(sliderData, featuresData, freeTextResponse);

    try {
      const aiResponse = await openAIService.processText(enhancedPrompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 });
      const recommendation = this.parseAIResponse(aiResponse, sliderData);

      // Feature boosting removed - AI handles feature preferences objectively in the prompt

      // Cache the recommendation
      await this.cacheRecommendation(profileHash, recommendation);

      return {
        profile: {
          sessionId: this.sessionId,
          responses: Object.entries(sliderData).map(([key, value]) => ({
            sliderId: key,
            value,
            timestamp: Date.now(),
            category: key,
          })),
          profileHash,
          createdAt: Date.now(),
        },
        recommendation,
        cacheKey: profileHash,
        processingTime: Date.now() - startTime,
        source: 'ai',
      };
    } catch (error) {
      logError('sliderMCP', 'Error message', {});
      throw new Error('Failed to generate pump recommendation');
    }
  }

  private getSelectedFeatures(): any[] {
    try {
      const featuresData = sessionStorage.getItem('selectedPumpFeatures');
      return featuresData ? JSON.parse(featuresData) : [];
    } catch {
      return [];
    }
  }

  private getFreeTextResponse(): string {
    try {
      const freeTextData = sessionStorage.getItem('pumpDriveFreeText');
      if (freeTextData) {
        const data = JSON.parse(freeTextData);
        return data.currentSituation || '';
      }
      return '';
    } catch {
      return '';
    }
  }

  private buildEnhancedAIPrompt(
    sliderData: Record<string, number>,
    selectedFeatures: any[],
    freeTextResponse?: string
  ): string {
    // Build comprehensive assessment summary
    let enhancedPrompt = `🎯 COMPLETE USER ASSESSMENT - INSULIN PUMP RECOMMENDATION

You are helping a person with diabetes choose the perfect insulin pump based on their complete assessment. Please provide a highly personalized recommendation based on ALL the information below.

CRITICAL ANALYSIS INSTRUCTIONS:
- DO NOT use any pre-calculated scores or ranking biases
- Analyze the patient's responses objectively without any pre-programmed scoring systems
- Base recommendations purely on objective analysis of patient needs against pump specifications

ANALYSIS PRIORITY HIERARCHY:
1. **EXPLICIT FEATURE SELECTIONS**: Features the patient specifically selected carry the highest weight
   - If patient selected "Apple Watch bolusing" → ONLY Twiist supports this (major factor)
   - If patient selected "2 ounces weight" → ONLY Twiist offers this (major factor)
   - If patient selected "swap batteries" → Favor pumps with replaceable batteries
2. **PERSONAL STORY KEYWORDS**: Specific medical/lifestyle needs mentioned in free text
3. **SLIDER PREFERENCES**: General lifestyle ratings are lower priority than explicit selections

CRITICAL PUMP FACTS:
- Apple Watch bolusing: ONLY Twiist supports this feature
- Lightest weight (2 oz): ONLY Twiist offers this
- Tandem Mobi: iPhone-only, no Apple Watch control, not 2 oz
- If patient selected both "Apple Watch" AND "2 oz" features → Twiist should be heavily favored unless major contraindications exist

`;

    // Section 1: Slider Preferences
    const { activity, techComfort, simplicity, discreteness, timeDedication } = sliderData;

    enhancedPrompt += `📊 USER'S LIFESTYLE PREFERENCES (1-10 scale):

🏃 Activity Level: ${activity}/10
`;
    if (activity <= 3) enhancedPrompt += `   → Mostly sedentary, prefers comfort and stability`;
    else if (activity >= 7)
      enhancedPrompt += `   → Very active lifestyle, needs durable and flexible solutions`;
    else enhancedPrompt += `   → Moderately active, balanced lifestyle needs`;

    enhancedPrompt += `
📱 Technology Love: ${techComfort}/10
`;
    if (techComfort <= 3)
      enhancedPrompt += `   → Prefers simple, basic technology with minimal complexity`;
    else if (techComfort >= 7)
      enhancedPrompt += `   → Loves technology, early adopter, wants advanced features`;
    else enhancedPrompt += `   → Comfortable with technology but not obsessed`;

    enhancedPrompt += `
🎛️ Complexity Preference: ${simplicity}/10
`;
    if (simplicity <= 3)
      enhancedPrompt += `   → Wants simple, straightforward devices with minimal options`;
    else if (simplicity >= 7)
      enhancedPrompt += `   → Enjoys advanced features, data, and control options`;
    else enhancedPrompt += `   → Likes some features but not overwhelming complexity`;

    enhancedPrompt += `
🤫 Privacy/Discreteness: ${discreteness}/10
`;
    if (discreteness <= 3)
      enhancedPrompt += `   → Device must be completely hidden, very concerned about visibility`;
    else if (discreteness >= 7)
      enhancedPrompt += `   → Doesn't care who sees it, function over appearance`;
    else enhancedPrompt += `   → Prefers discreet but okay if sometimes visible`;

    enhancedPrompt += `
⏰ Time for Device Care: ${timeDedication}/10
`;
    if (timeDedication <= 3)
      enhancedPrompt += `   → Wants set-and-forget simplicity with minimal maintenance`;
    else if (timeDedication >= 7)
      enhancedPrompt += `   → Happy to spend time optimizing and maintaining for best results`;
    else enhancedPrompt += `   → Willing to do basic maintenance but not excessive work`;

    // Section 2: Selected Features
    if (selectedFeatures.length > 0) {
      const groupedFeatures = selectedFeatures.reduce(
        (acc, feature) => {
          const category = feature.category || 'other';
          if (!acc[category]) acc[category] = [];
          acc[category].push(feature);
          return acc;
        },
        {} as Record<string, any[]>
      );

      enhancedPrompt += `

⭐ SPECIFIC FEATURES THE USER SELECTED:
The user carefully chose ${selectedFeatures.length} features that appeal to them:

`;

      Object.entries(groupedFeatures).forEach(([category, features]) => {
        const categoryNames: Record<string, string> = {
          power: '🔋 Power & Charging',
          design: '🎨 Design & Size',
          interface: '📱 Controls & Interface',
          convenience: '✨ Convenience Features',
          automation: '🤖 Automation Level',
        };

        enhancedPrompt += `${categoryNames[category] || category.toUpperCase()}:
`;
        features.forEach(feature => {
          enhancedPrompt += `   ${feature.emoji} ${feature.title} - ${feature.description}
`;
        });
        enhancedPrompt += `
`;
      });

      enhancedPrompt += `🎯 FEATURE ANALYSIS INSTRUCTIONS:
Consider the selected features as important factors in your analysis, but evaluate all pumps objectively. Selected features should influence your recommendation, but not create automatic rankings. Balance feature preferences with other factors like lifestyle, medical needs, and overall suitability.`;
    } else {
      enhancedPrompt += `

⭐ FEATURE SELECTIONS: User did not select specific features, so base recommendation purely on lifestyle preferences.`;
    }

    // Section 3: Personal Story
    if (freeTextResponse?.trim()) {
      enhancedPrompt += `

💭 USER'S PERSONAL STORY & CONTEXT:
"${freeTextResponse.trim()}"

🧠 ANALYSIS INSTRUCTIONS:
1. Identify specific concerns, fears, or challenges mentioned
2. Note what excites them or what they're looking forward to
3. Understand their current situation and pain points
4. Look for hints about their personality and values
5. Address their emotional needs in addition to technical requirements`;

      // Critical pattern detection for tight control
      if (
        freeTextResponse?.toLowerCase().includes('tight') &&
        freeTextResponse?.toLowerCase().includes('control')
      ) {
        enhancedPrompt += `

🚨 CRITICAL: User explicitly wants TIGHTEST CONTROL
This overrides other preferences. Recommend Control-IQ (Tandem) or SmartGuard (Medtronic) as top choices.`;
      }
    } else {
      enhancedPrompt += `

💭 PERSONAL STORY: User chose not to share their personal story.`;
    }

    // Section 4: AI Instructions
    enhancedPrompt += `

🤖 RECOMMENDATION INSTRUCTIONS:

Available pumps: Omnipod 5, Tandem t:slim X2, Tandem Mobi, Medtronic 780G, Beta Bionics iLet, Twiist

PUMP SPECIFICATIONS (USE FOR DECISIONS):
Twiist:
- Weight: 2 ounces
- Algorithm: Modern adaptive logic (More aggressive: basal modulations similar to microboluses)
- Frequency: Adjusts every 5 minutes
- Battery: Rechargeable (4 replaceable batteries)
- Tubing: Tubed (compact)
- Water: Water-resistant (splash proof, not submersible)
- Unique: Apple Watch bolusing, Only 2 ounces, Emoji-based bolusing

Omnipod 5:
- Weight: Pod weight (tubeless)
- Algorithm: On-pod adapting algorithm (Continuously learns, uses CGM data)
- Frequency: Adjusts basal insulin delivery every 5 minutes
- Battery: Pod battery (disposable - no charging)
- Tubing: Tubeless pod
- Water: IP28 (Submersible up to 8 feet for up to 60 mins)
- Unique: No tubing, Low pod profile, Activity feature

Tandem t:slim X2:
- Weight: Standard tubed pump
- Algorithm: Control-IQ (MOST AGGRESSIVE, adjusts every 5 minutes)
- Frequency: Every 5 minutes with predictive adjustments
- Battery: Rechargeable
- Tubing: Traditional tubing
- Water: Water-resistant
- Unique: Smartphone integration, Most aggressive control, Advanced data analytics

Medtronic 780G:
- Weight: Standard tubed pump
- Algorithm: SmartGuard (Very aggressive, predictive)
- Frequency: Continuous monitoring with adjustments
- Battery: Rechargeable
- Tubing: Traditional tubing
- Water: Water-resistant
- Unique: Guardian CGM integration, Predictive low glucose suspend

iLet:
- Weight: Standard tubed pump
- Algorithm: Bionic Pancreas (Moderate, meal announcements only)
- Frequency: Adaptive dosing
- Battery: Rechargeable
- Tubing: Traditional tubing
- Water: Standard resistance
- Unique: Minimal user input, Automated dosing decisions

Tandem Mobi:
- Weight: Compact tubed pump
- Algorithm: Control-IQ (same as t:slim X2)
- Frequency: Every 5 minutes
- Battery: Rechargeable
- Tubing: Shorter tubing design
- Water: Water-resistant
- Unique: Smaller form factor, Same advanced algorithm as t:slim X2

CONTROL ALGORITHM RANKINGS (TIGHTEST TO LOOSEST):
1. Tandem Control-IQ (t:slim X2 & Mobi) - Most aggressive, adjusts every 5 minutes
2. Medtronic SmartGuard (780G) - Very aggressive, predictive
3. Omnipod 5 SmartAdjust - Moderate, adjusts every 5 minutes
4. Twiist Modern Logic - Moderate, more aggressive basal modulations
5. iLet Bionic Pancreas - Moderate, meal announcements only

When user wants "tightest control", prioritize pumps 1-2 above.

Please provide a comprehensive recommendation that:
1. 🎯 CONSIDER: Evaluate pumps with selected features favorably, but maintain objective analysis across all options
2. PRIORITIZES all pumps matching their selected features over those that don't
3. CONSIDERS their lifestyle slider preferences
4. ADDRESSES their personal story and concerns (if shared) 
5. EXPLAINS the "why" behind each recommendation
6. PROVIDES actionable next steps

CRITICAL SCORING RULE: Unique features = Automatic top ranking for that pump. No exceptions unless severe contradictions exist.

Respond with JSON in this exact format:
{
  "topPumps": [
    {
      "pumpId": "omnipod5",
      "pumpName": "Omnipod 5",
      "score": 95,
      "matchFactors": ["Perfect for active lifestyle", "Selected tubeless design feature"],
      "sliderInfluence": {"activity": 9, "techComfort": 8, "simplicity": 7, "discreteness": 8, "timeDedication": 9}
    }
  ],
  "personalizedInsights": ["Your high activity score and tubeless feature selection makes Omnipod ideal..."],
  "nextSteps": ["Schedule demo with Omnipod", "Check insurance coverage for tubeless pumps"],
  "confidence": 92
}`;

    return enhancedPrompt;
  }

  // boostPumpsWithSelectedFeatures method removed - AI handles feature preferences objectively

  private buildAIPrompt(sliderData: Record<string, number>): string {
    // This method is now deprecated in favor of buildEnhancedAIPrompt
    // Keeping for backwards compatibility but not used in main flow
    return this.buildEnhancedAIPrompt(sliderData, [], '');
  }

  private parseAIResponse(
    aiResponse: string,
    sliderData: Record<string, number>
  ): SliderRecommendation {
    try {
      // Handle Claude's markdown formatting - extract JSON from code blocks
      let cleanResponse = aiResponse;
      if (aiResponse.includes('```json')) {
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          cleanResponse = jsonMatch[1];
        }
      } else if (aiResponse.includes('```')) {
        const codeMatch = aiResponse.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          cleanResponse = codeMatch[1];
        }
      }

      const parsed = JSON.parse(cleanResponse);
      return {
        profileId: this.sessionId,
        topPumps: parsed.topPumps || [],
        personalizedInsights: parsed.personalizedInsights || [],
        nextSteps: parsed.nextSteps || [],
        confidence: parsed.confidence || 85,
      };
    } catch (error) {
      logError('sliderMCP', 'Error parsing AI response - no fallback available', { error });
      throw new Error('Failed to parse AI recommendation. Please try again.');
    }
  }

  private checkForWeightPreference(): boolean {
    try {
      // Check session storage for weight keywords
      const freeTextData = sessionStorage.getItem('pumpDriveFreeText');
      if (freeTextData) {
        const data = JSON.parse(freeTextData);
        const allText =
          `${data.currentSituation || ''} ${data.concerns || ''} ${data.priorities || ''}`.toLowerCase();

        const hasWeight =
          allText.includes('light') ||
          allText.includes('weight') ||
          allText.includes('2 oz') ||
          allText.includes('ounce') ||
          allText.includes('smallest') ||
          allText.includes('small') ||
          allText.includes('compact');

        if (hasWeight) {
          logDebug('sliderMCP', 'Debug message', {});
          return true;
        }
      }

      // Also check any other pump drive responses
      const responses =
        sessionStorage.getItem('pumpdrive_responses') ||
        sessionStorage.getItem('pumpDriveResponses');
      if (responses) {
        const data = JSON.parse(responses);
        const allResponses = Object.values(data).join(' ').toLowerCase();
        return (
          allResponses.includes('light') ||
          allResponses.includes('smallest') ||
          allResponses.includes('2 oz')
        );
      }

      return false;
    } catch {
      return false;
    }
  }

  // calculateMatchScore method removed - using pure AI recommendations only

  private generateFallbackRecommendation(sliderData: Record<string, number>): SliderRecommendation {
    // Fallback scoring removed - throw error to force AI usage
    throw new Error('Fallback scoring removed. AI recommendation service must be used.');
  }

  private async cacheRecommendation(
    profileHash: string,
    recommendation: SliderRecommendation
  ): Promise<void> {
    try {
      // Cache in localStorage
      const cacheKey = `slider_rec_${profileHash}`;
      const cacheData = {
        recommendation,
        createdAt: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));

      // In real MCP implementation, this would call the MCP server
      logDebug('sliderMCP', 'Debug message', {});
    } catch (error) {
      logError('sliderMCP', 'Error message', {});
      // Non-critical error, continue without caching
    }
  }

  getCacheStats() {
    // In real MCP implementation, this would query the MCP server
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('slider_rec_'));

    return {
      totalCached: cacheKeys.length,
      sessionId: this.sessionId,
      lastGenerated: Date.now(),
    };
  }

  clearAllCache(): void {
    logDebug('sliderMCP', 'Debug message', {});

    // Clear localStorage caches
    const cacheKeys = Object.keys(localStorage).filter(
      key => key.startsWith('slider_rec_') || key.startsWith('slider_profile_')
    );

    cacheKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    // Clear session storage assessment data
    sessionStorage.removeItem('pumpDriveSliders');
    sessionStorage.removeItem('pumpDriveSelectedFeatures');
    sessionStorage.removeItem('pumpDriveFreeText');
    sessionStorage.removeItem('selectedPumpFeatures');

    logInfo('sliderMCP', 'Info message', {});
  }
}

export const sliderMCPService = new SliderMCPService();
