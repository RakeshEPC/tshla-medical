/**
 * Intelligent Model Selection Service
 * Chooses optimal AI model (GPT-4o-mini vs GPT-4o) based on task complexity
 * Provides significant cost savings while maintaining quality
 */

import { logDebug, logInfo } from './logger.service';
import type { DoctorTemplate } from './doctorProfile.service';

export enum AIModel {
  GPT4O_MINI = 'gpt-4o-mini',    // Fast, cost-effective ($0.15/$0.60 per 1M tokens)
  GPT4O = 'gpt-4o',               // More capable ($2.50/$10 per 1M tokens)
  GPT4O_STAGE5 = 'gpt-4o-stage5', // Alias for stage 5 processing
  GPT4O_STAGE6 = 'gpt-4o-stage6'  // Alias for stage 6 processing
}

export enum ComplexityLevel {
  SIMPLE = 'simple',         // Use GPT-4o-mini (90% cost savings)
  MODERATE = 'moderate',     // Use GPT-4o-mini with validation
  COMPLEX = 'complex',       // Use GPT-4o for accuracy
  VERY_COMPLEX = 'very_complex' // Always use GPT-4o
}

export interface ComplexityScore {
  level: ComplexityLevel;
  score: number; // 0-100
  factors: {
    sectionCount: number;
    requiredSections: number;
    instructionLength: number;
    hasCustomInstructions: boolean;
    hasDiagnosticReasoning: boolean;
    estimatedTokens: number;
  };
  recommendedModel: AIModel;
  estimatedCost: {
    mini: number;
    full: number;
    savings: number;
  };
}

class ModelSelectionService {
  // Cost per 1M tokens (input/output average)
  private readonly COST_GPT4O_MINI = 0.375; // ($0.15 + $0.60) / 2
  private readonly COST_GPT4O = 6.25;      // ($2.50 + $10) / 2

  // Complexity thresholds
  private readonly THRESHOLD_SIMPLE = 30;
  private readonly THRESHOLD_MODERATE = 50;
  private readonly THRESHOLD_COMPLEX = 70;

