/**
 * OpenAI Service for Medical Note Processing
 * Processes transcriptions into structured medical notes
 */

import OpenAI from 'openai';
import type { Template } from '../types/template.types';
import type { PatientData } from './patientData.service';
import { logError, logWarn, logInfo, logDebug } from '../logger.service';

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
  };
  icd10Codes?: string[];
  cptCodes?: string[];
  followUp?: string;
}

class OpenAIService {
  private client: OpenAI | null = null;
  private readonly apiKey =
    import.meta.env.VITE_OPENAI_API_KEY || 'sk-proj-VkL9mNOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWx';

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    this.client = new OpenAI({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true, // Note: In production, use a backend proxy
    });
  }

  /**
   * Set API key and reinitialize client
   */
  setApiKey(apiKey: string) {
    localStorage.setItem('openai_api_key', apiKey);
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Process medical transcription into structured note
   */
  async processMedicalTranscription(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    additionalContext?: string
  ): Promise<ProcessedNote> {
    // HIPAA COMPLIANCE WARNING: OpenAI cannot sign BAA - disabled for compliance
    logWarn('openai', 'Warning message', {});

    // Return structured transcript without sending PHI to OpenAI
    const sections = template?.sections || {};
    const formattedSections: any = {};

    Object.keys(sections).forEach(key => {
      formattedSections[key] = `[Awaiting HIPAA-compliant AI processing]`;
    });

    return {
      formatted: `HIPAA COMPLIANCE NOTICE
=======================
AI Processing Temporarily Disabled
Patient: ${patient.name} (${patient.mrn})
Date: ${new Date().toLocaleDateString()}

TRANSCRIPT:
${transcript}

NOTE: To enable AI processing, integrate:
- Azure OpenAI (with BAA)
- AWS Comprehend Medical (with BAA)
- Google Healthcare API (with BAA)`,
      sections: {
        chiefComplaint: 'AI disabled for HIPAA compliance',
        historyOfPresentIllness: transcript.substring(0, 200),
        assessment: 'Requires HIPAA-compliant AI service',
        plan: 'Manual review required',
        ...formattedSections,
      },
      metadata: {
        processedAt: new Date().toISOString(),
        model: 'disabled-for-hipaa-compliance',
        confidence: 0,
        warning: 'OpenAI cannot process PHI without BAA',
      },
    };

    /* ORIGINAL CODE - DISABLED FOR HIPAA COMPLIANCE
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Please set API key.');
    }

    try {
      const systemPrompt = this.buildSystemPrompt(template);
      const userPrompt = this.buildUserPrompt(transcript, patient, additionalContext);

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = JSON.parse(response);
      return this.formatProcessedNote(parsedResponse, patient, template);
    } catch (error) {
      logError('openai', 'Error message', {});
      throw error;
    }
    */
  }

  /**
   * Build system prompt for medical note generation
   */
  private buildSystemPrompt(template: Template | null): string {
    let prompt = `You are an expert medical scribe AI assistant trained to convert medical dictations into structured clinical notes. 
    You must generate accurate, professional medical documentation following standard medical terminology and formatting.
    
    IMPORTANT INSTRUCTIONS:
    1. Use proper medical terminology and ICD-10 codes where applicable
    2. Maintain HIPAA compliance - do not add any information not provided
    3. Structure the note according to the template provided
    4. Include all medications with proper dosages and frequencies
    5. Flag any critical findings or abnormal values
    6. Suggest appropriate CPT codes for billing when relevant
    7. Format dates consistently (MM/DD/YYYY)
    8. Use standard medical abbreviations appropriately
    
    You must return a JSON object with the following structure:
    {
      "sections": {
        "chiefComplaint": "string",
        "historyOfPresentIllness": "string",
        "reviewOfSystems": "string",
        "pastMedicalHistory": "string",
        "medications": "string",
        "allergies": "string",
        "socialHistory": "string",
        "familyHistory": "string",
        "physicalExam": "string",
        "assessment": "string",
        "plan": "string"
      },
      "icd10Codes": ["array of relevant ICD-10 codes"],
      "cptCodes": ["array of relevant CPT codes"],
      "followUp": "follow-up recommendations"
    }`;

    if (template && template.sections) {
      prompt += `\n\nUse this template structure as a guide:\n`;
      Object.entries(template.sections).forEach(([key, value]) => {
        if (value) {
          prompt += `${key}: ${value}\n`;
        }
      });
    }

    return prompt;
  }

  /**
   * Build user prompt with patient context
   */
  private buildUserPrompt(
    transcript: string,
    patient: PatientData,
    additionalContext?: string
  ): string {
    let prompt = `Process the following medical dictation into a structured clinical note:\n\n`;

    // Add patient context
    prompt += `PATIENT INFORMATION:\n`;
    prompt += `Name: ${patient.name}\n`;
    prompt += `MRN: ${patient.mrn}\n`;
    prompt += `DOB: ${patient.dob}\n`;
    prompt += `\nACTIVE DIAGNOSES:\n`;
    patient.diagnosis.forEach(dx => {
      prompt += `- ${dx}\n`;
    });

    prompt += `\nCURRENT MEDICATIONS:\n`;
    patient.medications.forEach(med => {
      prompt += `- ${med.name} ${med.dosage} - ${med.frequency} (${med.indication})\n`;
    });

    prompt += `\nRECENT LAB RESULTS:\n`;
    patient.labResults.slice(0, 5).forEach(lab => {
      prompt += `- ${lab.test}: ${lab.value} (Normal: ${lab.normal}) - ${lab.date}\n`;
    });

    prompt += `\nLAST VITAL SIGNS:\n`;
    prompt += `- BP: ${patient.vitalSigns.bp}\n`;
    prompt += `- HR: ${patient.vitalSigns.hr}\n`;
    prompt += `- Temp: ${patient.vitalSigns.temp}\n`;
    prompt += `- Weight: ${patient.vitalSigns.weight}\n`;
    if (patient.vitalSigns.glucose) {
      prompt += `- Glucose: ${patient.vitalSigns.glucose}\n`;
    }

    if (patient.mentalHealth) {
      prompt += `\nMENTAL HEALTH SCREENING:\n`;
      prompt += `- PHQ-9 Score: ${patient.mentalHealth.phq9Score}\n`;
      prompt += `- GAD-7 Score: ${patient.mentalHealth.gad7Score}\n`;
    }

    if (additionalContext) {
      prompt += `\nADDITIONAL CONTEXT:\n${additionalContext}\n`;
    }

    prompt += `\nDICTATION TRANSCRIPT:\n${transcript}\n`;

    prompt += `\nGenerate a complete medical note incorporating all the above information. 
    Ensure all current medications and diagnoses are included in the appropriate sections.
    The plan should address all active conditions and include medication continuations.`;

    return prompt;
  }

  /**
   * Format the processed note for display
   */
  private formatProcessedNote(
    response: any,
    patient: PatientData,
    template: Template | null
  ): ProcessedNote {
    const sections = response.sections || {};

    // Build formatted note
    let formatted = `**MEDICAL NOTE**\n`;
    formatted += `**Date:** ${new Date().toLocaleDateString()}\n`;
    formatted += `**Patient:** ${patient.name}\n`;
    formatted += `**MRN:** ${patient.mrn}\n`;
    formatted += `**Provider:** Dr. ${localStorage.getItem('doctor_name') || 'Provider'}\n`;
    if (template) {
      formatted += `**Template:** ${template.name} (${template.specialty})\n`;
    }
    formatted += `\n${'='.repeat(60)}\n\n`;

    // Add sections
    if (sections.chiefComplaint) {
      formatted += `**CHIEF COMPLAINT:**\n${sections.chiefComplaint}\n\n`;
    }

    if (sections.historyOfPresentIllness) {
      formatted += `**HISTORY OF PRESENT ILLNESS:**\n${sections.historyOfPresentIllness}\n\n`;
    }

    if (sections.reviewOfSystems) {
      formatted += `**REVIEW OF SYSTEMS:**\n${sections.reviewOfSystems}\n\n`;
    }

    if (sections.pastMedicalHistory) {
      formatted += `**PAST MEDICAL HISTORY:**\n${sections.pastMedicalHistory}\n\n`;
    }

    if (sections.medications) {
      formatted += `**MEDICATIONS:**\n${sections.medications}\n\n`;
    }

    if (sections.allergies) {
      formatted += `**ALLERGIES:**\n${sections.allergies}\n\n`;
    }

    if (sections.socialHistory) {
      formatted += `**SOCIAL HISTORY:**\n${sections.socialHistory}\n\n`;
    }

    if (sections.familyHistory) {
      formatted += `**FAMILY HISTORY:**\n${sections.familyHistory}\n\n`;
    }

    if (sections.physicalExam) {
      formatted += `**PHYSICAL EXAMINATION:**\n${sections.physicalExam}\n\n`;
    }

    if (sections.assessment) {
      formatted += `**ASSESSMENT:**\n${sections.assessment}\n\n`;
    }

    if (sections.plan) {
      formatted += `**PLAN:**\n${sections.plan}\n\n`;
    }

    // Add coding information
    if (response.icd10Codes && response.icd10Codes.length > 0) {
      formatted += `**ICD-10 CODES:**\n`;
      response.icd10Codes.forEach((code: string) => {
        formatted += `- ${code}\n`;
      });
      formatted += `\n`;
    }

    if (response.cptCodes && response.cptCodes.length > 0) {
      formatted += `**CPT CODES:**\n`;
      response.cptCodes.forEach((code: string) => {
        formatted += `- ${code}\n`;
      });
      formatted += `\n`;
    }

    if (response.followUp) {
      formatted += `**FOLLOW-UP:**\n${response.followUp}\n\n`;
    }

    formatted += `${'='.repeat(60)}\n`;
    formatted += `Generated: ${new Date().toLocaleString()}\n`;
    formatted += `Transcription Method: Amazon Transcribe Medical\n`;
    formatted += `Processing: OpenAI GPT-4\n`;

    return {
      formatted,
      sections,
      icd10Codes: response.icd10Codes,
      cptCodes: response.cptCodes,
      followUp: response.followUp,
    };
  }

  /**
   * Process simple text prompt with OpenAI (for PumpDrive and other services)
   */
  async processText(prompt: string, options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string> {
    if (!this.client) {
      const errorMsg = 'OpenAI client not initialized. Please set API key.';
      logError('openai', errorMsg, { apiKeyPresent: !!this.apiKey, apiKeyLength: this.apiKey?.length });
      throw new Error(errorMsg);
    }

    try {
      logInfo('openai', 'Making OpenAI API call', {
        model: options?.model || 'gpt-4',
        promptLength: prompt.length,
        apiKeyPrefix: this.apiKey?.substring(0, 10) + '...'
      });

      const completion = await this.client.chat.completions.create({
        model: options?.model || 'gpt-4',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2000,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      logInfo('openai', 'OpenAI API call successful', { responseLength: response.length });
      return response;
    } catch (error: any) {
      // Enhanced error logging
      const errorDetails = {
        message: error?.message || 'Unknown error',
        status: error?.status,
        statusText: error?.statusText,
        type: error?.type,
        code: error?.code,
        apiKeyPresent: !!this.apiKey,
        apiKeyValid: this.apiKey?.startsWith('sk-'),
        model: options?.model || 'gpt-4'
      };

      logError('openai', 'OpenAI API call failed', errorDetails);

      // Throw with more context
      throw new Error(`OpenAI API Error: ${error?.message || 'Unknown error'} (Status: ${error?.status || 'N/A'})`);
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.client && !!this.apiKey;
  }

  /**
   * Get sample medical phrases for testing
   */
  getSamplePhrases(): string[] {
    return [
      'Patient presents with chest pain radiating to left arm, started 2 hours ago',
      'Blood pressure 140 over 90, heart rate 88, respiratory rate 16',
      'Lungs clear to auscultation bilaterally, no wheezes rales or rhonchi',
      'Continue metformin 1000 milligrams twice daily for diabetes',
      'Follow up in 3 months with hemoglobin A1C and lipid panel',
      'Assessment: Type 2 diabetes mellitus, well controlled on current regimen',
    ];
  }
}

// Singleton instance
export const openAIService = new OpenAIService();
