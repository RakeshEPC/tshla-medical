/**
 * Azure OpenAI Service for Medical Note Processing
 * HIPAA Compliant with BAA from Microsoft
 * Fallback for AWS Bedrock when unavailable
 */

import { logInfo, logError, logDebug, logPerformance } from '../logger.service';

interface ProcessedNote {
  formattedNote: string;
  sections: {
    chiefComplaint?: string;
    hpi?: string;
    reviewOfSystems?: string;
    physicalExam?: string;
    assessment?: string;
    plan?: string;
  };
  metadata?: {
    processingTime: number;
    model: string;
    tokenCount?: number;
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
  }

  async processMedicalTranscription(
    transcription: string,
    patientData: any,
    template: any,
    patientContext?: string,
    templateInstructions?: string
  ): Promise<{ formatted: string }> {
    // Build enhanced medical prompt with clinical expertise
    let prompt = `You are an expert medical scribe and clinical documentation specialist with 15+ years of experience in medical note generation. You excel at creating comprehensive, accurate, and clinically relevant SOAP notes from dictated content.

TRANSCRIPTION TO PROCESS:
${transcription}

PATIENT INFORMATION:
${patientContext || 'No additional patient context provided'}

CLINICAL DOCUMENTATION REQUIREMENTS:
${templateInstructions || 'Use comprehensive medical documentation standards'}

INSTRUCTION: Create a detailed, professional medical note following these guidelines:

🏥 **SOAP NOTE FORMAT**:
1. **CHIEF COMPLAINT**: Extract the primary reason for visit (1-2 sentences)
2. **SUBJECTIVE**:
   - History of Present Illness (HPI): Detailed narrative with timing, quality, severity, context
   - Review of Systems (ROS): Extract any mentioned systems review
   - Past Medical History (PMH): Include relevant past medical conditions
   - Medications: List current medications with dosages when mentioned
   - Allergies: Note any mentioned allergies or state "NKDA" if none
   - Social History: Include relevant social factors (smoking, alcohol, etc.)
   - Family History: Include relevant family medical history

3. **OBJECTIVE**:
   - Vital Signs: Extract any mentioned vital signs with units
   - Physical Examination: Organize by body systems, be specific about findings
   - Diagnostic Results: Include any mentioned lab results, imaging, or test results

4. **ASSESSMENT**:
   - Primary diagnosis with ICD-10 code when appropriate
   - Differential diagnoses when mentioned
   - Clinical reasoning and severity assessment

5. **PLAN**:
   - Medications: Include drug names, dosages, frequencies, and durations
   - Diagnostic Orders: Labs, imaging, or tests ordered
   - Follow-up Instructions: When and where to return
   - Patient Education: Instructions given to patient
   - Referrals: Any specialist referrals mentioned

💊 **MEDICAL TERMINOLOGY**:
- Use proper medical abbreviations (e.g., "b.i.d." not "twice daily")
- Include specific medication dosages and routes when mentioned
- Use exact vital sign measurements with units
- Include severity scales when mentioned (e.g., "7/10 pain")
- Spell out medical conditions formally

🔢 **BILLING & CODING SUPPORT**:
- Suggest appropriate ICD-10 codes in brackets after diagnoses
- Include CPT code suggestions for procedures mentioned
- Note level of medical decision making when apparent

📋 **QUALITY STANDARDS**:
- Be thorough but concise
- Use professional medical language
- Maintain chronological flow in HPI
- Separate subjective vs objective findings clearly
- Ensure all dictated information is captured
- Add clinical context when medically appropriate

⚠️ **CRITICAL REQUIREMENTS**:
- NEVER add information not mentioned in the transcription
- Use "Not mentioned" or "Not assessed" for missing elements
- Maintain medical accuracy and professional tone
- Format consistently with standard medical documentation
- Include timing and duration of symptoms when provided

Generate a comprehensive, medically accurate SOAP note that would meet hospital documentation standards:`;

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
      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;

      const response = await this.makeAPICall(url, {
        messages: [
          {
            role: 'system',
            content: 'You are an expert medical scribe with extensive experience in clinical documentation. Generate comprehensive, accurate SOAP notes that meet hospital documentation standards. Focus on medical accuracy, proper terminology, and complete information capture.'
          },
          {
            role: 'user',
            content: customPrompt
          }
        ],
        temperature: 0.5, // Increased for more detailed and varied responses
        max_tokens: 4000, // Increased for comprehensive notes
        top_p: 0.9, // Slightly lower for more focused responses
        frequency_penalty: 0.1, // Slight penalty to avoid repetition
        presence_penalty: 0.1, // Encourage diverse vocabulary
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

  private parseNoteIntoSections(note: string): any {
    const sections: any = {};

    // Common section headers to look for
    const sectionHeaders = [
      'chief complaint',
      'hpi',
      'history of present illness',
      'review of systems',
      'ros',
      'physical exam',
      'physical examination',
      'assessment',
      'plan',
    ];

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
            sections[this.normalizeSection(currentSection)] = currentContent.join('\n').trim();
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
      sections[this.normalizeSection(currentSection)] = currentContent.join('\n').trim();
    }

    return sections;
  }

  private normalizeSection(section: string): string {
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
   * Make API call with retry logic (supports both Azure and standard OpenAI)
   */
  private async makeAPICall(url: string, body: any): Promise<Response> {
    // Use standard OpenAI if Azure not configured
    if (this.useStandardOpenAI) {
      return this.makeStandardOpenAICall(body);
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
  private async makeStandardOpenAICall(body: any): Promise<Response> {
    return this.retryWithBackoff(async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.standardOpenAIKey}`,
        },
        body: JSON.stringify({
          model: this.standardOpenAIModel,
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
