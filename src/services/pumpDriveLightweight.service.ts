/**
 * Lightweight Category Processing for PumpDrive
 * Uses simpler extraction instead of full analysis per category
 * Reduces API calls and costs by 80%
 */

import { azureAIService } from './azureAI.service';

export class PumpDriveLightweightService {
  /**
   * Extract key facts from category response (no AI needed!)
   */
  extractCategoryFacts(category: string, transcript: string): any {
    const lower = transcript.toLowerCase();
    const facts: any = {};

    switch (category) {
      case 'cost':
        facts.hasInsurance = lower.includes('insurance') || lower.includes('coverage');
        facts.insuranceType = this.extractInsuranceType(lower);
        facts.costSensitive =
          lower.includes('budget') || lower.includes('afford') || lower.includes('expensive');
        facts.deductibleMet = lower.includes('deductible met') || lower.includes('already met');
        facts.prefersDME = lower.includes('dme') || lower.includes('durable medical');
        facts.prefersPharmacy = lower.includes('pharmacy') || lower.includes('prescription');
        break;

      case 'lifestyle':
        facts.active =
          lower.includes('active') || lower.includes('exercise') || lower.includes('gym');
        facts.sedentary =
          lower.includes('sedentary') || lower.includes('desk job') || lower.includes('not active');
        facts.travels = lower.includes('travel') || lower.includes('fly') || lower.includes('trip');
        facts.waterActivities =
          lower.includes('swim') || lower.includes('shower') || lower.includes('beach');
        facts.needsDiscrete =
          lower.includes('discrete') || lower.includes('hidden') || lower.includes('visible');
        facts.sports = this.extractSports(lower);
        break;

      case 'algorithm':
        facts.wantsAutomation =
          lower.includes('automat') || lower.includes('hands off') || lower.includes('auto');
        facts.wantsControl =
          lower.includes('control') || lower.includes('adjust') || lower.includes('manage');
        facts.tightControl =
          lower.includes('tight') || lower.includes('aggressive') || lower.includes('strict');
        facts.flexibleControl =
          lower.includes('flexible') || lower.includes('loose') || lower.includes('relaxed');
        facts.techSavvy =
          lower.includes('tech') || lower.includes('app') || lower.includes('smartphone');
        break;

      case 'easeToStart':
        facts.wantsSimple =
          lower.includes('simple') || lower.includes('easy') || lower.includes('straightforward');
        facts.wantsTraining =
          lower.includes('training') || lower.includes('learn') || lower.includes('teach');
        facts.hasSupport =
          lower.includes('family') || lower.includes('spouse') || lower.includes('help');
        facts.previousPump =
          lower.includes('previous') || lower.includes('before') || lower.includes('used to');
        break;

      case 'complexity':
        facts.wantsMinimal =
          lower.includes('minimal') || lower.includes('simple') || lower.includes('easy');
        facts.okWithComplex =
          lower.includes("don't mind") ||
          lower.includes('fine with') ||
          lower.includes('comfortable');
        facts.wantsTubeless =
          lower.includes('tubeless') || lower.includes('no tube') || lower.includes('omnipod');
        facts.okWithTubing = lower.includes('tubing ok') || lower.includes("don't mind tube");
        break;

      case 'support':
        facts.hasLocalSupport =
          lower.includes('local') || lower.includes('nearby') || lower.includes('clinic');
        facts.prefersOnline =
          lower.includes('online') || lower.includes('virtual') || lower.includes('remote');
        facts.needsTraining =
          lower.includes('training') || lower.includes('learn') || lower.includes('help');
        facts.selfSufficient =
          lower.includes('on my own') || lower.includes('independent') || lower.includes('self');
        break;
    }

    // Add the raw transcript for final AI processing
    facts.transcript = transcript;
    facts.category = category;

    return facts;
  }

