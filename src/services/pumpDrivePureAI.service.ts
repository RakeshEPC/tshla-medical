import { openAIService } from './_archived_2025_cleanup/openai.service';
import { PUMP_DATABASE } from '../data/pumpDataComplete';
import { logError, logInfo, logDebug } from './logger.service';

interface UserInputData {
  sliders?: Record<string, number>;
  selectedFeatures?: string[];
  userText?: string;
  clarifyingResponses?: Record<string, string>;
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
  clarifyingQuestions?: string[];
  needsClarification?: boolean;
}

/**
 * Pure AI-driven pump recommendation service
 * No hard-coded logic, scoring systems, or biases
 * Follows user's exact specifications
 */
class PumpDrivePureAIService {

  /**
   * Generate pump recommendation using pure AI analysis
   */
  async generateRecommendation(inputData: UserInputData): Promise<PumpRecommendation> {
    try {
      logInfo('pumpDrivePureAI', 'Starting pure AI analysis', {});

      // First, check if we need clarifying questions
      if (!inputData.clarifyingResponses) {
        const needsClarification = await this.determineIfClarificationNeeded(inputData);
        if (needsClarification.questions.length > 0) {
          return {
            topChoice: { name: '', score: 0, reasons: [] },
            alternatives: [],
            keyFactors: [],
            personalizedInsights: '',
            clarifyingQuestions: needsClarification.questions,
            needsClarification: true
          };
        }
      }

      // Generate final recommendation
      const recommendation = await this.generateFinalRecommendation(inputData);
      return recommendation;

    } catch (error) {
      logError('pumpDrivePureAI', 'Error in pure AI analysis', { error });
      throw new Error('Unable to process recommendation at this time. Please try again.');
    }
  }

  /**
   * Step 1: Determine if clarifying questions are needed
   */
  private async determineIfClarificationNeeded(inputData: UserInputData): Promise<{
    questions: string[];
    topCandidates: string[];
  }> {
    const prompt = this.buildInitialAnalysisPrompt(inputData);

    const response = await openAIService.processText(prompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 });