  /**
   * Calculate complexity score for a medical note processing task
   */
  calculateComplexity(
    transcript: string,
    template?: DoctorTemplate,
    additionalContext?: string
  ): ComplexityScore {
    let score = 0;
    const factors: ComplexityScore['factors'] = {
      sectionCount: 0,
      requiredSections: 0,
      instructionLength: 0,
      hasCustomInstructions: false,
      hasDiagnosticReasoning: false,
      estimatedTokens: 0
    };

    // 1. Template Complexity (30 points max)
    if (template) {
      const sectionCount = Object.keys(template.sections).length;
      factors.sectionCount = sectionCount;

      // More sections = more complex
      if (sectionCount <= 5) {
        score += 5;
      } else if (sectionCount <= 8) {
        score += 15;
      } else {
        score += 30;
      }

      // Required sections add complexity
      const requiredCount = Object.values(template.sections).filter(s => s.required).length;
      factors.requiredSections = requiredCount;
      score += Math.min(requiredCount * 3, 15);

      // Custom AI instructions add complexity
      if (template.generalInstructions) {
        factors.hasCustomInstructions = true;
        factors.instructionLength = template.generalInstructions.length;
        score += Math.min(template.generalInstructions.length / 50, 10);
      }

      // Section-specific instructions
      Object.values(template.sections).forEach(section => {
        if (section.aiInstructions) {
          factors.instructionLength += section.aiInstructions.length;
          score += Math.min(section.aiInstructions.length / 100, 5);
        }
      });
    } else {
      // Standard SOAP note - moderate complexity
      factors.sectionCount = 7;
      score += 10;
    }

    // 2. Transcript Length & Complexity (25 points max)
    const transcriptLength = transcript.length;
    factors.estimatedTokens = this.estimateTokenCount(transcript, template, additionalContext);

    if (transcriptLength < 500) {
      score += 5;
    } else if (transcriptLength < 1500) {
      score += 15;
    } else {
      score += 25;
    }

    // 3. Medical Reasoning Requirements (25 points max)
    const transcriptLower = transcript.toLowerCase();

    // Diagnostic reasoning indicators
    if (
      transcriptLower.includes('differential') ||
      transcriptLower.includes('rule out') ||
      transcriptLower.includes('consider') ||
      transcriptLower.includes('versus') ||
      transcriptLower.includes('etiology')
    ) {
      factors.hasDiagnosticReasoning = true;
      score += 15;
    }

    // Multiple diagnoses or complex conditions
    const diagnosisCount = (
      (transcriptLower.match(/diabetes/g) || []).length +
      (transcriptLower.match(/hypertension/g) || []).length +
      (transcriptLower.match(/thyroid/g) || []).length +
      (transcriptLower.match(/cardiac/g) || []).length
    );

    if (diagnosisCount >= 3) {
      score += 10;
    }

    // 4. Additional Context (10 points max)
    if (additionalContext && additionalContext.length > 200) {
      score += 10;
    }

    // 5. Specialty-specific requirements (10 points max)
    if (template?.specialty) {
      const complexSpecialties = ['cardiology', 'neurology', 'oncology', 'psychiatry'];
      if (complexSpecialties.some(s => template.specialty?.toLowerCase().includes(s))) {
        score += 10;
      }
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Determine complexity level
    let level: ComplexityLevel;
    if (score < this.THRESHOLD_SIMPLE) {
      level = ComplexityLevel.SIMPLE;
    } else if (score < this.THRESHOLD_MODERATE) {
      level = ComplexityLevel.MODERATE;
    } else if (score < this.THRESHOLD_COMPLEX) {
      level = ComplexityLevel.COMPLEX;
    } else {
      level = ComplexityLevel.VERY_COMPLEX;
    }

    // Select recommended model
    const recommendedModel = this.selectModel(level, factors);

    // Calculate cost estimates
    const estimatedCost = this.calculateCostEstimate(factors.estimatedTokens);

    logInfo('modelSelection', 'Calculated complexity score', {
      score,
      level,
      recommendedModel,
      sectionCount: factors.sectionCount,
      estimatedTokens: factors.estimatedTokens
    });

    return {
      level,
      score,
      factors,
      recommendedModel,
      estimatedCost
    };
  }

  /**
   * Select optimal model based on complexity and factors
   */
  private selectModel(level: ComplexityLevel, factors: ComplexityScore['factors']): AIModel {
    // Always use GPT-4o for very complex tasks
    if (level === ComplexityLevel.VERY_COMPLEX) {
      return AIModel.GPT4O;
    }

    // Use GPT-4o for complex diagnostic reasoning
    if (level === ComplexityLevel.COMPLEX && factors.hasDiagnosticReasoning) {
      return AIModel.GPT4O;
    }

    // Use GPT-4o for templates with extensive custom instructions
    if (factors.instructionLength > 500) {
      return AIModel.GPT4O;
    }

    // Use GPT-4o-mini for simple and moderate tasks (significant cost savings)
    if (level === ComplexityLevel.SIMPLE || level === ComplexityLevel.MODERATE) {
      return AIModel.GPT4O_MINI;
    }

    // Default to GPT-4o for safety
    return AIModel.GPT4O;
  }

  /**
   * Estimate token count for cost calculation
   */
  private estimateTokenCount(
    transcript: string,
    template?: DoctorTemplate,
    additionalContext?: string
  ): number {
    // Rough estimate: 1 token ≈ 4 characters for English
    let totalChars = transcript.length;

    if (template) {
      // Add template instructions
      if (template.generalInstructions) {
        totalChars += template.generalInstructions.length;
      }

      Object.values(template.sections).forEach(section => {
        if (section.aiInstructions) {
          totalChars += section.aiInstructions.length;
        }
      });
    }

    if (additionalContext) {
      totalChars += additionalContext.length;
    }

    // Add base prompt overhead (~500 tokens)
    totalChars += 2000;

    // Estimate output tokens (typically 1.5x input for medical notes)
    const inputTokens = Math.ceil(totalChars / 4);
    const outputTokens = Math.ceil(inputTokens * 1.5);

    return inputTokens + outputTokens;
  }

  /**
   * Calculate cost estimate for both models
   */
  private calculateCostEstimate(estimatedTokens: number): {
    mini: number;
    full: number;
    savings: number;
  } {
    const tokensInMillions = estimatedTokens / 1_000_000;

    const miniCost = tokensInMillions * this.COST_GPT4O_MINI;
    const fullCost = tokensInMillions * this.COST_GPT4O;
    const savings = fullCost - miniCost;

    return {
      mini: Number(miniCost.toFixed(4)),
      full: Number(fullCost.toFixed(4)),
      savings: Number(savings.toFixed(4))
    };
  }

  /**
   * Get model configuration for environment variables
   */
  getModelConfig(recommendedModel: AIModel): {
    stage5Model: string;
    stage6Model: string;
  } {
    if (recommendedModel === AIModel.GPT4O_MINI) {
      return {
        stage5Model: 'gpt-4o-mini',
        stage6Model: 'gpt-4o-mini'
      };
    } else {
      return {
        stage5Model: 'gpt-4o',
        stage6Model: 'gpt-4o'
      };
    }
  }

  /**
   * Get user-friendly explanation of model choice
   */
  getModelExplanation(complexity: ComplexityScore): string {
    const { level, recommendedModel, estimatedCost } = complexity;

    if (recommendedModel === AIModel.GPT4O_MINI) {
      return `Using GPT-4o-mini (${level}) - Fast and cost-effective. Estimated cost: $${estimatedCost.mini.toFixed(4)} (saves $${estimatedCost.savings.toFixed(4)} vs GPT-4o)`;
    } else {
      return `Using GPT-4o (${level}) - Enhanced accuracy for complex notes. Estimated cost: $${estimatedCost.full.toFixed(4)}`;
    }
  }

  /**
   * Check if we should upgrade from mini to full based on quality issues
   */
  shouldUpgradeModel(
    currentModel: AIModel,
    qualityScore: number,
    validationFailed: boolean
  ): boolean {
    // If already using GPT-4o, no upgrade needed
    if (currentModel === AIModel.GPT4O) {
      return false;
    }

    // Upgrade if quality is poor
    if (qualityScore < 0.7) {
      logInfo('modelSelection', 'Upgrading to GPT-4o due to poor quality', { qualityScore });
      return true;
    }

    // Upgrade if validation failed
    if (validationFailed) {
      logInfo('modelSelection', 'Upgrading to GPT-4o due to validation failure');
      return true;
    }

    return false;
  }

  /**
   * Get cost savings report for a given time period
   */
  calculateSavingsReport(usageData: {
    miniRequests: number;
    fullRequests: number;
    avgTokensPerRequest: number;
  }): {
    actualCost: number;
    wouldHaveCost: number;
    totalSavings: number;
    savingsPercent: number;
  } {
    const { miniRequests, fullRequests, avgTokensPerRequest } = usageData;
    const totalRequests = miniRequests + fullRequests;

    // Actual cost (mix of mini and full)
    const actualCost =
      (miniRequests * avgTokensPerRequest * this.COST_GPT4O_MINI) / 1_000_000 +
      (fullRequests * avgTokensPerRequest * this.COST_GPT4O) / 1_000_000;

    // Cost if all were GPT-4o
    const wouldHaveCost = (totalRequests * avgTokensPerRequest * this.COST_GPT4O) / 1_000_000;

    const totalSavings = wouldHaveCost - actualCost;
    const savingsPercent = (totalSavings / wouldHaveCost) * 100;

    return {
      actualCost: Number(actualCost.toFixed(2)),
      wouldHaveCost: Number(wouldHaveCost.toFixed(2)),
      totalSavings: Number(totalSavings.toFixed(2)),
      savingsPercent: Number(savingsPercent.toFixed(1))
    };
  }
}

export const modelSelectionService = new ModelSelectionService();
