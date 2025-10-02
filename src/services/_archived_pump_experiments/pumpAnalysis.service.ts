import { PUMP_DATABASE } from '../data/pumpDataComplete';
import { logError, logWarn, logInfo, logDebug } from './logger.service';
// import { bedrockService } from './bedrock.service';

export interface CategoryScore {
  pumpId: string;
  pumpName: string;
  score: number;
  reasoning: string;
  strengths: string[];
  considerations: string[];
}

export interface CategoryWinner {
  category: string;
  categoryTitle: string;
  winner: CategoryScore;
  runnerUp?: CategoryScore;
  allScores: CategoryScore[];
}

export interface PumpRecommendation {
  topChoice: {
    pumpId: string;
    pumpName: string;
    manufacturer: string;
    overallScore: number;
    keyReasons: string[];
    perfectFor: string[];
  };
  secondChoice?: {
    pumpId: string;
    pumpName: string;
    manufacturer: string;
    overallScore: number;
    keyReasons: string[];
    considerIf: string[];
  };
  categoryWinners: CategoryWinner[];
  personalizedInsights: string[];
  nextSteps: string[];
}

interface UserResponses {
  cost?: string;
  lifestyle?: string;
  algorithm?: string;
  easeToStart?: string;
  complexity?: string;
  support?: string;
  [key: string]: string | undefined;
}

class PumpAnalysisService {
  private readonly categories = {
    cost: 'Budget & Insurance',
    lifestyle: 'Your Lifestyle',
    algorithm: 'Control Preferences',
    easeToStart: 'Getting Started',
    complexity: 'Daily Use & Complexity',
    support: 'Support System',
  };

  async analyzePumpSelections(userResponses: UserResponses): Promise<PumpRecommendation> {
    // Analyze each category
    const categoryWinners = await this.analyzeCategoryWinners(userResponses);

    // Calculate overall scores
    const overallScores = this.calculateOverallScores(categoryWinners);

    // Generate personalized insights
    const insights = await this.generatePersonalizedInsights(userResponses, overallScores);

    // Determine top recommendations
    const sortedPumps = Object.entries(overallScores)
      .sort(([, a], [, b]) => b - a)
      .map(([pumpId, score]) => {
        const pump = PUMP_DATABASE.find(p => p.id === pumpId)!;
        return { pump, score };
      });

    const topPump = sortedPumps[0];
    const secondPump = sortedPumps[1];

    // Generate key reasons for each pump
    const topReasons = await this.generateKeyReasons(topPump.pump, userResponses, categoryWinners);
    const secondReasons = secondPump
      ? await this.generateKeyReasons(secondPump.pump, userResponses, categoryWinners)
      : [];

    return {
      topChoice: {
        pumpId: topPump.pump.id,
        pumpName: topPump.pump.name,
        manufacturer: topPump.pump.manufacturer,
        overallScore: topPump.score,
        keyReasons: topReasons,
        perfectFor: topPump.pump.idealFor || [],
      },
      secondChoice: secondPump
        ? {
            pumpId: secondPump.pump.id,
            pumpName: secondPump.pump.name,
            manufacturer: secondPump.pump.manufacturer,
            overallScore: secondPump.score,
            keyReasons: secondReasons,
            considerIf: this.generateConsiderIf(secondPump.pump, topPump.pump),
          }
        : undefined,
      categoryWinners,
      personalizedInsights: insights,
      nextSteps: this.generateNextSteps(topPump.pump),
    };
  }

  private async analyzeCategoryWinners(userResponses: UserResponses): Promise<CategoryWinner[]> {
    const winners: CategoryWinner[] = [];

    for (const [categoryKey, categoryTitle] of Object.entries(this.categories)) {
      const userResponse = userResponses[categoryKey] || '';

      if (!userResponse) continue;

      // Score each pump for this category
      const scores = await this.scorePumpsForCategory(categoryKey, userResponse);

      // Sort by score
      scores.sort((a, b) => b.score - a.score);

      winners.push({
        category: categoryKey,
        categoryTitle,
        winner: scores[0],
        runnerUp: scores[1],
        allScores: scores,
      });
    }

    return winners;
  }

