/**
 * Azure OpenAI Service for Medical Note Processing
 * HIPAA Compliant with BAA from Microsoft
 * Fallback for AWS Bedrock when unavailable
 */

import { logInfo, logError, logDebug, logPerformance, logWarn } from '../logger.service';
import { modelSelectionService, type ComplexityScore, AIModel } from '../modelSelection.service';
import type { DoctorTemplate } from '../doctorProfile.service';
import { tokenManagementService } from '../tokenManagement.service';
import { promptVersionControlService } from '../promptVersionControl.service';

interface ProcessedNote {
  formattedNote: string;
  sections: {
    chiefComplaint?: string;
    hpi?: string;
    reviewOfSystems?: string;
    physicalExam?: string;
    assessment?: string;
    plan?: string;
    medications?: string;
    priorAuth?: string;
    patientSummary?: string;
    thyroidUsFna?: string;
    [key: string]: string | undefined; // Allow any custom section
  };
  metadata?: {
    processingTime: number;
    model: string;
    tokenCount?: number;
    complexityLevel?: string;
    complexityScore?: number;
    tokenEstimate?: number;
    tokenWarning?: string;
    transcriptTruncated?: boolean;
    promptVersionId?: string;
    promptVersion?: string;
  };
}

class AzureOpenAIService {
  private endpoint: string;
  private apiKey: string;
  private deploymentName: string;
  private apiVersion = '2024-02-01';
  private useStandardOpenAI = false;
  private standardOpenAIKey: string;
  private standardOpenAIModel: string;

  constructor() {
    // Azure OpenAI configuration - PRODUCTION ENVIRONMENT
    this.endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
    this.apiKey = import.meta.env.VITE_AZURE_OPENAI_KEY;
    this.deploymentName = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    this.apiVersion = import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-01';

    // Standard OpenAI fallback configuration
    this.standardOpenAIKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    this.standardOpenAIModel = import.meta.env.VITE_OPENAI_MODEL_STAGE5 || 'gpt-4o';

    // If Azure not configured, use standard OpenAI
    if ((!this.endpoint || !this.apiKey) && this.standardOpenAIKey) {
      this.useStandardOpenAI = true;
      logInfo('AzureOpenAI', 'Azure OpenAI not configured, using standard OpenAI API as fallback', {
        model: this.standardOpenAIModel
      });
    }

    // Log configuration for debugging (without exposing keys)
    logDebug('AzureOpenAI', 'Service initialization', {
      useStandardOpenAI: this.useStandardOpenAI,
      hasAzureEndpoint: !!this.endpoint,
      hasAzureApiKey: !!this.apiKey,
      hasStandardAPIKey: !!this.standardOpenAIKey,
      deploymentName: this.deploymentName,
      apiVersion: this.apiVersion,
      endpointUrl: this.endpoint ? this.endpoint.substring(0, 30) + '...' : 'not set'
    });

    // Validate required environment variables - Don't throw, just log warning
    if (!this.useStandardOpenAI) {
      if (!this.endpoint) {
        logError('AzureOpenAI', 'VITE_AZURE_OPENAI_ENDPOINT environment variable is required', {});
      }
      if (!this.apiKey) {
        logError('AzureOpenAI', 'VITE_AZURE_OPENAI_KEY environment variable is required', {});
      }
    }

    // Initialize prompt version control
    promptVersionControlService.initializeDefaultVersions();
  }

  async processMedicalTranscription(
    transcription: string,
    patientData: any,
    template: any,
    patientContext?: string,
    templateInstructions?: string
  ): Promise<{ formatted: string }> {
    // Build simplified, focused medical prompt
    let prompt = `You are an expert medical scribe. Create a professional medical note from this dictation.

${templateInstructions ? `TEMPLATE INSTRUCTIONS (follow these exactly):\n${templateInstructions}\n` : ''}
PATIENT CONTEXT:
${patientContext || 'No additional context provided'}

TRANSCRIPTION:
"${transcription}"

CORE RULES:
1. Extract ONLY information explicitly stated in the transcription
2. Never add information not mentioned - use "Not mentioned" for missing sections
3. Include exact numeric values (e.g., blood sugar 400, A1C 9.5, age 45)
4. Use professional medical terminology and standard abbreviations
5. Format as clear SOAP note with distinct sections

Generate the formatted medical note now:`;

    const result = await this.processTranscriptionWithCustomPrompt(
      transcription,
      prompt,
      patientData
    );
    return { formatted: result.formattedNote };
  }

