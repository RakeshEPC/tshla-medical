/**
 * AWS Bedrock Service for HIPAA-Compliant AI Processing
 * Uses Claude 3 for medical note generation
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Template } from '../types/template.types';
import type { PatientData } from './patientData.service';
import { specialtyService } from './specialty.service';
import type { DoctorTemplate, DoctorSettings } from './doctorProfile.service';
import { calculateAge } from '../utils/date';
import { orderExtractionService, type OrderExtractionResult } from './orderExtraction.service';
import { azureOpenAIService } from './_deprecated/azureOpenAI.service';
import { localFallbackService } from './localFallback.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface ProcessedNote {
  formatted: string;
  sections: {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    reviewOfSystems?: string;
    pastMedicalHistory?: string;
    medications?: string;
    allergies?: string;
    socialHistory?: string;
    familyHistory?: string;
    physicalExam?: string;
    assessment?: string;
    plan?: string;
    ordersAndActions?: string;  // New section for extracted orders
    patientSummary?: string;    // New 2-3 sentence summary
  };
  extractedOrders?: OrderExtractionResult;  // Raw extracted orders data
  metadata?: {
    processedAt: string;
    model: string;
    confidence?: number;
  };
}

class BedrockService {
  private client: BedrockRuntimeClient;
  // MIGRATION PHASE 2: Intelligent provider selection with fallbacks
  private primaryProvider = 'azure'; // Azure OpenAI is primary
  private modelId = 'us.anthropic.claude-opus-4-1-20250805-v1:0'; // AWS Bedrock fallback model
  private fallbackModelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0'; // AWS Bedrock secondary fallback
  private workingModelId: string | null = null;
  private migrationMode = false; // Migration complete - enable intelligent fallbacks
  private providerStatus = {
    azure: { available: true, lastError: null as Error | null, lastChecked: 0 },
    bedrock: { available: true, lastError: null as Error | null, lastChecked: 0 },
    local: { available: true, lastError: null as Error | null, lastChecked: 0 }
  };

  constructor() {
    if (this.migrationMode) {
      logInfo('bedrock', 'Info message', {});
      logInfo('bedrock', 'Info message', {});
      logDebug('bedrock', 'Debug message', {});
      logDebug('bedrock', 'Debug message', {});
      logDebug('bedrock', 'Debug message', {});
    }
    
    const bearerToken = import.meta.env.VITE_AWS_BEARER_TOKEN_BEDROCK;
    
    // Check if we have standard AWS credentials first
    if (import.meta.env.VITE_AWS_ACCESS_KEY_ID && import.meta.env.VITE_AWS_SECRET_ACCESS_KEY) {
      logDebug('bedrock', 'Debug message', {});
      this.client = new BedrockRuntimeClient({
        region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY
        }
      });
    } else if (bearerToken) {
      // Bearer token authentication needs special handling
      logDebug('bedrock', 'Debug message', {});
      logWarn('bedrock', 'Warning message', {});
      
      // For browser-based Bearer token auth, we need a different approach
      // The Bearer token should be used in Authorization header
      this.client = new BedrockRuntimeClient({
        region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: 'dummy', // Required but not used with Bearer token
          secretAccessKey: 'dummy' // Required but not used with Bearer token
        },
        customUserAgent: 'BedrockAPIKey',
        // Add custom request handler for Bearer token
        requestHandler: {
          handle: async (request: any) => {
            request.headers['Authorization'] = `Bearer ${bearerToken}`;
            return request;
          }
        } as any
      });
    } else {
      logWarn('bedrock', 'Warning message', {});
      // Create a dummy client to avoid errors
      this.client = new BedrockRuntimeClient({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'not-configured',
          secretAccessKey: 'not-configured'
        }
      });
    }
  }

  /**
   * Process medical transcription into structured note with intelligent fallbacks
   * HIPAA COMPLIANT - Multiple providers with BAAs
   */
  async processMedicalTranscription(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    additionalContext?: string,
    customTemplate?: { template: DoctorTemplate; doctorSettings: DoctorSettings }
  ): Promise<ProcessedNote> {
    logInfo('bedrock', `Starting note processing with primary provider: ${this.primaryProvider}`);

    // Try Azure OpenAI first (Primary provider)
    if (this.providerStatus.azure.available) {
      try {
        logDebug('bedrock', 'Attempting Azure OpenAI processing');
        const azureResult = await this.processWithAzureOpenAI(transcript, patient, template, additionalContext, customTemplate);

        // Update provider status on success
        this.providerStatus.azure = { available: true, lastError: null, lastChecked: Date.now() };
        logInfo('bedrock', 'Azure OpenAI processing successful');

        return azureResult;
      } catch (azureError: any) {
        // Update provider status on failure
        this.providerStatus.azure = {
          available: false,
          lastError: azureError,
          lastChecked: Date.now()
        };
        logWarn('bedrock', `Azure OpenAI failed: ${azureError.message}, trying fallback`);
      }
    } else {
      logDebug('bedrock', 'Azure OpenAI marked as unavailable, skipping');
    }

    // Try AWS Bedrock fallback
    if (this.providerStatus.bedrock.available) {
      try {
        logDebug('bedrock', 'Attempting AWS Bedrock fallback processing');
        const bedrockResult = await this.processWithBedrock(transcript, patient, template, additionalContext, customTemplate);

        // Update provider status on success
        this.providerStatus.bedrock = { available: true, lastError: null, lastChecked: Date.now() };
        logInfo('bedrock', 'AWS Bedrock fallback processing successful');

        return bedrockResult;
      } catch (bedrockError: any) {
        // Update provider status on failure
        this.providerStatus.bedrock = {
          available: false,
          lastError: bedrockError,
          lastChecked: Date.now()
        };
        logWarn('bedrock', `AWS Bedrock failed: ${bedrockError.message}, trying local fallback`);
      }
    } else {
      logDebug('bedrock', 'AWS Bedrock marked as unavailable, skipping');
    }

    // Try local fallback as last resort
    try {
      logWarn('bedrock', 'All AI providers failed, using local template-based processing');
      const localResult = await localFallbackService.processMedicalTranscription(
        transcript,
        patient,
        template,
        additionalContext
      );

      // Update provider status
      this.providerStatus.local = { available: true, lastError: null, lastChecked: Date.now() };
      logInfo('bedrock', 'Local fallback processing completed');

      return localResult;
    } catch (localError: any) {
      this.providerStatus.local = {
        available: false,
        lastError: localError,
        lastChecked: Date.now()
      };
      logError('bedrock', `All processing methods failed: ${localError.message}`);

      // Return emergency note
      return this.createEmergencyNote(transcript, patient);
    }
  }

  /**
   * Process medical transcription using Azure OpenAI (Primary Provider)
   * HIPAA COMPLIANT - Covered by Microsoft BAA
   * Enhanced for Phase 1 Migration with improved template support
   */
  private async processWithAzureOpenAI(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    additionalContext?: string,
    customTemplate?: { template: DoctorTemplate; doctorSettings: DoctorSettings }
  ): Promise<ProcessedNote> {
    logInfo('bedrock', 'Info message', {});
    logDebug('bedrock', 'Debug message', {});
    
    // Build enhanced template string with AI instructions
    let templateString = 'Standard SOAP Note Format';
    let prompt = '';
    
    if (customTemplate) {
      // Use custom template with doctor's specific instructions
      prompt = this.buildCustomPrompt(transcript, patient, customTemplate.template, customTemplate.doctorSettings, additionalContext);
      templateString = customTemplate.template.name;
    } else if (template && template.sections) {
      // Use standard template with AI instructions
      prompt = this.buildPrompt(transcript, patient, template, additionalContext);
      templateString = template.name || 'Template-based SOAP Note';
    } else {
      // Default medical scribe prompt
      prompt = this.buildPrompt(transcript, patient, null, additionalContext);
      templateString = 'Standard Medical SOAP Note';
    }
    
    logInfo('bedrock', 'Info message', {});
    logDebug('bedrock', 'Debug message', {});
    
    try {
      // Pass only the transcript to Azure OpenAI, not the entire prompt
      const azureResult = await azureOpenAIService.processTranscription(
        transcript, // Pass original transcript only
        templateString,
        {
          name: patient.fullName,
          mrn: patient.mrn,
          dob: patient.dateOfBirth
        }
      );
      
      // Convert Azure OpenAI result to our ProcessedNote format
      const processedNote: ProcessedNote = {
        formatted: azureResult.formattedNote,
        sections: {
          chiefComplaint: azureResult.sections.chiefComplaint || '',
          historyOfPresentIllness: azureResult.sections.hpi || azureResult.sections.historyOfPresentIllness || '',
          reviewOfSystems: azureResult.sections.reviewOfSystems || azureResult.sections.ros || '',
          pastMedicalHistory: azureResult.sections.pastMedicalHistory || '',
          medications: azureResult.sections.medications || '',
          allergies: azureResult.sections.allergies || '',
          socialHistory: azureResult.sections.socialHistory || '',
          familyHistory: azureResult.sections.familyHistory || '',
          physicalExam: azureResult.sections.physicalExam || azureResult.sections.physicalExamination || '',
          assessment: azureResult.sections.assessment || '',
          plan: azureResult.sections.plan || ''
        },
        metadata: {
          processedAt: new Date().toISOString(),
          model: `Azure OpenAI ${azureResult.metadata?.model || 'GPT-4o'}`,
          confidence: 0.95
        }
      };

      // Extract orders from the AI-formatted note (NOT the raw transcript)
      // This ensures we extract from properly structured clinical text instead of messy conversation
      if (processedNote.formatted) {
        logDebug('bedrock', 'Extracting orders from formatted note');
        let extractedOrders = orderExtractionService.extractOrders(processedNote.formatted);

        // Enrich prior auth orders with detailed justifications from AI note
        if (extractedOrders && extractedOrders.priorAuths.length > 0) {
          extractedOrders = orderExtractionService.enrichPriorAuthOrders(extractedOrders, processedNote.formatted);
        }

        if (extractedOrders && (
          extractedOrders.medications.length > 0 ||
          extractedOrders.labs.length > 0 ||
          extractedOrders.imaging.length > 0 ||
          extractedOrders.priorAuths.length > 0 ||
          extractedOrders.referrals.length > 0
        )) {
          // Pass the AI-generated note to include detailed PA justifications
          const ordersAndActions = orderExtractionService.formatOrdersForTemplate(extractedOrders, processedNote.formatted);
          processedNote.sections.ordersAndActions = ordersAndActions;
          processedNote.extractedOrders = extractedOrders;
          processedNote.formatted += `\n\n**ORDERS & ACTIONS:**\n${ordersAndActions}`;
          logInfo('bedrock', 'Info message', {});
        }
      }

      logInfo('bedrock', 'Info message', {});
      logDebug('bedrock', 'Debug message', {});
      logDebug('bedrock', 'Debug message', {});
      
      return processedNote;
    } catch (azureError: any) {
      logError('bedrock', 'Error message', {});
      logDebug('bedrock', 'Debug message', {});
      throw azureError; // Re-throw to trigger fallback
    }
  }

  private buildCustomPrompt(
    transcript: string,
    patient: PatientData,
    template: DoctorTemplate,
    settings: DoctorSettings,
    additionalContext?: string
  ): string {
    // Build section instructions from doctor's custom template
    const sectionPrompts: string[] = [];
    
    Object.entries(template.sections).forEach(([key, section]) => {
      const format = section.format || 'paragraph';
      const formatInstruction = format === 'bullets' ? 'Use bullet points.' :
                               format === 'numbered' ? 'Use numbered list.' :
                               'Use paragraph format.';
      
      sectionPrompts.push(`
### ${section.title}
Instructions: ${section.aiInstructions}
Format: ${formatInstruction}
${section.keywords ? `Keywords to look for: ${section.keywords.join(', ')}` : ''}
${section.exampleText ? `Example format: ${section.exampleText}` : ''}
${section.required ? 'This section is REQUIRED.' : 'This section is optional.'}
`);
    });

    // Get AI style preferences
    const styleGuide = {
      formal: 'Use formal medical terminology and third-person perspective.',
      conversational: 'Use a natural, conversational tone while maintaining professionalism.',
      concise: 'Be extremely concise and to the point. Avoid unnecessary detail.',
      detailed: 'Include comprehensive details and thorough documentation.'
    };

    return `You are a medical scribe AI configured for Dr. ${patient.name || 'Unknown'}'s specific preferences.

PATIENT INFORMATION:
- Name: ${patient.name}
- MRN: ${patient.mrn}
- DOB: ${patient.dob || 'Not provided'}${patient.dob ? ` | Age: ${calculateAge(patient.dob)}` : ''}
${additionalContext ? `\nADDITIONAL CONTEXT:\n${additionalContext}\n` : ''}

MEDICAL DICTATION:
"${transcript}"

${template.generalInstructions ? `\nGENERAL INSTRUCTIONS FROM DOCTOR:\n${template.generalInstructions}\n` : ''}

WRITING STYLE: ${styleGuide[settings.aiStyle]}

SECTION-SPECIFIC INSTRUCTIONS:
Process the dictation into the following sections, following each section's specific instructions:

${sectionPrompts.join('\n')}

OUTPUT REQUIREMENTS:
1. Generate a well-formatted clinical note following the template structure
2. Follow the specified format for each section (bullets, numbered, or paragraph)
3. Use the specified writing style throughout
4. Include all required sections; optional sections only if relevant information is present
5. Extract ACTUAL information from the dictation - do not use placeholder text
6. Maintain medical accuracy and appropriate terminology

Please process the dictation now.`;
  }

  private buildPrompt(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    additionalContext?: string
  ): string {
    // Check if we should use specialty templates
    const currentDoctor = specialtyService.getCurrentDoctor();
    if (currentDoctor && !template) {
      // Use specialty-specific prompt
      return specialtyService.formatAIPrompt(transcript, patient);
    }
    // If we have a custom template, create sections based on it
    if (template && template.sections) {
      // Build section instructions with the ACTUAL AI instructions from the template
      const templateSections = Object.entries(template.sections).map(([key, section]) => {
        if (typeof section === 'object' && section.title && section.aiInstructions) {
          // Use the ACTUAL AI instructions from the template
          return `"${key}": "${section.aiInstructions.replace(/"/g, '\\"')}"`;
        } else if (typeof section === 'object' && section.title) {
          return `"${key}": "Extract information for ${section.title}"`;
        }
        return `"${key}": "Extract relevant information"`;
      }).join(',\n    ');
      
      // Get general AI instructions if available
      const generalInstructions = template.generalInstructions || '';
      
      return `You are a medical scribe. Create a professional medical note from this dictation.

PATIENT: ${patient.name} (MRN: ${patient.mrn})

DICTATION:
"${transcript}"

Generate a JSON response with these sections:
{
  "sections": {
    ${templateSections}
  }
}

IMPORTANT: Only return the medical note content. Do not include any instructions, explanations, or meta-commentary in your response.`;
    }
    
    // Check if this is a conversation transcript
    const isConversation = transcript.includes('CONVERSATION TRANSCRIPT:') || 
                           transcript.includes('[DOCTOR]:') || 
                           transcript.includes('[PATIENT]:');
    
    // Get specialty role if available
    const specialtyRole = currentDoctor ? 
      specialtyService.getAIPrompt().role : 
      'an ENDOCRINOLOGIST';
    
    // Default prompt - adjusted for conversation or dictation
    const prompt = isConversation 
      ? `You are an experienced medical scribe working for ${specialtyRole}. Extract medical information from this doctor-patient conversation and create a structured SOAP note.

CONVERSATION:
"${transcript}"

IMPORTANT: This is a conversation between a doctor and patient. Extract the medical information from their dialogue.`
      : `You are an experienced medical scribe working for ${specialtyRole}. Convert this medical dictation into a structured SOAP note with special attention to ${currentDoctor ? specialtyService.getAIPrompt().specialty : 'endocrine conditions'}.

DICTATION:
"${transcript}"`;
    
    return prompt + (additionalContext ? `\n\nCONTEXT: ${additionalContext}` : '') + `

Create a medical note in JSON format:
{
  "sections": {
    "chiefComplaint": "[reason for visit]",
    "historyOfPresentIllness": "[story of current illness]",
    "reviewOfSystems": "[review of symptoms]",
    "pastMedicalHistory": "[chronic conditions]",
    "medications": "[current medications with doses]",
    "allergies": "[drug allergies]",
    "socialHistory": "[smoking, alcohol, drug use]",
    "familyHistory": "[family medical history]",
    "physicalExam": "[exam findings, vitals]",
    "assessment": "[today's problems]",
    "plan": "[treatment plan, medications, labs, follow-up]",
    "patientSummary": "[2-3 sentence summary]"
  }
}

IMPORTANT: Only return the medical note content. Do not include instructions or explanations in your response.`;
  }

  private parseResponse(
    responseText: string,
    patient: PatientData,
    template: Template | null,
    originalTranscript?: string
  ): ProcessedNote {
    try {
      // Clean the response text to handle control characters
      const cleanedResponse = responseText
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n')
        .trim();

      let parsed: any;

      // Check if response is JSON or markdown
      if (cleanedResponse.startsWith('{') || cleanedResponse.startsWith('[')) {
        // Try to parse JSON response
        try {
          parsed = JSON.parse(cleanedResponse);
        } catch (jsonError) {
          logError('bedrock', 'Error message', {});
          // If JSON parsing fails, treat as markdown
          return this.parseMarkdownResponse(cleanedResponse, patient);
        }
      } else {
        // Response is markdown, not JSON
        logDebug('bedrock', 'Debug message', {});
        return this.parseMarkdownResponse(cleanedResponse, patient);
      }

      // Format based on template type
      let formatted: string

      if (template && template.sections && parsed.sections) {
        logDebug('bedrock', 'Debug message', {});
        // Format using custom template sections
        formatted = this.formatCustomTemplate(parsed.sections, patient, template);
      } else {
        logDebug('bedrock', 'Debug message', {});
        // Use default formatting
        formatted = this.formatNote(parsed.sections, patient);
      }

      // Extract orders from the AI-formatted note (NOT the raw transcript)
      // This ensures we extract from properly structured clinical text instead of messy conversation
      let extractedOrders: OrderExtractionResult | undefined;
      if (formatted) {
        logDebug('bedrock', 'Extracting orders from formatted note');
        extractedOrders = orderExtractionService.extractOrders(formatted);
        logInfo('bedrock', 'Orders extracted from formatted note');
      }

      // Add Orders & Actions section if we have extracted orders
      let ordersAndActions = '';
      if (extractedOrders && (
        extractedOrders.medications.length > 0 ||
        extractedOrders.labs.length > 0 ||
        extractedOrders.imaging.length > 0 ||
        extractedOrders.priorAuths.length > 0 ||
        extractedOrders.referrals.length > 0
      )) {
        // Enrich prior auth orders with detailed justifications from AI note
        if (extractedOrders.priorAuths.length > 0) {
          extractedOrders = orderExtractionService.enrichPriorAuthOrders(extractedOrders, formatted);
        }

        // Pass the AI-generated note to include detailed PA justifications
        ordersAndActions = orderExtractionService.formatOrdersForTemplate(extractedOrders, formatted);

        // Add to formatted output
        formatted += `\n\n**ORDERS & ACTIONS:**\n${ordersAndActions}`;

        // Add to sections
        parsed.sections.ordersAndActions = ordersAndActions;

        logInfo('bedrock', 'Added extracted orders to note sections');
      }
      
      // Generate patient summary if we don't have one
      let patientSummary = parsed.sections.patientSummary || '';
      if (!patientSummary && originalTranscript) {
        // Extract key points for a 2-3 sentence summary
        const sentences = originalTranscript.split(/[.!?]+/).slice(0, 3);
        patientSummary = sentences.join('. ').trim() + '.';
        parsed.sections.patientSummary = patientSummary;
      }
      
      return {
        formatted,
        sections: parsed.sections,
        extractedOrders,
        metadata: {
          processedAt: new Date().toISOString(),
          model: this.modelId.includes('claude-opus-4') ? 'claude-opus-4.1' :
                 this.modelId.includes('claude-3-5-sonnet') ? 'claude-3.5-sonnet' : 
                 this.modelId.includes('claude-3-sonnet') ? 'claude-3-sonnet' : 'claude-3-haiku',
          confidence: 0.95
        }
      };
    } catch (error) {
      logError('bedrock', 'Error message', {});
      logDebug('bedrock', 'Debug message', {}); 
      
      // Don't return a fallback - throw an error instead
      // We don't want mediocre results
      throw new Error('Failed to parse AI response. The AI may have returned an invalid format.');
    }
  }
  
  private parseMarkdownResponse(
    markdownText: string,
    patient: PatientData
  ): ProcessedNote {
    // For markdown responses, just use the text as-is
    // since it's already formatted nicely by the AI
    return {
      patient,
      sections: {
        fullNote: markdownText
      },
      formatted: markdownText,
      timestamp: new Date().toISOString()
    };
  }

  private formatCustomTemplate(sections: any, patient: PatientData, template: Template): string {
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    
    // Format custom template
    
    let formatted = `CLINICAL NOTE - ${template.name}
════════════════════════════════════════════════════════
Patient: ${patient.name}
MRN: ${patient.mrn}
Date: ${date}
Time: ${time}
════════════════════════════════════════════════════════

`;
    
    // Add sections based on template
    Object.entries(template.sections).forEach(([key, section]) => {
      if (typeof section === 'object' && section.title) {
        const title = section.title;
        const content = sections[key];
        formatted += `\n${title}:\n`;
        
        if (content && content.trim() !== '' && content !== 'See transcript for details') {
          formatted += `${content}\n\n`;
        } else {
          formatted += `[No relevant information extracted from dictation]\n\n`;
        }
      }
    });
    
    return formatted;
  }

  private highlightEndocrineTerms(text: string): string {
    // Don't highlight if text is empty or undefined
    if (!text) return text;
    
    // Get specialty-specific terms if available, otherwise use default endocrine terms
    const highlightTerms = specialtyService.getCurrentDoctor() ? 
      specialtyService.getHighlightTerms() : 
      [
        // Diabetes terms
        'diabetes', 'glucose', 'insulin', 'A1C', 'HbA1c', 'hypoglycemia', 'hyperglycemia',
        'Lantus', 'Humalog', 'NovoLog', 'Metformin', 'Ozempic', 'Mounjaro', 'Jardiance',
        'blood sugar', 'diabetic', 'DKA', 'ketoacidosis',
        // Thyroid terms
        'thyroid', 'hypothyroid', 'hyperthyroid', 'TSH', 'T3', 'T4', 'Levothyroxine',
        'Synthroid', 'goiter', 'thyroiditis',
        // Lipid terms
        'cholesterol', 'triglycerides', 'HDL', 'LDL', 'hyperlipidemia', 'statin',
        'Lipitor', 'Crestor', 'Simvastatin',
        // Hormonal terms
        'testosterone', 'estrogen', 'cortisol', 'PCOS', 'adrenal', 'pituitary'
      ];
    
    let highlightedText = text;
    highlightTerms.forEach(term => {
      const regex = new RegExp(`\\b(${term}s?)\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, '**$1**');
    });
    
    // Highlight numeric values with medical units
    highlightedText = highlightedText.replace(/\b(\d+(?:\.\d+)?)\s*(mg\/dL|mg|mcg|units?|mL|%)/gi, '**$1 $2**');
    
    return highlightedText;
  }

  private formatNote(sections: any, patient: PatientData): string {
    const specialty = specialtyService.getCurrentDoctor()?.specialty?.toUpperCase() || 'ENDOCRINOLOGY';
    return `CLINICAL NOTE - ${specialty}
====================
Patient: ${patient.name}
MRN: ${patient.mrn}
Date: ${new Date().toLocaleDateString()}
Provider: ${sections.provider || specialtyService.getCurrentDoctor()?.name || 'Dr. Rakesh Patel, MD'}

CHIEF COMPLAINT:
${this.highlightEndocrineTerms(sections.chiefComplaint || 'Not specified')}

HISTORY OF PRESENT ILLNESS:
${this.highlightEndocrineTerms(sections.historyOfPresentIllness || 'See transcript')}

REVIEW OF SYSTEMS:
${this.highlightEndocrineTerms(sections.reviewOfSystems || 'Negative except as noted in HPI')}

PAST MEDICAL HISTORY:
${this.highlightEndocrineTerms(sections.pastMedicalHistory || patient.diagnosis.join(', '))}

MEDICATIONS:
${this.highlightEndocrineTerms(sections.medications || patient.medications.map(m => `- ${m.name} ${m.dosage} - ${m.frequency}`).join('\n'))}

ALLERGIES:
${sections.allergies || 'NKDA'}

SOCIAL HISTORY:
${sections.socialHistory || ''}

FAMILY HISTORY:
${this.highlightEndocrineTerms(sections.familyHistory || '')}

PHYSICAL EXAMINATION:
${this.highlightEndocrineTerms(sections.physicalExam || 'Deferred')}

${sections.diagnosticResults ? `DIAGNOSTIC RESULTS:
${this.highlightEndocrineTerms(sections.diagnosticResults)}

` : ''}ASSESSMENT:
${this.highlightEndocrineTerms(sections.assessment || 'See HPI')}

PLAN:
${this.highlightEndocrineTerms(sections.plan || 'Continue current management')}

====================
Generated by AWS Bedrock ${this.modelId.includes('3-5-sonnet') ? 'Claude 3.5 Sonnet' : 'Claude 3 Sonnet'} (HIPAA Compliant)
Processed: ${new Date().toLocaleString()}`;
  }

  /**
   * Test if Bedrock is configured and accessible
   */
  async testConnection(): Promise<boolean> {
    try {
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Say "ok"'
            }
          ]
        })
      });
      
      await this.client.send(command);
      return true;
    } catch (error) {
      logError('bedrock', 'Error message', {});
      return false;
    }
  }

  /**
   * Generate a simple text response for pump chat
   */
  async generateResponse(context: string, instruction: string): Promise<string> {
    // Implement retry logic with exponential backoff for throttling
    let retryCount = 0;
    const maxRetries = 5; // Increased from 3 to 5
    const baseDelay = 3000; // Increased from 2 to 3 second initial delay
    
    while (retryCount < maxRetries) {
      try {
        const prompt = `${context}\n\n${instruction}`;
        
        const command = new InvokeModelCommand({
          modelId: this.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 2000, // Increased for detailed JSON responses
            temperature: 0.7,
            messages: [
              {
                role: "user",
                content: prompt
              }
            ]
          })
        });

        const response = await this.client.send(command);
        const responseBody = new TextDecoder().decode(response.body);
        const parsed = JSON.parse(responseBody);
        
        // Extract the text content from Claude's response
        const content = parsed.content?.[0]?.text || 'I can help you choose the right pump. What matters most to you?';
        
        return content.trim();
      } catch (error: any) {
        logError('bedrock', 'Error message', {});
        
        // Check if it's a throttling error
        if (error.name === 'ThrottlingException' || 
            error.name === 'TooManyRequestsException' ||
            error.$metadata?.httpStatusCode === 429 ||
            error.message?.includes('Too many requests')) {
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff
            logDebug('bedrock', 'Debug message', {});
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            // Max retries exceeded, return fallback instead of throwing
            logWarn('bedrock', 'Warning message', {});
            return 'I understand your needs. Let me analyze this information to find your best pump match.';
          }
        }
        
        // For non-throttling errors, return a generic fallback
        logError('bedrock', 'Error message', {});
        return 'I\'m analyzing your preferences to find the best pump for you. Let\'s continue with the next category.';
      }
    }
    
    // If we exhausted all retries, return a helpful fallback
    logWarn('bedrock', 'Warning message', {});
    return 'I understand your needs. Let me analyze this information to find your best pump match.';
  }

  /**
   * Process simple prompt with Claude (for PumpDrive and other services)
   * HIPAA COMPLIANT - Covered by AWS BAA
   */
  async processWithClaude(prompt: string, context?: string): Promise<string> {
    // MIGRATION PHASE 1: Azure OpenAI is PRIMARY for all processing
    if (this.migrationMode || this.primaryProvider === 'azure') {
      try {
        logDebug('bedrock', 'Debug message', {});
        const azureResult = await azureOpenAIService.processTranscription(
          prompt,
          'Standard Response',
          { name: 'System' }
        );
        logInfo('bedrock', 'Info message', {});
        return azureResult.formattedNote;
      } catch (azureError) {
        logWarn('bedrock', 'Warning message', {});
        // Continue to AWS Bedrock fallback below
      }
    }

    try {
      logDebug('bedrock', 'Debug message', {});
      
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 3000,
          temperature: 0.7,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return responseBody.content[0].text;
    } catch (error) {
      logError('bedrock', 'Error message', {});
      
      // Try Azure OpenAI as fallback when Bedrock fails
      logWarn('bedrock', 'Warning message', {});
      
      try {
        const azureResult = await azureOpenAIService.processTranscription(
          prompt,
          'Standard Response',
          { name: 'System' }
        );
        logInfo('bedrock', 'Info message', {});
        return azureResult.formattedNote;
      } catch (azureError) {
        logError('bedrock', 'Error message', {});
        throw new Error('AI processing failed. Please try again later.');
      }
    }
  }


  /**
   * Create a basic formatted note when Bedrock is not available
   */
  private createBasicFormattedNote(transcript: string, patient: PatientData): ProcessedNote {
    const timestamp = new Date().toISOString();
    
    // Basic formatting - just clean up the transcript
    const lines = transcript.split(/[.!?]+/).filter(line => line.trim());
    const formatted = `
**PATIENT INFORMATION:**
Name: ${patient.name || 'Not provided'}
MRN: ${patient.mrn || 'Not provided'}
DOB: ${patient.dob || 'Not provided'}${patient.dob ? ` | Age: ${calculateAge(patient.dob)}` : ''}
Visit Date: ${new Date().toLocaleDateString()}

**CLINICAL NOTE:**
${lines.map(line => line.trim()).join('. ')}.

**NOTE:** This is a basic transcription without AI processing. 
To enable AI-powered medical note formatting:
1. Go to https://console.aws.amazon.com/bedrock/
2. Enable Claude models
3. Try processing again

---
*Transcribed at ${new Date().toLocaleString()}*
    `.trim();

    return {
      formatted,
      sections: {
        chiefComplaint: '',
        historyOfPresentIllness: transcript,
        assessment: '',
        plan: ''
      },
      metadata: {
        processedAt: timestamp,
        model: 'basic-formatter',
        confidence: 0.5
      }
    };
  }

  /**
   * Process with AWS Bedrock (fallback method)
   */
  private async processWithBedrock(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    additionalContext?: string,
    customTemplate?: { template: DoctorTemplate; doctorSettings: DoctorSettings }
  ): Promise<ProcessedNote> {
    const prompt = customTemplate
      ? this.buildCustomPrompt(transcript, patient, customTemplate.template, customTemplate.doctorSettings, additionalContext)
      : this.buildPrompt(transcript, patient, template, additionalContext);

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const processedText = responseBody.content[0].text;

    // Parse sections from the response
    const sections = this.parseSections(processedText);

    return {
      formatted: processedText,
      sections,
      metadata: {
        processedAt: new Date().toISOString(),
        model: `AWS Bedrock ${this.modelId}`,
        confidence: 0.9
      }
    };
  }

  /**
   * Create emergency note when all processing fails
   */
  private createEmergencyNote(transcript: string, patient: PatientData): ProcessedNote {
    const emergencyNote = `
**EMERGENCY PROCESSING FAILURE**

**Patient:** ${patient.name || 'Unknown'}
**MRN:** ${patient.mrn || 'Not provided'}
**Date:** ${new Date().toLocaleDateString()}
**Time:** ${new Date().toLocaleTimeString()}

**ORIGINAL DICTATION:**
${transcript}

**⚠️ CRITICAL NOTICE:**
All AI processing services (Azure OpenAI, AWS Bedrock, and Local Fallback) failed.
This note requires immediate manual review and completion by the attending physician.

**REQUIRED ACTIONS:**
1. Review original dictation above
2. Create proper SOAP note manually
3. Ensure all clinical documentation is complete
4. Check system status and report technical issues

**SYSTEM STATUS:**
- Azure OpenAI: ${this.providerStatus.azure.available ? 'Available' : 'Failed'}
- AWS Bedrock: ${this.providerStatus.bedrock.available ? 'Available' : 'Failed'}
- Local Fallback: ${this.providerStatus.local.available ? 'Available' : 'Failed'}

**Last Error:** ${this.providerStatus.azure.lastError?.message || 'Unknown'}
`;

    return {
      formatted: emergencyNote,
      sections: {
        chiefComplaint: 'MANUAL ENTRY REQUIRED',
        historyOfPresentIllness: 'See original dictation above',
        physicalExam: 'MANUAL ENTRY REQUIRED',
        assessment: 'MANUAL ENTRY REQUIRED',
        plan: 'MANUAL ENTRY REQUIRED',
        patientSummary: 'Emergency processing failure - requires immediate physician review'
      },
      metadata: {
        processedAt: new Date().toISOString(),
        model: 'Emergency Fallback',
        confidence: 0.0
      }
    };
  }

  /**
   * Get current provider status for monitoring
   */
  getProviderStatus() {
    return {
      primary: this.primaryProvider,
      azure: this.providerStatus.azure,
      bedrock: this.providerStatus.bedrock,
      local: this.providerStatus.local,
      lastUpdate: Date.now()
    };
  }

  /**
   * Reset provider availability (for recovery testing)
   */
  resetProviderStatus() {
    this.providerStatus = {
      azure: { available: true, lastError: null, lastChecked: 0 },
      bedrock: { available: true, lastError: null, lastChecked: 0 },
      local: { available: true, lastError: null, lastChecked: 0 }
    };
    logInfo('bedrock', 'Provider status reset - all providers marked as available');
  }
}

// Export singleton instance
export const bedrockService = new BedrockService();

/**
 * Migration from OpenAI to Bedrock:
 * 
 * OLD:
 * import { openAIService } from './openai.service';
 * const result = await openAIService.processMedicalTranscription(...);
 * 
 * NEW:
 * import { bedrockService } from './bedrock.service';
 * const result = await bedrockService.processMedicalTranscription(...);
 */