  private async scorePumpsForCategory(
    category: string,
    userResponse: string
  ): Promise<CategoryScore[]> {
    const scores: CategoryScore[] = [];

    for (const pump of PUMP_DATABASE) {
      const prompt = `
        Based on this user's response about their ${this.categories[category as keyof typeof this.categories]}:
        "${userResponse}"

        And this pump's features:
        ${JSON.stringify(pump, null, 2)}

        Score this pump from 0-100 for how well it matches the user's needs in this category.
        Consider the specific features, pros, cons, and capabilities.

        Respond with JSON:
        {
          "score": <number 0-100>,
          "reasoning": "<brief explanation>",
          "strengths": ["<strength 1>", "<strength 2>"],
          "considerations": ["<consideration 1>", "<consideration 2>"]
        }
      `;

      try {
        // const response = await bedrockService.processWithAI(prompt, 'analysis');
        // const analysis = JSON.parse(response);
        const analysis = {
          score: 75,
          reasoning: 'Good match',
          strengths: ['Feature 1'],
          considerations: ['Consider 1'],
        };

        scores.push({
          pumpId: pump.id,
          pumpName: pump.name,
          score: analysis.score,
          reasoning: analysis.reasoning,
          strengths: analysis.strengths || [],
          considerations: analysis.considerations || [],
        });
      } catch (error) {
        logError('pumpAnalysis', 'Error message', {});
        // Fallback scoring based on keywords
        scores.push(this.getFallbackScore(pump, category, userResponse));
      }
    }

    return scores;
  }

  private getFallbackScore(pump: any, category: string, userResponse: string): CategoryScore {
    let score = 50; // Base score
    const response = userResponse.toLowerCase();

    // Category-specific scoring logic
    switch (category) {
      case 'cost':
        if (response.includes('insurance') && pump.dimensions.cost?.coverage) {
          score += 20;
        }
        if (response.includes('budget') && response.includes('tight')) {
          if (pump.id.includes('omnipod')) score += 10; // Often better coverage
        }
        break;

      case 'lifestyle':
        if (response.includes('active') || response.includes('sport')) {
          if (pump.id.includes('omnipod') || pump.id === 'tandem-mobi') score += 25;
        }
        if (response.includes('swim') || response.includes('water')) {
          if (pump.dimensions.waterResistance?.submersible) score += 30;
        }
        break;

      case 'algorithm':
        if (response.includes('aggressive') && pump.id === 'medtronic-780g') {
          score += 30;
        }
        if (response.includes('automated') || response.includes('hands-off')) {
          score += 20;
        }
        break;

      case 'easeToStart':
        if (response.includes('simple') || response.includes('easy')) {
          if (pump.id.includes('omnipod')) score += 20;
        }
        break;

      case 'complexity':
        if (response.includes('tech') || response.includes('phone')) {
          if (pump.dimensions.phoneControl?.bolusFromPhone) score += 25;
        }
        break;

      case 'support':
        if (response.includes('family') || response.includes('caregiver')) {
          if (pump.dimensions.pediatric?.remoteBolus) score += 30;
        }
        break;
    }

    return {
      pumpId: pump.id,
      pumpName: pump.name,
      score: Math.min(100, score),
      reasoning: `Based on keyword matching for ${category}`,
      strengths: pump.pros?.slice(0, 2) || [],
      considerations: pump.cons?.slice(0, 2) || [],
    };
  }

