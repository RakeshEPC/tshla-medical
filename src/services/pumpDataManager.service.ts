/**
 * PumpData Manager Service
 * Provides comprehensive pump data for AI-driven recommendations
 * Uses the complete 23-dimension pump database
 */

import { PUMP_DATABASE, type PumpDetails } from '../data/pumpDataComplete';

interface CategoryPumpData {
  pumpId: string;
  relevantFeatures: string[];
  categoryScore: number;
  pros: string[];
  cons: string[];
  specificDetails: Record<string, any>;
}

interface PumpComparisonData {
  dimension: string;
  pumpA: string;
  pumpB: string;
  winner?: string;
  explanation?: string;
}

class PumpDataManagerService {
  private pumpDatabase: PumpDetails[] = PUMP_DATABASE;

  /**
   * Get detailed pump information for AI prompt context
   * This provides rich, structured data for better recommendations
   */
  getPumpContextForCategory(category: string): string {
    const pumps = this.pumpDatabase;
    const categoryMapping = this.getCategoryDimensionMapping();
    const relevantDimensions = categoryMapping[category] || [];

    let context = `DETAILED PUMP SPECIFICATIONS FOR ${category.toUpperCase()} CATEGORY:\n\n`;

    pumps.forEach(pump => {
      context += `\n${pump.name} (${pump.manufacturer}):\n`;
      context += '='.repeat(50) + '\n';

      // Add relevant dimensions for this category
      relevantDimensions.forEach(dim => {
        const value = this.getPumpDimensionValue(pump, dim);
        if (value) {
          context += `• ${dim}: ${value}\n`;
        }
      });

      // Add pros/cons if available
      if (pump.pros && pump.pros.length > 0) {
        context += `\nStrengths: ${pump.pros.join(', ')}\n`;
      }
      if (pump.cons && pump.cons.length > 0) {
        context += `Limitations: ${pump.cons.join(', ')}\n`;
      }
      if (pump.idealFor && pump.idealFor.length > 0) {
        context += `Ideal for: ${pump.idealFor.join(', ')}\n`;
      }

      context += '\n';
    });

    return context;
  }

  /**
   * Get category-specific dimension mapping
   * Maps each category to its most relevant pump dimensions
   */
  private getCategoryDimensionMapping(): Record<string, string[]> {
    return {
      cost: [
        'costInsurance',
        'costDetails',
        'battery',
        'batteryDetails',
        'reservoirCapacity',
        'adhesiveTolerance',
        'updates',
      ],
      lifestyle: [
        'wearability',
        'wearabilityDetails',
        'waterResistance',
        'waterDetails',
        'phoneControl',
        'phoneControlDetails',
        'tubingStyle',
        'tubingDetails',
        'travelLogistics',
        'travelDetails',
        'ecosystem',
        'ecosystemDetails',
      ],
      algorithm: [
        'algorithm',
        'algorithmDetails',
        'targetAdjustability',
        'targetDetails',
        'exerciseMode',
        'exerciseDetails',
        'cgmCompatibility',
        'cgmDetails',
        'bolusWorkflow',
        'bolusDetails',
      ],
      easeToStart: [
        'userInterface',
        'uiDetails',
        'phoneControl',
        'phoneControlDetails',
        'clinicSupport',
        'bolusWorkflow',
        'bolusDetails',
      ],
      complexity: [
        'alertsCustomization',
        'alertsDetails',
        'userInterface',
        'uiDetails',
        'bolusWorkflow',
        'bolusDetails',
        'reservoirCapacity',
        'reservoirDetails',
      ],
      support: [
        'clinicSupport',
        'dataSharing',
        'dataSharingDetails',
        'caregiverFeatures',
        'caregiverDetails',
        'updates',
        'updatesDetails',
      ],
    };
  }

  /**
   * Extract dimension value from pump data
   */
  private getPumpDimensionValue(pump: PumpDetails, dimension: string): string | null {
    const dims = pump.dimensions as any;

    // Handle simple string dimensions
    if (dims[dimension] && typeof dims[dimension] === 'string') {
      return dims[dimension];
    }

    // Handle complex object dimensions
    if (dims[dimension] && typeof dims[dimension] === 'object') {
      // Special handling for different dimension types
      switch (dimension) {
        case 'phoneControl':
          const pc = dims.phoneControl;
          return `Bolus from phone: ${pc.bolusFromPhone ? 'Yes' : 'No'}, ${pc.details}`;

        case 'waterResistance':
          const wr = dims.waterResistance;
          return `${wr.rating}, ${wr.submersible ? `Submersible to ${wr.depth}` : 'Not submersible'} - ${wr.details}`;

        case 'algorithm':
          const alg = dims.algorithm;
          return `${alg.type} (${alg.aggressiveness} aggressiveness) - ${alg.details}`;

        case 'cgmCompatibility':
          const cgm = dims.cgmCompatibility;
          return `Works with: ${cgm.compatible.join(', ')}. ${cgm.details}`;

        case 'targetAdjustability':
          const target = dims.targetAdjustability;
          return `${target.customizable ? 'Customizable' : 'Fixed'} targets: ${target.ranges}. ${target.details}`;

        case 'exerciseMode':
          const ex = dims.exerciseMode;
          return ex.available
            ? `Yes - ${ex.targetRange || ex.type}. ${ex.details}`
            : `No exercise mode`;

        case 'cost':
          const cost = dims.cost;
          return `Coverage: ${cost.coverage}. ${cost.financialAssistance || ''} ${cost.details}`;

        default:
          return JSON.stringify(dims[dimension]);
      }
    }

    return null;
  }