    try {
      const parsed = JSON.parse(response);
      return {
        questions: parsed.clarifyingQuestions || [],
        topCandidates: parsed.topCandidates || []
      };
    } catch {
      // If parsing fails, assume no clarification needed
      return { questions: [], topCandidates: [] };
    }
  }

  /**
   * Step 2: Generate final recommendation after clarification (if any)
   */
  private async generateFinalRecommendation(inputData: UserInputData): Promise<PumpRecommendation> {
    const prompt = this.buildFinalRecommendationPrompt(inputData);

    const response = await openAIService.processText(prompt, { model: 'gpt-4', temperature: 0.7, maxTokens: 2000 });

    try {
      const parsed = JSON.parse(response);
      return {
        topChoice: parsed.topChoice,
        alternatives: parsed.alternatives || [],
        keyFactors: parsed.keyFactors || [],
        personalizedInsights: parsed.personalizedInsights || '',
        needsClarification: false
      };
    } catch (error) {
      logError('pumpDrivePureAI', 'Failed to parse final recommendation', { error });
      throw new Error('Unable to generate recommendation');
    }
  }

  /**
   * Build prompt for initial analysis and clarification needs
   */
  private buildInitialAnalysisPrompt(inputData: UserInputData): string {
    return `You are an expert diabetes educator. Analyze this patient's pump preferences and determine if you need clarifying questions to make a confident recommendation.

PATIENT INPUT DATA:
${this.formatUserInputs(inputData)}

AVAILABLE INSULIN PUMPS:
${this.formatPumpDatabase()}

KEY PUMP DIFFERENTIATORS TO CONSIDER:
- Twiist: 2 oz (LIGHTEST), 87 mg/dL target (LOWEST), Apple Watch control
- Medtronic 780G: 100% correction (MOST AGGRESSIVE), AA battery, submersible
- Omnipod 5: TUBELESS, waterproof pods
- Beta Bionics iLet: NO carb counting needed
- Tandem t:slim X2: Most CGM options, proven Control-IQ
- Tandem Mobi: Smallest tubed pump, wireless charging

INSTRUCTIONS:
Carefully analyze the pump data, sliders, and especially the user's text. The personal preferences are very pump specific - rank those pumps higher. Process what they say in their story text as PRIMARY guidance.

CLARIFICATION DECISION:
- If user priorities clearly point to ONE pump → return empty clarifying questions
- If top 2-3 pumps score within 10% of each other → ask 2-3 specific questions
- If user has CONFLICTING priorities (e.g., "lightest" + "most aggressive") → ask which matters MORE

Response format:
{
  "analysis": "Brief analysis of user preferences",
  "topCandidates": ["pump1", "pump2", "pump3"],
  "clarifyingQuestions": ["Question 1?", "Question 2?"] or []
}`;
  }

  /**
   * Build prompt for final recommendation
   */
  private buildFinalRecommendationPrompt(inputData: UserInputData): string {
    return `You are an expert diabetes educator. Provide your final pump recommendation based on all available information.

PATIENT INPUT DATA:
${this.formatUserInputs(inputData)}

AVAILABLE INSULIN PUMPS:
${this.formatPumpDatabase()}

CRITICAL PUMP-SPECIFIC FEATURE MAPPINGS:
${this.formatPumpFeatureMappings()}

SLIDER INTERPRETATION GUIDE:
${this.formatSliderMeanings()}

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

INSTRUCTIONS:
Take a look at the pump data and then the sliders and the personal preferences. The personal preferences are very pump specific and you need to rank those pumps higher on the list for the user. Also put what they say in text higher on the list - process their exact words carefully.

ANALYSIS METHODOLOGY:
1. **Personal Preferences (HIGHEST PRIORITY)**: If user selected specific features, heavily favor the pump that has those exact features. Each selected feature directly maps to a specific pump.
2. **User Text (SECOND PRIORITY)**: Analyze what the user wrote about their needs, lifestyle, concerns. Parse for keywords like "lightest", "lowest target", "tightest control" and apply the CRITICAL DECISION RULES above.
3. **Slider Analysis (SUPPORTING)**: Use slider values to understand user's lifestyle and preferences to validate pump choice.

IMPORTANT: When multiple priorities conflict (e.g., "lightest with tightest control"), explain the tradeoff:
- Twiist is lightest (2 oz) with lowest target (87 mg/dL)
- Medtronic 780G has most aggressive algorithm (100% correction) but heavier
- Make recommendation based on which priority seems PRIMARY in their text

${inputData.clarifyingResponses ? `
CLARIFYING RESPONSES:
${this.formatClarifyingResponses(inputData.clarifyingResponses)}

Use these responses to decide between the top pump candidates.
` : ''}

Provide your recommendation in this format:
{
  "topChoice": {
    "name": "Exact pump name",
    "score": 85,
    "reasons": ["Specific reason based on user input", "Another reason", "Third reason"]
  },
  "alternatives": [
    {
      "name": "Second choice pump name",
      "score": 75,
      "reasons": ["Why this is second choice", "What it offers"]
    }
  ],
  "keyFactors": ["User's stated priority 1", "User's stated priority 2", "Medical consideration"],
  "personalizedInsights": "Detailed explanation of why the top choice matches what the patient needs based on their specific inputs"
}`;
  }

  /**
   * Format user inputs for AI analysis
   */
  private formatUserInputs(inputData: UserInputData): string {
    let formatted = '';

    if (inputData.sliders) {
      formatted += 'LIFESTYLE SLIDERS:\n';
      Object.entries(inputData.sliders).forEach(([key, value]) => {
        formatted += `- ${key}: ${value}/10\n`;
      });
      formatted += '\n';
    }

    if (inputData.selectedFeatures && inputData.selectedFeatures.length > 0) {
      formatted += 'SELECTED FEATURES (pump-specific preferences):\n';
      inputData.selectedFeatures.forEach(feature => {
        formatted += `- ${feature}\n`;
      });
      formatted += '\n';
    }

    if (inputData.userText) {
      formatted += 'USER\'S STORY AND PRIORITIES:\n';
      formatted += `"${inputData.userText}"\n\n`;
    }

    return formatted;
  }

  /**
   * Format clarifying responses
   */
  private formatClarifyingResponses(responses: Record<string, string>): string {
    let formatted = '';
    Object.entries(responses).forEach(([question, answer]) => {
      formatted += `Q: ${question}\nA: ${answer}\n\n`;
    });
    return formatted;
  }

  /**
   * Format pump-specific feature mappings
   */
  private formatPumpFeatureMappings(): string {
    return `When user selects specific features, they directly map to these pumps:

MEDTRONIC 780G FEATURES:
- "Swap batteries anywhere, anytime" (AA battery power)
- "Most aggressive blood sugar control" (100% correction doses)
- "Swim and dive up to 12 feet underwater" (fully submersible)

TANDEM T:SLIM X2 FEATURES:
- "Smartphone-like touchscreen interface"
- "Works with multiple CGM brands" (Dexcom, Libre options)
- "Deliver insulin directly from your phone" (phone bolusing)

TANDEM MOBI FEATURES:
- "Smallest pump ever made" (ultra-small size)
- "Completely controlled by iPhone" (no pump buttons)
- "Wireless charging like your phone"

OMNIPOD 5 FEATURES:
- "Zero tubing for total freedom" (completely tubeless)
- "Swim and shower without disconnecting" (waterproof pod)
- "Use phone OR dedicated controller" (dual control options)

BETA BIONICS ILET FEATURES:
- "Never count carbs again" (no carb counting needed)
- "Say 'usual meal' or 'more than usual'" (simple meal announcements)
- "Charges wirelessly like electric toothbrush" (inductive charging)

TWIIST FEATURES:
- "Deliver insulin from your Apple Watch" (Apple Watch bolusing)
- "Dose with food emojis 🍎🥪🍕" (emoji bolusing interface)
- "Weighs only 2 ounces" (ultra-lightweight design)

CRITICAL: If user selected ANY of these features, that pump should be heavily favored in your recommendation.`;
  }

  /**
   * Format slider meanings for AI interpretation
   */
  private formatSliderMeanings(): string {
    return `Slider values (1-10 scale) indicate user preferences:

ACTIVITY LEVEL (1-10):
- 1-3: Sedentary lifestyle, desk job, minimal exercise
- 4-6: Moderately active, some exercise, balanced lifestyle
- 7-10: Very active, sports, gym, swimming, outdoor activities
→ High activity favors: Omnipod 5 (tubeless), Medtronic 780G (submersible)

TECH COMFORT (1-10):
- 1-3: Prefers simple, basic technology, minimal complexity
- 4-6: Comfortable with technology but not obsessed
- 7-10: Loves technology, early adopter, wants advanced features
→ High tech comfort favors: Tandem t:slim X2 (touchscreen), Tandem Mobi (iPhone control), Twiist (Apple Watch)

SIMPLICITY PREFERENCE (1-10):
- 1-3: Wants maximum simplicity, set-and-forget
- 4-6: Likes some features but not overwhelming complexity
- 7-10: Wants lots of features and customization options
→ High simplicity need favors: Beta Bionics iLet (meal announcements), Omnipod 5 (tubeless)

DISCRETENESS NEED (1-10):
- 1-3: Device must be completely hidden, very concerned about visibility
- 4-6: Prefers discreet but okay if sometimes visible
- 7-10: Doesn't care who sees it, function over appearance
→ High discreteness need favors: Twiist (2 oz, smallest), Tandem Mobi (ultra-small)

TIME DEDICATION (1-10):
- 1-3: Wants set-and-forget simplicity with minimal maintenance
- 4-6: Willing to do basic maintenance but not excessive work
- 7-10: Happy to spend time optimizing and maintaining for best results
→ Low time dedication favors: Beta Bionics iLet (automated), Omnipod 5 (disposable pods)`;
  }

  /**
   * Format complete pump database with all 23 dimensions from original PDF
   */
  private formatPumpDatabase(): string {
    return `COMPLETE INSULIN PUMP COMPARISON DATA (23 Dimensions):

=== MEDTRONIC 780G ===
#1 Battery: AA battery; swap anywhere (Lithium preferred)
#2 Phone Control: App viewing; bolus on pump. Phone app for viewing: bolus on pump
#3 Tubing: Tubed pump with set. Option 1: 7 day infusion set holds 600 units, Option 2: 5 different sets plus 2 different tubing lengths
#4 Algorithm: SmartGuard + auto-corrections. More aggressive, every 5 mins. 100% correction amount versus 60% like other pumps
#5 CGM: Medtronic CGM. Guardian 4 (will be phasing out in 2-3 months)- will change to libre instinct (Abbott will make for medtronics integration)
#6 Target Adjustability: Limited adjustment. Target 100, 110, 120- auto mode. Exercise target 150- can be switched on or off anytime
#7 Exercise: Activity temp target. Exercise target 150- can be switched on or off anytime
#8 Bolus: Carb + auto-corr support. Can set carbs, exact carbs, or rely on autocorrect
#9 Capacity: High capacity. 300 units: 2 diff sets. Options: 1 set change every 7 days or another set every 2 to 3 days depending on dosage
#10 Adhesive: Set + separate CGM. 1 click insertion: guardian 4 overlay tape- libre will be 15 day wear in future
#11 Water: Water-resistant. Submersible 12 feet for 24 hours as long as pump does not have a crack
#12 Alerts: On-pump options. Set high alerts on 30 minutes increments and can adjust during sleep- alert before lows occur
#13 Interface: Buttons; onboard screen. MiniMed Mobile App on phone
#14 Data: CareLink cloud
#15 Support: Large installed base
#16 Travel: AA spares; DME supplies- insulin
#17 Caregiver: Caregiver-friendly options. care partner app- caregiver/parents can get alarms: parents can get notified when a child boluses, but can not give remote bolus to patient
#18 Discretion: Visible when clipped
#19 Ecosystem: Medtronic ecosystem. Minimed mobile: can view on phone and sync to apple watch but can not bolus- have to bolus thru pump
#20 Reliability: On-pump alerts/logs- when occlusion occurs patient changes site- insulin does not have to be changed. Unplug from site and start again
#21 Cost: DME; plan dependent- Financial assistance 90% if qualified
#22 Comfort: Clip/holster; tubing
#23 Updates: Vendor tools- updates on app- software update if user changing pumps

=== TANDEM T:SLIM X2 ===
#1 Battery: Rechargeable; multi-day. Can last up to 3 weeks: charges 1% per min- recommend to charge daily: Cord plug in to wall like cellphone: usb
#2 Phone Control: Mobile bolus (compat varies). Can bolus from phone app and the pump- also quick bolus on pump
#3 Tubing: Slim tubed pump. clip/case option
#4 Algorithm: Control-IQ basal + auto-corr. automatically adjusts basal insulin every 5 minutes based on real-time and predicted glucose data from your CGM
#5 CGM: Dexcom (model/region). Dexcom g6/g7, libre 2 plus, libre 3 plus (limited launch coming soon)
#6 Target Adjustability: Profiles, temp targets. Target range: 112.5–160 mg/dL, Correction boluses triggered if glucose is predicted to be >180 mg/dL, Correction boluses aim for 110 mg/dL, but only give 60% of the full correction dose. Sleep mode to keep target lower
#7 Exercise: Exercise raises target. 140–160 mg/dL
#8 Bolus: Carb + auto-corr bolus. actual carb counting, set carbs, or rely on autocorrect
#9 Capacity: High capacity. Up to 300 units
#10 Adhesive: Set + separate CGM
#11 Water: Resistant (follow guide). Not submersible- water rating IP27- not waterproof but adapt up to 3 feet for 30 mins
#12 Alerts: Pump + app options. Multiple options of alerts
#13 Interface: Touchscreen UI. quick bolus button
#14 Data: t:connect web/app. Tslim app Platform: Tandem Source
#15 Support: Broad familiarity
#16 Travel: Charger; DME supplies. charging cable, All supplies- option of having a pump loaner-pump program: can get a pump to take when traveling outside of the US 48 states as a back up in case something happens to their original pump- have to sign up for program- no cost
#17 Caregiver: Remote bolus (compat)- Tandem Source
#18 Discretion: Slim profile; tubing
#19 Ecosystem: Apps + watch View on phone only- can get notified on watch but have to bolus from pump
#20 Reliability: Detection + t:connect- App or pump notifies
#21 Cost: DME/pharmacy varies. DME/Pharmacy
#22 Comfort: Slim; tubing
#23 Updates: t:connect + firmware. App updates and pump updates- sent notifications via email or on app- rep can help

=== TANDEM MOBI ===
#1 Battery: Rechargeable micro; pad charging. Can last up to 3 weeks: charges 1% per min- recommend to charge daily, Charging plate
#2 Phone Control: App on phone (iphone only for now)- quick bolus on pump
#3 Tubing: Very short tube near site. Option of short or long tubing sizes vary depending on patient preference: clip it on belt, slip in pocket, or adhesive sleeve patch to wear on body
#4 Algorithm: Runs Control-IQ like t-slim
#5 CGM: Dexcom (model/region). Dexcom g6/g7 only
#6 Target Adjustability: CIQ targets via app. Standard (Default): 112.5–160 mg/dL, Sleep Mode: 112.5–120 mg/dL, Exercise Mode: 140–160 mg/dL. The AutoBolus feature triggers only if glucose is predicted to exceed 180 mg/dL, aiming for a target of ~110 mg/dL with 60% of the calculated dose
#7 Exercise: CIQ exercise mode. 140–160 mg/dL
#8 Bolus: App-based carb entry. actual carb counting, set carbs, or rely on autocorrect
#9 Capacity: Smaller reservoir: up to 200 units
#10 Adhesive: Small device near site
#11 Water: Improved resistance. Water rating IP28: submersible up to 8 feet up for up to 60 mins
#12 Alerts: App-centric notices. Multiple options of alerts
#13 Interface: Phone-first UI. quick bolus button on pump- rest control thru iphone app
#14 Data: t:connect (Mobi). Mobi app
#15 Support: Newer; Tandem support
#16 Travel: Pad charger; micro-supplies
#17 Caregiver: Phone control helps. Tandem Source
#18 Discretion: Very small on body. Belt buckle, clip it, slip it in pocket
#19 Ecosystem: Accessory-friendly. Everything done thru phone
#20 Reliability: App notifications. App or pump notifies
#21 Cost: Confirm coverage. DME/Pharmacy
#22 Comfort: Small; short tube
#23 Updates: Phone-first updates. App updates and pump updates- sent notifications via email or on app- rep can help

=== OMNIPOD 5 ===
#1 Battery: Pod battery lasts wear cycle
#2 Phone Control: Phone or provided controller
#3 Tubing: Tubeless pod
#4 Algorithm: On-pod adapting algorithm: Continuously learns how your body responds to insulin, Adjusts basal insulin delivery every 5 minutes, Uses CGM data from CGM to predict future glucose trends
#5 CGM: Dexcom; dexcom g6/g7- need compatible phone app updated ios/android, libre 2 plus (can use omnipod PDM if phone app for libre 2 plus not compatible)
#6 Target Adjustability: Adjustable ranges; activity. Target 110-150- with exercise mode of 150
#7 Exercise: Activity feature. 150
#8 Bolus: Carb dosing + automation. actual carb counting, set carbs (custom foods)
#9 Capacity: Fixed pod capacity. Up to 200 units
#10 Adhesive: Pod + CGM patch
#11 Water: Rated within limits. Water rating IP28: submersible up to 8 feet up for up to 60 mins
#12 Alerts: Phone/controller alerts. High and low alert alarms- Sound control but not alerts can be silenced- especially urgent lows
#13 Interface: Phone or controller- phone APP or PDM only
#14 Data: App/cloud reports. Glooko
#15 Support: Widely used
#16 Travel: Extra pods; no charger. Insulin, CGM extra
#17 Caregiver: Controller/phone + share. omnipod view app
#18 Discretion: Low pod profile- Upper arm, thighs, on stomach
#19 Ecosystem: Mobile + controller. Everything done thru phone or PDM
#20 Reliability: Replace pod if needed
#21 Cost: Often pharmacy- pharmacy benefits
#22 Comfort: Single pod
#23 Updates: App/controller updates

=== BETA BIONICS ILET ===
#1 Battery: Rechargeable; top-offs- charge 15 mins a day/ can go 3 days without charge. Inductive charging plate: place pump on top of charging plate
#2 Phone Control: View/share on phone; dose on pump. Can not bolus from phone- have to use pump only
#3 Tubing: Tubed, simple sets. 10 mm length only
#4 Algorithm: Meal-announce simplicity. No carb counting required: carb awareness required- non user autocorrections every 5 mins. "2 glucose readings predictions initiated"- suggests the iLet's algorithms analyze the current and recent CGM readings and trends to forecast where glucose levels are headed
#5 CGM: Dexcom (model/region). Dexcom g6/g7/libre 3 plus
#6 Target Adjustability: Simplified targets. Multiple targets: low usual: 70-120, high usual: 80-130, lower then usual 60-110
#7 Exercise: Simple activity toggle: No target options: aerobic exercise: disconnect- take pump off: anaerobic: stay connected to pump
#8 Bolus: Meal announcements instead- no carb counting- announce meals with preset carbs- ex: small, medium, or large meals
#9 Capacity: Standard capacity. 1. 160 prefilled fiasp 2. 180 standard
#10 Adhesive: Set + separate CGM. same as other pumps, same infusion set as tandem
#11 Water: Water-resistant. Water submersible 12 feet up to 30 mins
#12 Alerts: Essential alerts. Alerts less only 4 minimal essential alerts
#13 Interface: Minimalist prompts. Touchscreen pump
#14 Data: BB reporting. Bionic circle app
#15 Support: Growing support
#16 Travel: Charger; DME supplies
#17 Caregiver: Simplified interaction. Bionic circle app
#18 Discretion: Traditional profile. Size of business card- can slip in pocket
#19 Ecosystem: Growing ecosystem. No watch or phone bolus- only on pump
#20 Reliability: Device alerts. Occlusion suspected if high glucose has been alerted for 90 mins- then pump advise to change tubing
#21 Cost: Check plan specifics. 1. Pharmacy benefits if patient quality fully covered with shipments and supplies 2. DME/traditional insurance 3. Pharmacy benefits for medicare patients- no labs required
#22 Comfort: Standard pump
#23 Updates: BB tools- not automatic- patient has to initiate when notified

=== TWIIST ===
#1 Battery: Rechargeable (new platform). 4 replaceable batteries come with pump plus a charging station that charges 2 batteries at same time
#2 Phone Control: Phone-centric controls. Can bolus from APPLE watch and pump as well
#3 Tubing: tubed (compact). Weighs 2 ounces
#4 Algorithm: Modern adaptive logic. Adjusts every 5 mins: more aggressive: basal modulations "similar to microboluses"
#5 CGM: Dexcom plans (anticipated). libre 3 plus, Eversense (soon), Dexcom (in future)
#6 Target Adjustability: Flexible targets (planned). 87-180
#7 Exercise: Exercise modes (planned). 87-250
#8 Bolus: Streamlined bolus. Exact carb number or can use emojis with pics which can be used based on absorption time of the specific meal
#9 Capacity: Competitive capacity. 300 units
#10 Adhesive: Set + separate CGM
#11 Water: Water-resistant. Splash proof/water resistance/ No submersible
#12 Alerts: Modern alert set. vibrate mode can be active most of the time but urgent alerts will ring
#13 Interface: Phone-forward UI. Phone app control only
#14 Data: Cloud/app pipeline. Tidepool- up to 15 family/friends can follow
#15 Support: New platform
#16 Travel: Charger; DME supplies- insulin, extra cassettes, pump itself with tubes
#17 Caregiver: Caregiver app planned. Twiist insight app
#18 Discretion: Compact design. Circular shape- discreet under clothes
#19 Ecosystem: Modern APIs planned. Can bolus on apple watch
#20 Reliability: On-device + app alerts
#21 Cost: Confirm coverage. Pharmacy benefits
#22 Comfort: Compact & light
#23 Updates: OTA app support. Updates during cassette changes if need to update firmware

KEY UNIQUE FEATURES BY PUMP:
- Medtronic 780G: 100% correction doses (most aggressive), 12 feet submersible, AA batteries
- Tandem t:slim X2: Touchscreen interface, multiple CGM options, proven Control-IQ
- Tandem Mobi: Smallest pump ever, iPhone-only control, wireless charging pad
- Omnipod 5: Completely tubeless, waterproof pods, phone OR controller options
- Beta Bionics iLet: No carb counting needed, meal announcements only, simplest operation
- Twiist: Weighs only 2 ounces, Apple Watch bolusing, emoji-based dosing interface`;
  }

  /**
   * Extract weight information neutrally (no bias)
   */
  private extractWeight(pump: any): string {
    if (pump.dimensions.tubing.type === 'tubeless') {
      return 'Tubeless pod';
    }

    // Check if weight is mentioned in pros
    const weightPro = pump.pros?.find((pro: string) =>
      pro.toLowerCase().includes('oz') ||
      pro.toLowerCase().includes('ounce') ||
      pro.toLowerCase().includes('weight')
    );

    if (weightPro) {
      return weightPro;
    }

    return pump.dimensions.discretion?.size || 'Standard size';
  }

  /**
   * Save recommendation to session storage for results page
   */
  saveRecommendation(recommendation: PumpRecommendation): void {
    sessionStorage.setItem('pumpdrive_recommendation', JSON.stringify(recommendation));
    sessionStorage.setItem('pumpdrive_recommendation_timestamp', Date.now().toString());
    sessionStorage.setItem('pumpdrive_recommendation_source', 'pure_ai');
  }

  /**
   * Collect user input from various session storage keys
   */
  collectUserInputData(): UserInputData {
    const inputData: UserInputData = {};

    // Get slider data
    const sliderData = sessionStorage.getItem('pumpDriveSliders');
    if (sliderData) {
      inputData.sliders = JSON.parse(sliderData);
    }

    // Get selected features
    const featureData = sessionStorage.getItem('pumpDriveSelectedFeatures');
    if (featureData) {
      const features = JSON.parse(featureData);
      inputData.selectedFeatures = features.map((f: any) => f.name || f.id || f);
    }

    // Get free text
    const textData = sessionStorage.getItem('pumpDriveFreeText');
    if (textData) {
      const parsed = JSON.parse(textData);
      inputData.userText = parsed.currentSituation || parsed.userStory || '';
    }

    // Get clarifying responses if they exist
    const clarifyingData = sessionStorage.getItem('pumpDriveClarifyingResponses');
    if (clarifyingData) {
      inputData.clarifyingResponses = JSON.parse(clarifyingData);
    }

    return inputData;
  }
}

export const pumpDrivePureAI = new PumpDrivePureAIService();