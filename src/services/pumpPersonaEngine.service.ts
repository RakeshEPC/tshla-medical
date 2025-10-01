/**
 * Persona-Based Pump Matching Engine
 * Uses patient personas mapped to pump "idealFor" data
 */

import { PUMP_DATABASE, type PumpData } from '../data/pumpDataSimple';

export interface PatientPersona {
  id: string;
  name: string;
  emoji: string;
  description: string;
  keywords: string[];
  pumpMatches: {
    pumpId: string;
    pumpName: string;
    matchScore: number; // 1-100
    reason: string;
  }[];
}

export interface DealBreaker {
  id: string;
  question: string;
  options: {
    value: string;
    label: string;
    eliminates: string[]; // Pump IDs to eliminate
  }[];
}

export interface ClinicalRule {
  condition: string;
  requirement: (answers: Record<string, string>) => boolean;
  recommendations: {
    pumpId: string;
    priority: number;
    reason: string;
  }[];
}

// Patient Personas derived from pump idealFor data
export const PATIENT_PERSONAS: PatientPersona[] = [
  {
    id: 'simplicity_seeker',
    name: 'The Simplicity Seeker',
    emoji: '🎯',
    description: 'You want the easiest possible diabetes management with minimal daily decisions',
    keywords: ['simple', 'easy', 'minimal', 'basic', 'straightforward', 'hassle-free'],
    pumpMatches: [
      {
        pumpId: 'beta-bionics-ilet',
        pumpName: 'Beta Bionics iLet',
        matchScore: 95,
        reason: 'Designed for simplicity seekers who want no carb counting and minimal interaction',
      },
      {
        pumpId: 'medtronic-780g',
        pumpName: 'Medtronic 780G',
        matchScore: 75,
        reason: 'Established system with aggressive automatic control reduces daily decisions',
      },
    ],
  },

  {
    id: 'tech_enthusiast',
    name: 'The Tech Enthusiast',
    emoji: '🚀',
    description: 'You love the latest technology and want full control through smart devices',
    keywords: ['technology', 'tech', 'app', 'smartphone', 'data', 'control', 'customization'],
    pumpMatches: [
      {
        pumpId: 'twiist',
        pumpName: 'Twiist',
        matchScore: 95,
        reason: 'Built for tech enthusiasts with Apple Watch integration and modern interface',
      },
      {
        pumpId: 't-slim-x2',
        pumpName: 't:slim X2',
        matchScore: 90,
        reason: 'Perfect for tech-comfortable users who want detailed data and precise control',
      },
      {
        pumpId: 'tandem-mobi',
        pumpName: 'Tandem Mobi',
        matchScore: 85,
        reason: 'Phone-first design ideal for iPhone users who prefer modern interfaces',
      },
    ],
  },

  {
    id: 'active_lifestyle',
    name: 'The Active Adventurer',
    emoji: '🏃',
    description: 'You lead an active lifestyle with sports, swimming, and outdoor activities',
    keywords: ['active', 'sports', 'swimming', 'exercise', 'outdoors', 'adventure', 'water'],
    pumpMatches: [
      {
        pumpId: 'omnipod-5',
        pumpName: 'Omnipod 5',
        matchScore: 95,
        reason:
          'Perfect for active lifestyles and water activities with tubeless, waterproof design',
      },
      {
        pumpId: 'tandem-mobi',
        pumpName: 'Tandem Mobi',
        matchScore: 80,
        reason: 'Compact design ideal for active lifestyles and discreet wearing',
      },
    ],
  },

  {
    id: 'control_perfectionist',
    name: 'The Control Perfectionist',
    emoji: '🎛️',
    description: 'You want tight glucose control and aggressive management with detailed data',
    keywords: ['control', 'tight', 'aggressive', 'data', 'precision', 'detailed', 'monitoring'],
    pumpMatches: [
      {
        pumpId: 'medtronic-780g',
        pumpName: 'Medtronic 780G',
        matchScore: 95,
        reason: 'Most aggressive algorithm with established track record for control seekers',
      },
      {
        pumpId: 't-slim-x2',
        pumpName: 't:slim X2',
        matchScore: 90,
        reason: 'Excellent for tight control seekers who want detailed data and customization',
      },
    ],
  },

  {
    id: 'established_user',
    name: 'The Established User',
    emoji: '💼',
    description:
      'You are experienced with pumps and want aggressive control with proven technology',
    keywords: ['experienced', 'established', 'heavy', 'insulin', 'aggressive', 'control'],
    pumpMatches: [
      {
        pumpId: 'medtronic-780g',
        pumpName: 'Medtronic 780G',
        matchScore: 95,
        reason:
          'Perfect for heavy insulin users, aggressive control seekers, and established pump users',
      },
    ],
  },

  {
    id: 'parent_caregiver',
    name: 'The Parent/Caregiver',
    emoji: '👨‍👩‍👧‍👦',
    description: 'You need a pump for a child or someone with needle phobia',
    keywords: ['child', 'kids', 'parent', 'caregiver', 'family', 'needle', 'phobic'],
    pumpMatches: [
      {
        pumpId: 'omnipod-5',
        pumpName: 'Omnipod 5',
        matchScore: 95,
        reason:
          'Specifically designed for kids, needle-phobic patients, active lifestyles, and water activities',
      },
    ],
  },

  {
    id: 'data_focused',
    name: 'The Data Analyst',
    emoji: '📊',
    description: 'You want detailed data, tight control, and tech-comfortable features',
    keywords: [
      'data',
      'focused',
      'analysis',
      'detailed',
      'tight',
      'control',
      'tech',
      'comfortable',
    ],
    pumpMatches: [
      {
        pumpId: 't-slim-x2',
        pumpName: 't:slim X2',
        matchScore: 95,
        reason:
          'Built for tech-comfortable users, data-focused patients, and tight control seekers',
      },
    ],
  },

  {
    id: 'discreet_iphone_user',
    name: 'The Discreet iPhone User',
    emoji: '📱',
    description: 'You want discreet wearing with iPhone integration for active lifestyles',
    keywords: ['discreet', 'iPhone', 'ios', 'apple', 'wearing', 'active', 'compact'],
    pumpMatches: [
      {
        pumpId: 'tandem-mobi',
        pumpName: 'Tandem Mobi',
        matchScore: 95,
        reason: 'Perfect for discreet wearing, active lifestyles, and iPhone users',
      },
    ],
  },

  {
    id: 'apple_watch_modern',
    name: 'The Apple Watch Enthusiast',
    emoji: '⌚',
    description: 'You want modern interface with Apple Watch integration and latest tech',
    keywords: ['apple', 'watch', 'modern', 'interface', 'tech', 'enthusiast', 'latest'],
    pumpMatches: [
      {
        pumpId: 'twiist',
        pumpName: 'Twiist',
        matchScore: 95,
        reason: 'Designed for tech enthusiasts, Apple Watch users, and modern interface seekers',
      },
    ],
  },
];