  /**
   * Generate detailed pump comparison for specific patient needs
   */
  generatePumpComparison(
    pumpAId: string,
    pumpBId: string,
    patientPriorities: string[]
  ): PumpComparisonData[] {
    const pumpA = this.pumpDatabase.find(p => p.id === pumpAId);
    const pumpB = this.pumpDatabase.find(p => p.id === pumpBId);

    if (!pumpA || !pumpB) return [];

    const comparisons: PumpComparisonData[] = [];

    // Compare each priority dimension
    patientPriorities.forEach(priority => {
      const comparison: PumpComparisonData = {
        dimension: priority,
        pumpA: this.getPumpDimensionValue(pumpA, priority) || 'Not specified',
        pumpB: this.getPumpDimensionValue(pumpB, priority) || 'Not specified',
      };

      // Determine winner based on dimension
      comparison.winner = this.determineDimensionWinner(pumpA, pumpB, priority);
      comparison.explanation = this.generateComparisonExplanation(pumpA, pumpB, priority);

      comparisons.push(comparison);
    });

    return comparisons;
  }

  /**
   * Determine which pump wins for a specific dimension
   */
  private determineDimensionWinner(
    pumpA: PumpDetails,
    pumpB: PumpDetails,
    dimension: string
  ): string | undefined {
    const dimsA = pumpA.dimensions as any;
    const dimsB = pumpB.dimensions as any;

    // Specific comparison logic for different dimensions
    switch (dimension) {
      case 'phoneControl':
        if (dimsA.phoneControl?.bolusFromPhone && !dimsB.phoneControl?.bolusFromPhone) {
          return pumpA.name;
        }
        if (!dimsA.phoneControl?.bolusFromPhone && dimsB.phoneControl?.bolusFromPhone) {
          return pumpB.name;
        }
        break;

      case 'waterResistance':
        if (dimsA.waterResistance?.submersible && !dimsB.waterResistance?.submersible) {
          return pumpA.name;
        }
        if (!dimsA.waterResistance?.submersible && dimsB.waterResistance?.submersible) {
          return pumpB.name;
        }
        break;

      case 'tubingStyle':
        // This depends on patient preference, no clear winner
        break;

      case 'reservoirCapacity':
        const capA = dimsA.capacity?.units || 0;
        const capB = dimsB.capacity?.units || 0;
        if (capA > capB) return pumpA.name;
        if (capB > capA) return pumpB.name;
        break;
    }

    return undefined;
  }

  /**
   * Generate natural language explanation for dimension comparison
   */
  private generateComparisonExplanation(
    pumpA: PumpDetails,
    pumpB: PumpDetails,
    dimension: string
  ): string {
    const dimsA = pumpA.dimensions as any;
    const dimsB = pumpB.dimensions as any;

    switch (dimension) {
      case 'phoneControl':
        if (dimsA.phoneControl?.bolusFromPhone && !dimsB.phoneControl?.bolusFromPhone) {
          return `${pumpA.name} allows full bolusing from your phone, while ${pumpB.name} requires using the pump itself`;
        }
        break;

      case 'waterResistance':
        const depthA = dimsA.waterResistance?.depth || 'N/A';
        const depthB = dimsB.waterResistance?.depth || 'N/A';
        return `${pumpA.name} is submersible to ${depthA}, ${pumpB.name} to ${depthB}`;

      case 'algorithm':
        return `${pumpA.name} uses ${dimsA.algorithm?.type} (${dimsA.algorithm?.aggressiveness}), while ${pumpB.name} uses ${dimsB.algorithm?.type} (${dimsB.algorithm?.aggressiveness})`;
    }

    return '';
  }