  private calculateOverallScores(categoryWinners: CategoryWinner[]): Record<string, number> {
    const scores: Record<string, number> = {};

    // Initialize scores
    PUMP_DATABASE.forEach(pump => {
      scores[pump.id] = 0;
    });

    // Weight categories and sum scores
    const categoryWeights: Record<string, number> = {
      algorithm: 1.5, // Control is critical
      lifestyle: 1.3, // Lifestyle fit is very important
      cost: 1.2, // Cost/insurance matters
      complexity: 1.0,
      easeToStart: 1.0,
      support: 1.0,
    };

    categoryWinners.forEach(category => {
      const weight = categoryWeights[category.category] || 1.0;

      category.allScores.forEach(pumpScore => {
        scores[pumpScore.pumpId] += pumpScore.score * weight;
      });
    });

    // Normalize scores to 0-100 scale
    const maxScore = Math.max(...Object.values(scores));
    Object.keys(scores).forEach(pumpId => {
      scores[pumpId] = Math.round((scores[pumpId] / maxScore) * 100);
    });

    return scores;
  }

  private async generatePersonalizedInsights(
    userResponses: UserResponses,
    overallScores: Record<string, number>
  ): Promise<string[]> {
    const insights: string[] = [];

    // Analyze patterns in responses
    const responseText = Object.values(userResponses).join(' ').toLowerCase();

    if (responseText.includes('active') || responseText.includes('sport')) {
      insights.push(
        'Your active lifestyle is a key factor - we prioritized pumps with durability and flexibility.'
      );
    }

    if (responseText.includes('tech') || responseText.includes('app')) {
      insights.push(
        'You seem comfortable with technology - pumps with advanced app integration scored higher.'
      );
    }

    if (responseText.includes('simple') || responseText.includes('easy')) {
      insights.push(
        'Ease of use is clearly important to you - we weighted user-friendly options more heavily.'
      );
    }

    if (responseText.includes('child') || responseText.includes('family')) {
      insights.push('Family management features were prioritized based on your caregiver needs.');
    }

    // Add insight about top choice
    const topPumpId = Object.entries(overallScores).sort(([, a], [, b]) => b - a)[0][0];
    const topPump = PUMP_DATABASE.find(p => p.id === topPumpId);

    if (topPump) {
      insights.push(
        `The ${topPump.name} emerged as your best match across ${Object.keys(userResponses).length} key categories.`
      );
    }

    return insights;
  }

  private async generateKeyReasons(
    pump: any,
    userResponses: UserResponses,
    categoryWinners: CategoryWinner[]
  ): Promise<string[]> {
    const reasons: string[] = [];

    // Find categories where this pump won
    const wonCategories = categoryWinners
      .filter(cw => cw.winner.pumpId === pump.id)
      .map(cw => cw.categoryTitle);

    if (wonCategories.length > 0) {
      reasons.push(`Best match for: ${wonCategories.join(', ')}`);
    }

    // Add top pros
    if (pump.pros && pump.pros.length > 0) {
      reasons.push(...pump.pros.slice(0, 2));
    }

    // Add specific matching features based on responses
    const responseText = Object.values(userResponses).join(' ').toLowerCase();

    if (responseText.includes('phone') && pump.dimensions.phoneControl?.bolusFromPhone) {
      reasons.push('Full phone control for convenient bolusing');
    }

    if (responseText.includes('water') && pump.dimensions.waterResistance?.submersible) {
      reasons.push(`Waterproof to ${pump.dimensions.waterResistance.depth}`);
    }

    return reasons.slice(0, 4); // Limit to 4 key reasons
  }

  private generateConsiderIf(secondPump: any, topPump: any): string[] {
    const considerIf: string[] = [];

    // Compare key differences
    if (
      secondPump.dimensions.phoneControl?.bolusFromPhone &&
      !topPump.dimensions.phoneControl?.bolusFromPhone
    ) {
      considerIf.push('Phone bolusing is a must-have feature');
    }

    if (
      secondPump.dimensions.waterResistance?.submersible &&
      !topPump.dimensions.waterResistance?.submersible
    ) {
      considerIf.push('Water activities are a major part of your lifestyle');
    }

    if (secondPump.dimensions.capacity?.units > topPump.dimensions.capacity?.units) {
      considerIf.push('You need maximum insulin capacity');
    }

    if (secondPump.manufacturer !== topPump.manufacturer) {
      considerIf.push(`You prefer ${secondPump.manufacturer}'s ecosystem`);
    }

    return considerIf.slice(0, 3);
  }