// Deal-breaker questions for elimination
export const DEAL_BREAKERS: DealBreaker[] = [
  {
    id: 'tubeless_requirement',
    question: 'Do you absolutely need a tubeless pump?',
    options: [
      {
        value: 'yes_tubeless',
        label: 'Yes, I need tubeless (no tubing)',
        eliminates: ['medtronic-780g', 't-slim-x2', 'tandem-mobi', 'beta-bionics-ilet', 'twiist'],
      },
      {
        value: 'no_preference',
        label: 'No preference or okay with tubing',
        eliminates: [],
      },
    ],
  },
  {
    id: 'waterproof_requirement',
    question: 'Do you need to swim or shower with your pump?',
    options: [
      {
        value: 'yes_waterproof',
        label: 'Yes, must be fully waterproof',
        eliminates: ['t-slim-x2', 'tandem-mobi'], // Only partially water-resistant
      },
      {
        value: 'water_resistant_ok',
        label: 'Water-resistant is fine',
        eliminates: [],
      },
    ],
  },
];

// Clinical validation rules
export const CLINICAL_RULES: ClinicalRule[] = [
  {
    condition: 'High insulin needs (>200 units/day)',
    requirement: answers => answers.insulin_needs === 'high',
    recommendations: [
      {
        pumpId: 'medtronic-780g',
        priority: 1,
        reason: '300 unit capacity with 7-day infusion sets for heavy users',
      },
    ],
  },
  {
    condition: 'New to pumps',
    requirement: answers => answers.experience === 'new',
    recommendations: [
      {
        pumpId: 'beta-bionics-ilet',
        priority: 1,
        reason: 'Simplest learning curve with minimal training required',
      },
      {
        pumpId: 'omnipod-5',
        priority: 2,
        reason: 'No tubing makes it easier to learn pump basics',
      },
    ],
  },
];