  /**
   * Get pump scoring based on patient transcript analysis
   */
  scorePumpsForPatient(
    category: string,
    patientNeeds: string[]
  ): Array<{ pumpId: string; score: number; reasons: string[] }> {
    const scores: Array<{ pumpId: string; score: number; reasons: string[] }> = [];

    this.pumpDatabase.forEach(pump => {
      let score = 0;
      const reasons: string[] = [];

      // Score based on patient needs matching pump features
      patientNeeds.forEach(need => {
        const matchScore = this.calculateNeedMatch(pump, need, category);
        score += matchScore.score;
        if (matchScore.reason) {
          reasons.push(matchScore.reason);
        }
      });

      scores.push({
        pumpId: pump.id,
        score: Math.min(100, Math.round(score)),
        reasons,
      });
    });

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate how well a pump matches a specific patient need
   */
  private calculateNeedMatch(
    pump: PumpDetails,
    need: string,
    category: string
  ): { score: number; reason?: string } {
    const needLower = need.toLowerCase();
    const dims = pump.dimensions as any;

    // Water-related needs
    if (needLower.includes('water') || needLower.includes('swim') || needLower.includes('shower')) {
      if (dims.waterResistance?.submersible) {
        return {
          score: 20,
          reason: `${pump.name} is waterproof and submersible to ${dims.waterResistance.depth}`,
        };
      }
      return { score: 5 };
    }

    // Phone control needs
    if (needLower.includes('phone') || needLower.includes('app')) {
      if (dims.phoneControl?.bolusFromPhone) {
        return {
          score: 15,
          reason: `${pump.name} offers full phone control including bolusing`,
        };
      }
      return { score: 5 };
    }

    // Simplicity needs
    if (needLower.includes('simple') || needLower.includes('easy')) {
      if (pump.id === 'beta-bionics-ilet') {
        return {
          score: 20,
          reason: `${pump.name} requires no carb counting - just meal announcements`,
        };
      }
    }

    // Tubeless needs
    if (needLower.includes('tubeless') || needLower.includes('no tub')) {
      if (dims.tubing?.type === 'tubeless') {
        return {
          score: 20,
          reason: `${pump.name} is completely tubeless`,
        };
      }
    }

    // Algorithm aggressiveness
    if (needLower.includes('aggressive') || needLower.includes('tight control')) {
      if (dims.algorithm?.aggressiveness === 'aggressive') {
        return {
          score: 15,
          reason: `${pump.name} has an aggressive algorithm for tighter control`,
        };
      }
    }

    // Cost/insurance needs
    if (
      category === 'cost' &&
      (needLower.includes('insurance') || needLower.includes('coverage'))
    ) {
      if (dims.cost?.coverage === 'pharmacy') {
        return {
          score: 10,
          reason: `${pump.name} typically covered under pharmacy benefits`,
        };
      }
    }

    return { score: 5 }; // Base score for any pump
  }

  /**
   * Get comprehensive pump summary for final recommendation
   */
  getPumpSummaryForRecommendation(pumpId: string): string {
    const pump = this.pumpDatabase.find(p => p.id === pumpId);
    if (!pump) return '';

    const dims = pump.dimensions as any;

    return `
${pump.name} (${pump.manufacturer})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KEY FEATURES:
${pump.pros?.map(p => `✓ ${p}`).join('\n') || ''}

IDEAL FOR:
${pump.idealFor?.map(i => `• ${i}`).join('\n') || ''}

TECHNICAL SPECIFICATIONS:
• Battery: ${dims.battery || 'N/A'}
• Phone Control: ${dims.phoneControl?.bolusFromPhone ? 'Full bolusing from phone' : 'View only on phone'}
• Water Resistance: ${dims.waterResistance?.rating || 'N/A'} ${dims.waterResistance?.submersible ? `(Submersible to ${dims.waterResistance?.depth})` : ''}
• Algorithm: ${dims.algorithm?.type || 'N/A'} (${dims.algorithm?.aggressiveness || 'N/A'} control)
• CGM Compatibility: ${dims.cgmCompatibility?.compatible?.join(', ') || 'N/A'}
• Reservoir: ${dims.capacity?.units || 'N/A'} units
• Insurance: ${dims.cost?.coverage || 'N/A'} coverage typical

CONSIDERATIONS:
${pump.cons?.map(c => `• ${c}`).join('\n') || ''}
    `.trim();
  }

  /**
   * Extract patient needs from transcript using keyword analysis
   */
  extractPatientNeeds(transcript: string): string[] {
    const needs: string[] = [];
    const transcriptLower = transcript.toLowerCase();

    // Water activities
    if (transcriptLower.match(/swim|pool|beach|shower|water|bath/)) {
      needs.push('water resistance');
    }

    // Technology comfort
    if (transcriptLower.match(/tech|app|phone|smartphone|iphone|android/)) {
      needs.push('phone control');
    }

    // Simplicity
    if (transcriptLower.match(/simple|easy|confus|complicated|overwhelm/)) {
      needs.push('simplicity');
    }

    // Discretion
    if (transcriptLower.match(/discrete|discreet|hide|hidden|visible|notice/)) {
      needs.push('discretion');
    }

    // Activity level
    if (transcriptLower.match(/active|exercise|gym|sport|run|workout/)) {
      needs.push('active lifestyle');
    }

    // Control preferences
    if (transcriptLower.match(/tight|aggressive|control|stable|variability/)) {
      needs.push('tight control');
    }

    // Tubing preference
    if (transcriptLower.match(/tube|tubing|tubeless|wire|tangle/)) {
      needs.push(transcriptLower.includes('tubeless') ? 'tubeless' : 'tubing acceptable');
    }

    return needs;
  }
}

export const pumpDataManagerService = new PumpDataManagerService();