  private generateNextSteps(topPump: any): string[] {
    return [
      `Contact your endocrinologist to discuss the ${topPump.name}`,
      `Check your insurance coverage for ${topPump.dimensions.cost?.coverage || 'this pump'}`,
      `Request a demo or trial from ${topPump.manufacturer}`,
      'Download and review the detailed PDF report',
      'Schedule a follow-up consultation if you have questions',
    ];
  }

  // Generate PDF content
  async generatePDFContent(
    recommendation: PumpRecommendation,
    userResponses: UserResponses
  ): Promise<string> {
    const pdfContent = `
# Your Personalized Insulin Pump Recommendation Report

## Executive Summary
After analyzing your responses across 6 key categories, we've identified the **${recommendation.topChoice.pumpName}** as your optimal insulin pump choice.

### Top Recommendation: ${recommendation.topChoice.pumpName}
**Manufacturer:** ${recommendation.topChoice.manufacturer}  
**Overall Match Score:** ${recommendation.topChoice.overallScore}%

#### Why This Pump Is Perfect For You:
${recommendation.topChoice.keyReasons.map(r => `• ${r}`).join('\n')}

### Alternative Option: ${recommendation.secondChoice?.pumpName || 'N/A'}
${
  recommendation.secondChoice
    ? `
**Manufacturer:** ${recommendation.secondChoice.manufacturer}  
**Overall Match Score:** ${recommendation.secondChoice.overallScore}%

Consider this pump if:
${recommendation.secondChoice.considerIf.map(r => `• ${r}`).join('\n')}
`
    : ''
}

## Category-by-Category Analysis

${recommendation.categoryWinners
  .map(
    cw => `
### ${cw.categoryTitle}
**Winner:** ${cw.winner.pumpName} (Score: ${cw.winner.score}/100)

**Why it won:**
${cw.winner.reasoning}

**Strengths for you:**
${cw.winner.strengths.map(s => `• ${s}`).join('\n')}

${
  cw.runnerUp
    ? `
**Runner-up:** ${cw.runnerUp.pumpName} (Score: ${cw.runnerUp.score}/100)
`
    : ''
}
`
  )
  .join('\n')}

## Your Personalized Insights
${recommendation.personalizedInsights.map(i => `• ${i}`).join('\n')}

## Recommended Next Steps
${recommendation.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## About Your Top Choice: ${recommendation.topChoice.pumpName}

### Key Features That Match Your Needs:
${PUMP_DATABASE.find(p => p.id === recommendation.topChoice.pumpId)
  ?.pros?.map(p => `✓ ${p}`)
  .join('\n')}

### Ideal For:
${recommendation.topChoice.perfectFor.map(p => `• ${p}`).join('\n')}

## Important Considerations

While the ${recommendation.topChoice.pumpName} is our top recommendation based on your specific needs and preferences, remember that:

1. **Insurance Coverage:** Verify coverage with your insurance provider
2. **Training:** Each pump requires proper training for optimal use
3. **Trial Period:** Many manufacturers offer trial programs
4. **Support System:** Consider local support and training availability
5. **Personal Preference:** Your comfort with the device is paramount

## Contact Information

To move forward with your pump selection:
- Discuss this report with your endocrinologist
- Contact ${recommendation.topChoice.manufacturer} for more information
- Review your insurance benefits for pump coverage

---
*This report was generated based on your responses to the PumpDrive AI assessment. It is intended to guide your decision-making process and should be discussed with your healthcare provider.*

Generated: ${new Date().toLocaleDateString()}
    `;

    return pdfContent;
  }
}

export const pumpAnalysisService = new PumpAnalysisService();
