/**
 * Smart Token Management Service
 * Handles token counting, truncation, and optimization for AI requests
 */

import { logDebug, logInfo, logWarn, logError } from './logger.service';
import type { DoctorTemplate } from './doctorProfile.service';

export interface TokenEstimate {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  breakdown: {
    systemPrompt: number;
    transcript: number;
    templateInstructions: number;
    patientContext: number;
    additionalContext: number;
    expectedOutput: number;
  };
  exceedsLimit: boolean;
  limitUsagePercent: number;
}

export interface TruncationResult {
  truncated: boolean;
  originalLength: number;
  truncatedLength: number;
  truncatedText: string;
  method: 'none' | 'sliding-window' | 'smart-summary' | 'section-priority';
  tokensRemoved: number;
}

export interface TokenBudget {
  maxTotalTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  allocated: {
    systemPrompt: number;
    transcript: number;
    templateInstructions: number;
    patientContext: number;
    additionalContext: number;
    outputBuffer: number;
  };
  remaining: number;
}

class TokenManagementService {
  // Model token limits (context window sizes)
  private readonly MODEL_LIMITS = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
  };

  // Target limits (leave buffer for safety)
  private readonly SAFE_LIMITS = {
    'gpt-4o': 120000,
    'gpt-4o-mini': 120000,
    'gpt-4': 7000,
    'gpt-3.5-turbo': 15000,
  };

  // Average tokens per section in output
  private readonly TOKENS_PER_SECTION = 150;

  // Token estimation constants
  private readonly CHARS_PER_TOKEN = 4; // English average
  private readonly MEDICAL_TERM_BONUS = 0.8; // Medical terms use more tokens

  /**
   * Estimate token count with improved accuracy
   * Uses character-based estimation with medical term adjustment
   */
  estimateTokens(text: string, isMedical: boolean = true): number {
    if (!text) return 0;

    const baseTokens = Math.ceil(text.length / this.CHARS_PER_TOKEN);

    // Medical text tends to use more tokens due to technical terminology
    if (isMedical) {
      const medicalTermCount = this.countMedicalTerms(text);
      const adjustment = medicalTermCount * this.MEDICAL_TERM_BONUS;
      return Math.ceil(baseTokens + adjustment);
    }

    return baseTokens;
  }

  /**
   * Count medical terms in text for better token estimation
   */
  private countMedicalTerms(text: string): number {
    const medicalPatterns = [
      /\b\d+mg\b/gi,
      /\b\d+mcg\b/gi,
      /\bhypertension\b/gi,
      /\bdiabetes\b/gi,
      /\bhypothyroid\b/gi,
      /\blevothyroxine\b/gi,
      /\bmetformin\b/gi,
      /\blisinopril\b/gi,
      /\batorvastatin\b/gi,
    ];

    let count = 0;
    for (const pattern of medicalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  /**
   * Get comprehensive token estimate for a complete request
   */
  estimateRequestTokens(
    transcript: string,
    template?: DoctorTemplate,
    patientContext?: string,
    additionalContext?: string,
    systemPromptLength: number = 2000
  ): TokenEstimate {
    const breakdown = {
      systemPrompt: Math.ceil(systemPromptLength / this.CHARS_PER_TOKEN),
      transcript: this.estimateTokens(transcript, true),
      templateInstructions: 0,
      patientContext: patientContext ? this.estimateTokens(patientContext, true) : 0,
      additionalContext: additionalContext ? this.estimateTokens(additionalContext, true) : 0,
      expectedOutput: 0,
    };

    // Calculate template instruction tokens
    if (template) {
      let instructionChars = 0;
      if (template.generalInstructions) {
        instructionChars += template.generalInstructions.length;
      }
      Object.values(template.sections).forEach(section => {
        if (section.aiInstructions) {
          instructionChars += section.aiInstructions.length;
        }
      });
      breakdown.templateInstructions = Math.ceil(instructionChars / this.CHARS_PER_TOKEN);

      // Estimate output tokens based on section count
      const sectionCount = Object.keys(template.sections).length;
      breakdown.expectedOutput = sectionCount * this.TOKENS_PER_SECTION;
    } else {
      // Default SOAP note: 7 sections
      breakdown.expectedOutput = 7 * this.TOKENS_PER_SECTION;
    }

    const inputTokens =
      breakdown.systemPrompt +
      breakdown.transcript +
      breakdown.templateInstructions +
      breakdown.patientContext +
      breakdown.additionalContext;

    const outputTokens = breakdown.expectedOutput;
    const totalTokens = inputTokens + outputTokens;

    // Check against limits (assuming GPT-4o by default)
    const limit = this.SAFE_LIMITS['gpt-4o'];
    const exceedsLimit = totalTokens > limit;
    const limitUsagePercent = (totalTokens / limit) * 100;

    if (exceedsLimit) {
      logWarn('tokenManagement', 'Token estimate exceeds safe limit', {
        totalTokens,
        limit,
        usagePercent: limitUsagePercent.toFixed(1),
      });
    }

    return {
      totalTokens,
      inputTokens,
      outputTokens,
      breakdown,
      exceedsLimit,
      limitUsagePercent,
    };
  }

  /**
   * Calculate token budget for a request
   */
  calculateTokenBudget(
    model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4' | 'gpt-3.5-turbo' = 'gpt-4o',
    template?: DoctorTemplate
  ): TokenBudget {
    const maxTotalTokens = this.SAFE_LIMITS[model];

    // Reserve 30% for output
    const maxOutputTokens = Math.floor(maxTotalTokens * 0.3);
    const maxInputTokens = maxTotalTokens - maxOutputTokens;

    // Allocate input budget
    const allocated = {
      systemPrompt: 500, // Base system prompt
      transcript: 0, // Will be calculated
      templateInstructions: 0,
      patientContext: 100,
      additionalContext: 200,
      outputBuffer: maxOutputTokens,
    };

    // Calculate template instruction allocation
    if (template) {
      let instructionChars = 0;
      if (template.generalInstructions) {
        instructionChars += template.generalInstructions.length;
      }
      Object.values(template.sections).forEach(section => {
        if (section.aiInstructions) {
          instructionChars += section.aiInstructions.length;
        }
      });
      allocated.templateInstructions = Math.ceil(instructionChars / this.CHARS_PER_TOKEN);
    }

    // Calculate remaining budget for transcript
    const usedBudget =
      allocated.systemPrompt +
      allocated.templateInstructions +
      allocated.patientContext +
      allocated.additionalContext;

    allocated.transcript = Math.max(0, maxInputTokens - usedBudget);

    const remaining = maxInputTokens - usedBudget;

    logDebug('tokenManagement', 'Token budget calculated', {
      model,
      maxTotalTokens,
      maxInputTokens,
      maxOutputTokens,
      remaining,
    });

    return {
      maxTotalTokens,
      maxInputTokens,
      maxOutputTokens,
      allocated,
      remaining,
    };
  }

  /**
   * Intelligently truncate transcript if it exceeds token budget
   */
  truncateTranscript(
    transcript: string,
    maxTokens: number,
    strategy: 'sliding-window' | 'smart-summary' | 'section-priority' = 'smart-summary'
  ): TruncationResult {
    const originalLength = transcript.length;
    const estimatedTokens = this.estimateTokens(transcript, true);

    if (estimatedTokens <= maxTokens) {
      return {
        truncated: false,
        originalLength,
        truncatedLength: originalLength,
        truncatedText: transcript,
        method: 'none',
        tokensRemoved: 0,
      };
    }

    logInfo('tokenManagement', 'Truncating transcript', {
      originalTokens: estimatedTokens,
      maxTokens,
      strategy,
    });

    let truncatedText: string;
    let method: TruncationResult['method'];

    switch (strategy) {
      case 'sliding-window':
        // Take last N characters to fit token budget
        truncatedText = this.truncateSlidingWindow(transcript, maxTokens);
        method = 'sliding-window';
        break;

      case 'smart-summary':
        // Extract key medical information
        truncatedText = this.truncateSmartSummary(transcript, maxTokens);
        method = 'smart-summary';
        break;

      case 'section-priority':
        // Prioritize important sections (chief complaint, assessment, plan)
        truncatedText = this.truncateSectionPriority(transcript, maxTokens);
        method = 'section-priority';
        break;

      default:
        truncatedText = this.truncateSlidingWindow(transcript, maxTokens);
        method = 'sliding-window';
    }

    const truncatedLength = truncatedText.length;
    const tokensRemoved = estimatedTokens - this.estimateTokens(truncatedText, true);

    logWarn('tokenManagement', 'Transcript truncated', {
      method,
      originalLength,
      truncatedLength,
      tokensRemoved,
    });

    return {
      truncated: true,
      originalLength,
      truncatedLength,
      truncatedText,
      method,
      tokensRemoved,
    };
  }

  /**
   * Sliding window truncation - take last N chars
   */
  private truncateSlidingWindow(text: string, maxTokens: number): string {
    const maxChars = maxTokens * this.CHARS_PER_TOKEN;

    if (text.length <= maxChars) {
      return text;
    }

    // Take last maxChars, but try to start at a sentence boundary
    const truncated = text.slice(-maxChars);
    const firstPeriod = truncated.indexOf('. ');

    if (firstPeriod > 0 && firstPeriod < 200) {
      return '...' + truncated.slice(firstPeriod + 2);
    }

    return '...' + truncated;
  }

  /**
   * Smart summary truncation - extract key medical info
   */
  private truncateSmartSummary(text: string, maxTokens: number): string {
    const maxChars = maxTokens * this.CHARS_PER_TOKEN;

    // Extract sentences with medical terms
    const sentences = text.split(/\.\s+/);
    const scoredSentences = sentences.map(sentence => {
      const score = this.scoreSentenceImportance(sentence);
      return { sentence, score };
    });

    // Sort by importance
    scoredSentences.sort((a, b) => b.score - a.score);

    // Take top sentences until we hit character limit
    let summary = '';
    for (const { sentence } of scoredSentences) {
      if ((summary.length + sentence.length + 2) > maxChars) {
        break;
      }
      summary += sentence + '. ';
    }

    return summary.trim() || this.truncateSlidingWindow(text, maxTokens);
  }

  /**
   * Score sentence importance based on medical content
   */
  private scoreSentenceImportance(sentence: string): number {
    let score = 0;
    const lower = sentence.toLowerCase();

    // High priority terms
    if (
      lower.includes('chief complaint') ||
      lower.includes('diagnosis') ||
      lower.includes('plan') ||
      lower.includes('assessment')
    ) {
      score += 10;
    }

    // Medications
    if (lower.includes('mg') || lower.includes('mcg') || lower.includes('medication')) {
      score += 5;
    }

    // Medical conditions
    const conditions = ['diabetes', 'hypertension', 'thyroid', 'cardiac', 'pulmonary'];
    for (const condition of conditions) {
      if (lower.includes(condition)) {
        score += 3;
      }
    }

    // Lab values
    if (/\d+\/\d+/.test(sentence) || lower.includes('a1c') || lower.includes('glucose')) {
      score += 4;
    }

    return score;
  }

  /**
   * Section priority truncation - preserve important sections
   */
  private truncateSectionPriority(text: string, maxTokens: number): string {
    const maxChars = maxTokens * this.CHARS_PER_TOKEN;

    // Try to identify sections
    const sectionPatterns = [
      { pattern: /chief complaint:.*?(?=\n\n|\n[A-Z]|$)/is, priority: 10 },
      { pattern: /assessment:.*?(?=\n\n|\n[A-Z]|$)/is, priority: 9 },
      { pattern: /plan:.*?(?=\n\n|\n[A-Z]|$)/is, priority: 8 },
      { pattern: /history of present illness:.*?(?=\n\n|\n[A-Z]|$)/is, priority: 7 },
      { pattern: /physical exam:.*?(?=\n\n|\n[A-Z]|$)/is, priority: 6 },
    ];

    const sections: Array<{ text: string; priority: number }> = [];

    for (const { pattern, priority } of sectionPatterns) {
      const match = text.match(pattern);
      if (match) {
        sections.push({ text: match[0], priority });
      }
    }

    // Sort by priority and build truncated text
    sections.sort((a, b) => b.priority - a.priority);

    let result = '';
    for (const section of sections) {
      if ((result.length + section.text.length + 2) > maxChars) {
        break;
      }
      result += section.text + '\n\n';
    }

    return result.trim() || this.truncateSlidingWindow(text, maxTokens);
  }

  /**
   * Optimize prompt by removing unnecessary content
   */
  optimizePrompt(prompt: string, targetReduction: number = 0.2): string {
    // Remove excessive whitespace
    let optimized = prompt.replace(/\n{3,}/g, '\n\n');
    optimized = optimized.replace(/  +/g, ' ');

    // Remove example sections if needed
    if (optimized.length > prompt.length * (1 - targetReduction)) {
      optimized = optimized.replace(/Example:.*?(?=\n\n|\n[A-Z]|$)/gis, '');
    }

    // Remove verbose instructions
    if (optimized.length > prompt.length * (1 - targetReduction)) {
      optimized = optimized.replace(
        /Please note that.*?(?=\n\n|\n[A-Z]|$)/gis,
        ''
      );
    }

    logDebug('tokenManagement', 'Prompt optimized', {
      originalLength: prompt.length,
      optimizedLength: optimized.length,
      reduction: ((prompt.length - optimized.length) / prompt.length * 100).toFixed(1) + '%',
    });

    return optimized.trim();
  }

  /**
   * Validate if request fits within token limits
   */
  validateTokenLimit(
    estimate: TokenEstimate,
    model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4' | 'gpt-3.5-turbo' = 'gpt-4o'
  ): {
    valid: boolean;
    message?: string;
    recommendation?: string;
  } {
    const limit = this.SAFE_LIMITS[model];

    if (!estimate.exceedsLimit) {
      return { valid: true };
    }

    const overage = estimate.totalTokens - limit;
    const overpercent = (overage / limit * 100).toFixed(1);

    return {
      valid: false,
      message: `Request exceeds token limit by ${overage} tokens (${overpercent}%)`,
      recommendation: 'Consider enabling transcript truncation or using a simpler template',
    };
  }

  /**
   * Get user-friendly token usage report
   */
  getTokenUsageReport(estimate: TokenEstimate): string {
    const lines = [
      `Token Usage: ${estimate.totalTokens.toLocaleString()} (${estimate.limitUsagePercent.toFixed(1)}% of limit)`,
      `Input: ${estimate.inputTokens.toLocaleString()} | Output: ${estimate.outputTokens.toLocaleString()}`,
      '',
      'Breakdown:',
      `  Transcript: ${estimate.breakdown.transcript.toLocaleString()}`,
      `  Template: ${estimate.breakdown.templateInstructions.toLocaleString()}`,
      `  System: ${estimate.breakdown.systemPrompt.toLocaleString()}`,
      `  Output: ${estimate.breakdown.expectedOutput.toLocaleString()}`,
    ];

    if (estimate.exceedsLimit) {
      lines.push('', '⚠️  WARNING: Token limit exceeded');
    }

    return lines.join('\n');
  }
}

export const tokenManagementService = new TokenManagementService();