  /**
   * Process all categories at once with a single AI call
   */
  async processBatchedCategories(allCategoryFacts: Record<string, any>): Promise<any> {
    // Build a comprehensive prompt with ALL data
    const prompt = `You are analyzing a patient's complete insulin pump preferences across 6 categories.

PATIENT PROFILE:
${Object.entries(allCategoryFacts)
  .map(
    ([category, facts]) =>
      `${category.toUpperCase()}:
  - Key Facts: ${JSON.stringify(facts, null, 2)}
  - Original Response: "${facts.transcript}"`
  )
  .join('\n\n')}

TASK: Generate a comprehensive pump recommendation considering ALL factors together.

Recommend the TOP 3 insulin pumps with detailed scoring:
1. Consider how different factors interact (e.g., travel + water activities = need waterproof)
2. Identify conflicts and how to resolve them
3. Weight priorities based on emphasis in responses
4. Consider the full patient journey

Return JSON:
{
  "topPump": {
    "name": "Pump name",
    "score": 95,
    "keyReasons": ["Reason 1", "Reason 2", "Reason 3"],
    "perfectFor": "One sentence why this is THE best choice"
  },
  "secondChoice": {
    "name": "Pump name", 
    "score": 88,
    "keyReasons": ["Reason 1", "Reason 2"],
    "betterIf": "What would make this the top choice instead"
  },
  "thirdChoice": {
    "name": "Pump name",
    "score": 82,
    "keyReasons": ["Reason 1", "Reason 2"],
    "consider": "Who should consider this option"
  },
  "patientSummary": {
    "primaryNeeds": ["Need 1", "Need 2", "Need 3"],
    "lifestyle": "One sentence lifestyle summary",
    "dealBreakers": ["Any absolute requirements"],
    "tradeoffs": ["Tradeoff they seem willing to make"]
  },
  "decisionFactors": [
    {
      "factor": "Cost vs Features",
      "recommendation": "Your insurance covers both well, so focus on features"
    }
  ]
}`;

    // This is the ONLY AI call - using Azure AI
    const response = await azureAIService.generateResponse('', null, 'custom', null, prompt);
    return JSON.parse(response);
  }

  /**
   * Helper to extract insurance type
   */
  private extractInsuranceType(text: string): string {
    if (text.includes('united')) return 'united_healthcare';
    if (text.includes('blue cross') || text.includes('bcbs')) return 'blue_cross';
    if (text.includes('aetna')) return 'aetna';
    if (text.includes('cigna')) return 'cigna';
    if (text.includes('kaiser')) return 'kaiser';
    if (text.includes('medicare')) return 'medicare';
    if (text.includes('medicaid')) return 'medicaid';
    return 'other';
  }

  /**
   * Helper to extract sports/activities
   */
  private extractSports(text: string): string[] {
    const sports = [];
    if (text.includes('swim')) sports.push('swimming');
    if (text.includes('run') || text.includes('jog')) sports.push('running');
    if (text.includes('bike') || text.includes('cycl')) sports.push('cycling');
    if (text.includes('gym') || text.includes('weight')) sports.push('gym');
    if (text.includes('yoga')) sports.push('yoga');
    if (text.includes('golf')) sports.push('golf');
    if (text.includes('tennis')) sports.push('tennis');
    if (text.includes('basketball')) sports.push('basketball');
    return sports;
  }
}

export const pumpDriveLightweight = new PumpDriveLightweightService();

/**
 * New flow that reduces API calls from 7 to 1
 */
export async function processCompletePumpSession(
  categoryResponses: Record<string, { transcript: string; checkedQuestions: string[] }>
): Promise<any> {
  // Step 1: Extract facts from each category (no AI needed)
  const allFacts: Record<string, any> = {};

  for (const [category, response] of Object.entries(categoryResponses)) {
    allFacts[category] = pumpDriveLightweight.extractCategoryFacts(category, response.transcript);
  }

  // Step 2: Make ONE AI call with all data
  const finalRecommendation = await pumpDriveLightweight.processBatchedCategories(allFacts);

  return finalRecommendation;
}

/**
 * Alternative: Use cheap model for extraction, expensive for final
 */
export async function hybridProcessing(
  categoryResponses: Record<string, { transcript: string; checkedQuestions: string[] }>
): Promise<any> {
  // Step 1: Use Claude Haiku for quick extraction (6 fast, cheap calls)
  const extractions = await Promise.all(
    Object.entries(categoryResponses).map(async ([category, response]) => {
      // Use a cheaper model for extraction
      const prompt = `Extract key facts from this ${category} response: ${response.transcript}
      Return JSON with relevant boolean flags and key phrases only.`;

      // This could use Azure AI
      const extracted = await azureAIService.generateResponse('', null, 'custom', null, prompt);
      return { category, facts: JSON.parse(extracted) };
    })
  );

  // Step 2: Use Claude Opus 4.1 for final analysis (1 expensive call)
  const finalPrompt = `Based on these extracted patient preferences, recommend the best insulin pump...
  ${JSON.stringify(extractions)}`;

  const finalRecommendation = await azureAIService.generateResponse(
    '',
    null,
    'custom',
    null,
    finalPrompt
  );

  return JSON.parse(finalRecommendation);
}