  async processTranscriptionWithCustomPrompt(
    transcription: string,
    customPrompt: string,
    patientContext?: {
      name?: string;
      mrn?: string;
      dob?: string;
    },
    template?: DoctorTemplate,
    additionalContext?: string
  ): Promise<ProcessedNote> {
    const startTime = Date.now();

    // Check if neither Azure nor standard OpenAI is configured
    if (!this.useStandardOpenAI && (!this.endpoint || !this.apiKey)) {
      logError('AzureOpenAI', 'No AI service configured', {
        hasAzureEndpoint: !!this.endpoint,
        hasAzureApiKey: !!this.apiKey,
        hasStandardAPIKey: !!this.standardOpenAIKey
      });
      // Return fallback instead of throwing
      return this.createBasicFormattedNote(transcription, patientContext);
    }

    try {
      // Calculate complexity and select optimal model
      const complexity = modelSelectionService.calculateComplexity(
        transcription,
        template,
        additionalContext
      );

      logInfo('AzureOpenAI', modelSelectionService.getModelExplanation(complexity), {
        complexityLevel: complexity.level,
        score: complexity.score,
        estimatedTokens: complexity.factors.estimatedTokens
      });

      // Select model based on complexity
      const selectedModel = this.getModelForComplexity(complexity.recommendedModel);

      // Estimate tokens for the request
      const systemPromptLength = 200; // Approximate system prompt length
      const tokenEstimate = tokenManagementService.estimateRequestTokens(
        transcription,
        template,
        patientContext ? `${patientContext.name} ${patientContext.mrn}` : undefined,
        additionalContext,
        customPrompt.length + systemPromptLength
      );

      logDebug('AzureOpenAI', 'Token estimate', {
        totalTokens: tokenEstimate.totalTokens,
        inputTokens: tokenEstimate.inputTokens,
        limitUsage: `${tokenEstimate.limitUsagePercent.toFixed(1)}%`
      });

      // Check if we need to truncate
      let processedTranscription = transcription;
      let transcriptTruncated = false;
      let tokenWarning: string | undefined;

      if (tokenEstimate.exceedsLimit) {
        // Calculate available tokens for transcript
        const tokenBudget = tokenManagementService.calculateTokenBudget(
          selectedModel === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o',
          template
        );

        logWarn('AzureOpenAI', 'Token limit exceeded, truncating transcript', {
          originalTokens: tokenEstimate.totalTokens,
          budgetedTranscriptTokens: tokenBudget.allocated.transcript
        });

        // Truncate transcript using smart summary strategy
        const truncationResult = tokenManagementService.truncateTranscript(
          transcription,
          tokenBudget.allocated.transcript,
          'smart-summary'
        );

        processedTranscription = truncationResult.truncatedText;
        transcriptTruncated = truncationResult.truncated;
        tokenWarning = truncationResult.truncated
          ? `Transcript truncated: Removed ${truncationResult.tokensRemoved} tokens to fit within limits`
          : undefined;
      }

      const url = `${this.endpoint}/openai/deployments/${selectedModel}/chat/completions?api-version=${this.apiVersion}`;

      // Select prompt version for this request
      const promptVersion = template
        ? promptVersionControlService.selectVersionForRequest('custom-template')
        : promptVersionControlService.selectVersionForRequest('system');

      // Update custom prompt to use processed transcription if truncated
      const finalPrompt = transcriptTruncated
        ? customPrompt.replace(transcription, processedTranscription)
        : customPrompt;

      // Use versioned system prompt if available
      const systemPromptContent = promptVersion
        ? promptVersionControlService.renderPrompt(promptVersion.id, {}) ||
          'You are an expert medical scribe with extensive experience in clinical documentation. Generate comprehensive, accurate SOAP notes that meet hospital documentation standards. Focus on medical accuracy, proper terminology, and complete information capture.'
        : 'You are an expert medical scribe with extensive experience in clinical documentation. Generate comprehensive, accurate SOAP notes that meet hospital documentation standards. Focus on medical accuracy, proper terminology, and complete information capture.';

      const response = await this.makeAPICall(url, {
        messages: [
          {
            role: 'system',
            content: systemPromptContent
          },
          {
            role: 'user',
            content: finalPrompt
          }
        ],
        temperature: 0.5, // Increased for more detailed and varied responses
        max_tokens: 4000, // Increased for comprehensive notes
        top_p: 0.9, // Slightly lower for more focused responses
        frequency_penalty: 0.1, // Slight penalty to avoid repetition
        presence_penalty: 0.1, // Encourage diverse vocabulary
      }, selectedModel);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Azure OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const formattedNote = data.choices[0].message.content;

      // Parse the note into sections - use template if provided for custom sections
      const sections = this.parseNoteIntoSections(formattedNote, template);

      const processingTime = Date.now() - startTime;
      const actualTokens = data.usage?.total_tokens || 0;

      // Record prompt usage
      if (promptVersion) {
        promptVersionControlService.recordUsage({
          versionId: promptVersion.id,
          success: true,
          qualityScore: 0.9, // Will be updated based on validation
          processingTime,
          tokenUsage: actualTokens,
          templateId: template?.id,
          modelUsed: selectedModel
        });
      }

      return {
        formattedNote,
        sections,
        metadata: {
          processingTime,
          model: `Azure OpenAI ${selectedModel}`,
          tokenCount: actualTokens,
          complexityLevel: complexity.level,
          complexityScore: complexity.score,
          tokenEstimate: tokenEstimate.totalTokens,
          tokenWarning,
          transcriptTruncated,
          promptVersionId: promptVersion?.id,
          promptVersion: promptVersion?.version
        },
      };
    } catch (error) {
      logError('AzureOpenAI', 'Custom prompt processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hasTranscription: !!transcription,
        hasPatientContext: !!patientContext,
      });

      // Return a basic formatted version as fallback
      return this.createBasicFormattedNote(transcription, patientContext);
    }
  }

  async processTranscription(
    transcription: string,
    template: string,
    patientContext?: {
      name?: string;
      mrn?: string;
      dob?: string;
    }
  ): Promise<ProcessedNote> {
    const startTime = Date.now();

    // Check if neither Azure nor standard OpenAI is configured
    if (!this.useStandardOpenAI && (!this.endpoint || !this.apiKey)) {
      logError('AzureOpenAI', 'No AI service configured', {
        hasAzureEndpoint: !!this.endpoint,
        hasAzureApiKey: !!this.apiKey,
        hasStandardAPIKey: !!this.standardOpenAIKey
      });
      // Return fallback instead of throwing
      return this.createBasicFormattedNote(transcription, patientContext);
    }

    try {
      const systemPrompt = this.createSystemPrompt(template);
      const userPrompt = this.createUserPrompt(transcription, patientContext);

      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;

      const response = await this.makeAPICall(url, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent medical notes
        max_tokens: 2000,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Azure OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const formattedNote = data.choices[0].message.content;

      // Parse the note into sections
      const sections = this.parseNoteIntoSections(formattedNote);

      return {
        formattedNote,
        sections,
        metadata: {
          processingTime: Date.now() - startTime,
          model: `Azure OpenAI ${this.deploymentName}`,
          tokenCount: data.usage?.total_tokens,
        },
      };
    } catch (error) {
      logError('AzureOpenAI', 'Note processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transcriptionLength: transcription?.length || 0,
        templateLength: template?.length || 0,
        hasPatientContext: !!patientContext,
      });

      // Return a basic formatted version as fallback
      return this.createBasicFormattedNote(transcription, patientContext);
    }
  }

  private createSystemPrompt(template: string): string {
    return `You are a medical scribe assistant. Create a clean, professional medical note from the provided transcription.

CRITICAL: Your response must ONLY contain the medical note content - no instructions, explanations, or meta-commentary.

Requirements:
- Format as proper SOAP note
- Preserve all medical information 
- Correct obvious medical terminology errors
- Use standard medical abbreviations
- Professional medical language only

Template: ${template}

Output only the formatted medical note with clear section headers (Chief Complaint, HPI, Review of Systems, Physical Exam, Assessment, Plan). Do not include any instructions or explanations in your response.`;
  }

  private createUserPrompt(transcription: string, patientContext?: any): string {
    let prompt = '';

    if (patientContext?.name || patientContext?.mrn) {
      prompt += 'Patient Information:\n';
      if (patientContext.name) prompt += `Name: ${patientContext.name}\n`;
      if (patientContext.mrn) prompt += `MRN: ${patientContext.mrn}\n`;
      if (patientContext.dob) prompt += `DOB: ${patientContext.dob}\n`;
      prompt += '\n';
    }

    prompt += `Medical Transcription:\n${transcription}`;

    return prompt;
  }

  private parseNoteIntoSections(note: string, template?: DoctorTemplate): any {
    const sections: any = {};

    // Build section headers list from template if provided, otherwise use defaults
    let sectionHeaders: string[] = [];

    if (template && template.sections) {
      // Extract section titles from custom template
      Object.entries(template.sections).forEach(([_key, section]) => {
        if (section.title) {
          sectionHeaders.push(section.title.toLowerCase());
        }
      });

      logDebug('AzureOpenAI', 'Parsing with custom template sections', {
        templateName: template.name,
        sectionCount: sectionHeaders.length
      });
    }

    // Add common section headers as fallback
    const defaultHeaders = [
      'chief complaint',
      'hpi',
      'history of present illness',
      'review of systems',
      'ros',
      'physical exam',
      'physical examination',
      'assessment',
      'plan',
      'medications',
      'prior auth',
      'prior authorization',
      'patient summary',
      'thyroid us fna',
      'thyroid ultrasound',
      'fna',
    ];

    // Combine custom and default headers (custom takes priority)
    sectionHeaders = [...new Set([...sectionHeaders, ...defaultHeaders])];

    const lines = note.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      let foundSection = false;

      for (const header of sectionHeaders) {
        if (lowerLine.includes(header)) {
          // Save previous section
          if (currentSection && currentContent.length > 0) {
            sections[this.normalizeSection(currentSection, template)] = currentContent.join('\n').trim();
          }

          currentSection = header;
          currentContent = [line];
          foundSection = true;
          break;
        }
      }

      if (!foundSection && currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections[this.normalizeSection(currentSection, template)] = currentContent.join('\n').trim();
    }

    return sections;
  }

  private normalizeSection(section: string, template?: DoctorTemplate): string {
    // First, check if this section exists in the custom template
    if (template && template.sections) {
      for (const [key, templateSection] of Object.entries(template.sections)) {
        if (templateSection.title && templateSection.title.toLowerCase() === section.toLowerCase()) {
          return key; // Return the template section key
        }
      }
    }

    // Standard mapping for common sections
    const mapping: { [key: string]: string } = {
      'chief complaint': 'chiefComplaint',
      hpi: 'hpi',
      'history of present illness': 'hpi',
      'review of systems': 'reviewOfSystems',
      ros: 'reviewOfSystems',
      'physical exam': 'physicalExam',
      'physical examination': 'physicalExam',
      assessment: 'assessment',
      plan: 'plan',
      medications: 'medications',
      'prior auth': 'priorAuth',
      'prior authorization': 'priorAuth',
      'patient summary': 'patientSummary',
      'thyroid us fna': 'thyroidUsFna',
      'thyroid ultrasound': 'thyroidUltrasound',
      fna: 'fna',
    };

    return mapping[section.toLowerCase()] || section;
  }

  private createBasicFormattedNote(transcription: string, patientContext?: any): ProcessedNote {
    // Fallback formatting when API fails
    let formattedNote = '';

    if (patientContext?.name || patientContext?.mrn) {
      formattedNote += 'PATIENT INFORMATION\n';
      if (patientContext.name) formattedNote += `Name: ${patientContext.name}\n`;
      if (patientContext.mrn) formattedNote += `MRN: ${patientContext.mrn}\n`;
      if (patientContext.dob) formattedNote += `DOB: ${patientContext.dob}\n`;
      formattedNote += '\n';
    }

    formattedNote += 'CLINICAL NOTE\n\n';
    formattedNote += transcription;

    return {
      formattedNote,
      sections: {
        chiefComplaint: '',
        hpi: transcription,
        reviewOfSystems: '',
        physicalExam: '',
        assessment: '',
        plan: '',
      },
      metadata: {
        processingTime: 0,
        model: 'Basic Formatter (API Unavailable)',
      },
    };
  }

  /**
   * Process conversational prompts (non-medical note format)
   * For pump recommendations, follow-up questions, etc.
   */
  async processConversationalPrompt(prompt: string): Promise<string> {
    const startTime = performance.now();

    // Check if neither Azure nor standard OpenAI is configured
    if (!this.useStandardOpenAI && (!this.endpoint || !this.apiKey)) {
      logError('AzureOpenAI', 'No AI service configured for conversational prompt', {
        hasAzureEndpoint: !!this.endpoint,
        hasAzureApiKey: !!this.apiKey,
        hasStandardAPIKey: !!this.standardOpenAIKey
      });
      // Return a helpful fallback response
      return "I understand your question about pump selection. Let me help you find the best option based on your needs.";
    }

    try {
      logDebug('AzureOpenAI', 'Processing conversational prompt', {
        promptLength: prompt.length,
        model: this.deploymentName
      });

      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
      const response = await this.makeAPICall(url, {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content;

      if (!result) {
        throw new Error('No response from Azure OpenAI');
      }

      const processingTime = performance.now() - startTime;

      logInfo('AzureOpenAI', 'Successfully processed conversational prompt', {
        processingTime: Math.round(processingTime),
        model: this.deploymentName,
        tokenCount: data.usage?.total_tokens
      });

      return result.trim();

    } catch (error) {
      const processingTime = performance.now() - startTime;
      logError('AzureOpenAI', 'Failed to process conversational prompt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Math.round(processingTime)
      });

      // Return fallback response instead of throwing
      return "I'm having trouble processing your question right now, but I can help you understand your pump recommendation. Please try again or contact support if the issue persists.";
    }
  }

  /**
   * Retry utility with exponential backoff for handling rate limits
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error (429)
        if (error instanceof Error && error.message.includes('429')) {
          const delay = initialDelay * Math.pow(2, attempt);
          logInfo('AzureOpenAI', `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`, {});

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // For non-rate-limit errors, don't retry
        if (attempt === 0 && !error.message.includes('429')) {
          throw error;
        }

        // If we've exhausted retries, throw the last error
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }

    throw lastError!;
  }

  /**
   * Map AI model enum to actual deployment/model name
   */
  private getModelForComplexity(recommendedModel: AIModel): string {
    if (this.useStandardOpenAI) {
      // For standard OpenAI API
      if (recommendedModel === AIModel.GPT4O_MINI) {
        return 'gpt-4o-mini';
      } else {
        return this.standardOpenAIModel; // gpt-4o or configured model
      }
    } else {
      // For Azure OpenAI, use deployment names
      // Assuming deployments are named similarly to models
      if (recommendedModel === AIModel.GPT4O_MINI) {
        return 'gpt-4o-mini'; // Azure deployment for mini model
      } else {
        return this.deploymentName; // Default to gpt-4o deployment
      }
    }
  }

  /**
   * Make API call with retry logic (supports both Azure and standard OpenAI)
   */
  private async makeAPICall(url: string, body: any, selectedModel?: string): Promise<Response> {
    // Use standard OpenAI if Azure not configured
    if (this.useStandardOpenAI) {
      return this.makeStandardOpenAICall(body, selectedModel);
    }

    return this.retryWithBackoff(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        const rateLimitError = new Error(`Rate limited: ${response.status}`);
        (rateLimitError as any).status = 429;
        throw rateLimitError;
      }

      if (!response.ok) {
        const apiError = new Error(`API call failed: ${response.status} ${response.statusText}`);
        (apiError as any).status = response.status;
        throw apiError;
      }

      return response;
    });
  }

  /**
   * Make standard OpenAI API call
   */
  private async makeStandardOpenAICall(body: any, selectedModel?: string): Promise<Response> {
    const modelToUse = selectedModel || this.standardOpenAIModel;

    return this.retryWithBackoff(async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.standardOpenAIKey}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: body.messages,
          temperature: body.temperature,
          max_tokens: body.max_tokens,
          top_p: body.top_p,
          frequency_penalty: body.frequency_penalty,
          presence_penalty: body.presence_penalty,
        }),
      });

      if (response.status === 429) {
        const rateLimitError = new Error(`Rate limited: ${response.status}`);
        (rateLimitError as any).status = 429;
        throw rateLimitError;
      }

      if (!response.ok) {
        const errorText = await response.text();
        const apiError = new Error(`OpenAI API call failed: ${response.status} - ${errorText}`);
        (apiError as any).status = response.status;
        throw apiError;
      }

      return response;
    });
  }

  // Test method to verify Azure OpenAI is working
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.processTranscription(
        'Patient has diabetes with A1C of 9.5',
        'Standard SOAP Note',
        { name: 'Test Patient' }
      );

      logInfo('AzureOpenAI', 'Connection test successful', {
        processingTime: result.metadata?.processingTime,
        model: result.metadata?.model,
        tokenCount: result.metadata?.tokenCount,
      });
      return true;
    } catch (error) {
      logError('AzureOpenAI', 'Connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

export const azureOpenAIService = new AzureOpenAIService();