export class PumpPersonaEngine {
  /**
   * Get pump recommendations based on persona matching
   */
  getPersonaRecommendations(
    personaId: string,
    dealBreakerAnswers?: Record<string, string>
  ): {
    recommendations: Array<{
      pump: PumpData;
      matchScore: number;
      reason: string;
      persona: string;
    }>;
    eliminated: string[];
  } {
    const persona = PATIENT_PERSONAS.find(p => p.id === personaId);
    if (!persona) {
      throw new Error(`Persona ${personaId} not found`);
    }

    // Apply deal-breaker eliminations
    let eliminatedPumps: string[] = [];
    if (dealBreakerAnswers) {
      for (const [questionId, answer] of Object.entries(dealBreakerAnswers)) {
        const dealBreaker = DEAL_BREAKERS.find(db => db.id === questionId);
        if (dealBreaker) {
          const option = dealBreaker.options.find(opt => opt.value === answer);
          if (option) {
            eliminatedPumps = [...eliminatedPumps, ...option.eliminates];
          }
        }
      }
    }

    // Get recommendations from persona, filtering out eliminated pumps
    const recommendations = persona.pumpMatches
      .filter(match => !eliminatedPumps.includes(match.pumpId))
      .map(match => {
        const pump = PUMP_DATABASE.find(p => p.id === match.pumpId);
        if (!pump) return null;

        return {
          pump,
          matchScore: match.matchScore,
          reason: match.reason,
          persona: persona.name,
        };
      })
      .filter(rec => rec !== null)
      .sort((a, b) => b!.matchScore - a!.matchScore);

    return {
      recommendations: recommendations as any[],
      eliminated: eliminatedPumps,
    };
  }

  /**
   * Find best persona based on keywords or preferences
   */
  findBestPersona(keywords: string[]): PatientPersona | null {
    let bestMatch: { persona: PatientPersona; score: number } | null = null;

    for (const persona of PATIENT_PERSONAS) {
      let score = 0;

      for (const keyword of keywords) {
        for (const personaKeyword of persona.keywords) {
          if (
            keyword.toLowerCase().includes(personaKeyword.toLowerCase()) ||
            personaKeyword.toLowerCase().includes(keyword.toLowerCase())
          ) {
            score++;
          }
        }
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { persona, score };
      }
    }

    return bestMatch?.score > 0 ? bestMatch.persona : null;
  }

  /**
   * Apply clinical rules to modify recommendations
   */
  applyClinicalRules(recommendations: any[], clinicalAnswers: Record<string, string>): any[] {
    const clinicalBoosts = new Map<string, number>();

    for (const rule of CLINICAL_RULES) {
      if (rule.requirement(clinicalAnswers)) {
        for (const rec of rule.recommendations) {
          const currentBoost = clinicalBoosts.get(rec.pumpId) || 0;
          clinicalBoosts.set(rec.pumpId, currentBoost + (10 - rec.priority) * 5);
        }
      }
    }

    // Apply clinical boosts
    return recommendations
      .map(rec => ({
        ...rec,
        matchScore: rec.matchScore + (clinicalBoosts.get(rec.pump.id) || 0),
        clinicalBoost: clinicalBoosts.get(rec.pump.id) || 0,
      }))
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Get all available personas
   */
  getAllPersonas(): PatientPersona[] {
    return PATIENT_PERSONAS;
  }

  /**
   * Get all deal-breaker questions
   */
  getDealBreakers(): DealBreaker[] {
    return DEAL_BREAKERS;
  }
}

export const pumpPersonaEngine = new PumpPersonaEngine();
