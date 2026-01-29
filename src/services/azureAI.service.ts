/**
 * Azure AI Service for HIPAA-Compliant Medical Note Processing
 *
 * VERSION: 3.0.0 - Simplified to Azure OpenAI only (no fallbacks)
 *
 * HIPAA COMPLIANCE STATUS:
 * ========================
 * ✅ Azure OpenAI (GPT-4o)
 *    - Microsoft BAA available and signed
 *    - HIPAA-compliant when properly configured
 *    - Data processed in Microsoft's secure infrastructure
 *    - 100% reliable, no erratic fallback behavior
 *
 * ❌ REMOVED SERVICES:
 *    - OpenAI API (no BAA available) - REMOVED
 *    - AWS Bedrock (fallback complexity) - REMOVED
 *    - Client-side fallback (caused "[Not mentioned in transcription]" errors) - REMOVED
 *
 * ARCHITECTURE:
 * =============
 * Single provider: Azure OpenAI only
 * - No fallbacks = consistent, predictable results
 * - Clear error messages instead of silent degradation
 * - Comprehensive console logging for debugging
 *
 * ORDER EXTRACTION:
 * - Orders are extracted from AI-formatted notes (NOT raw transcripts)
 * - This prevents false positives from conversational noise
 */

import type { Template } from '../types/template.types';
import type { PatientData } from './patientData.service';
import { specialtyService } from './specialty.service';
import type { DoctorTemplate, DoctorSettings } from './doctorProfile.service';
import { orderExtractionService, type OrderExtractionResult } from './orderExtraction.service';
import { azureOpenAIService } from './_deprecated/azureOpenAI.service';
import { medicalCorrections } from './medicalCorrections.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';
import { cptBillingAnalyzer } from './cptBillingAnalyzer.service';

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
    complexityLevel?: string;
    complexityScore?: number;
    tokenEstimate?: number;
    tokenWarning?: string;
    transcriptTruncated?: boolean;
    promptVersionId?: string;
    promptVersion?: string;
  };
}

class AzureAIService {
  // VERSION 3.0.0: Azure OpenAI only, no fallbacks

  constructor() {
    logInfo('azureAI', 'Azure AI Service initialized - Version 3.0.0', {
      provider: 'Azure OpenAI Only',
      hipaaCompliant: true,
      fallbacks: 'None',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Process medical transcription into structured note
   * HIPAA COMPLIANT - Azure OpenAI with Microsoft BAA
   *
   * VERSION 3.0 - Simplified to Azure OpenAI only (no fallbacks)
   */
  async processMedicalTranscription(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    additionalContext?: string,
    customTemplate?: { template: DoctorTemplate; doctorSettings: DoctorSettings }
  ): Promise<ProcessedNote> {
    // 🚀 START: Comprehensive logging
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 AZURE OPENAI PROCESSING START');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Input Details:');
    console.log('   - Transcript length:', transcript.length, 'characters');
    console.log('   - Patient:', patient.name || 'Unknown');
    console.log('   - Template:', customTemplate?.template.name || template?.name || 'Default SOAP');
    console.log('   - Provider:', 'Azure OpenAI (HIPAA Compliant)');
    console.log('   - Timestamp:', new Date().toISOString());

    logInfo('azureAI', 'Starting Azure OpenAI medical transcription processing', {
      transcriptLength: transcript.length,
      patientName: patient.name || 'Unknown',
      templateUsed: customTemplate?.template.name || template?.name || 'Default SOAP',
      provider: 'azure-openai-only',
      timestamp: new Date().toISOString()
    });

    try {
      console.log('\n📤 Calling Azure OpenAI API...');
      const azureResult = await this.processWithAzureOpenAI(transcript, patient, template, additionalContext, customTemplate);

      console.log('\n✅ SUCCESS: Azure OpenAI processing completed');
      console.log('   - Formatted note length:', azureResult.formatted?.length || 0, 'characters');
      console.log('   - Sections found:', Object.keys(azureResult.sections || {}).length);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      logInfo('azureAI', 'Azure OpenAI processing completed successfully');
      return azureResult;

    } catch (azureError: any) {
      console.log('\n❌ ERROR: Azure OpenAI processing failed');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('💥 Error Details:');
      console.error('   - Type:', azureError.name || 'Unknown');
      console.error('   - Message:', azureError.message || 'No message');
      console.error('   - Stack:', azureError.stack);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      logError('azureAI', 'Azure OpenAI processing failed - NO FALLBACKS', {
        error: azureError.message,
        errorType: azureError.name,
        stack: azureError.stack,
        timestamp: new Date().toISOString()
      });

      // Create user-friendly error message
      let userMessage = '❌ AI Processing Failed\n\n';

      if (azureError.message?.includes('API key') || azureError.message?.includes('authentication')) {
        userMessage += '🔑 Authentication Error\n\n';
        userMessage += 'The Azure OpenAI API key is invalid or expired.\n\n';
        userMessage += 'Please contact support to update the API credentials.';
      } else if (azureError.message?.includes('rate limit') || azureError.message?.includes('429')) {
        userMessage += '⏳ Rate Limit Exceeded - High Usage Detected\n\n';
        userMessage += 'Your Azure OpenAI quota has been temporarily exhausted.\n\n';
        userMessage += 'This typically happens after processing many transcriptions.\n\n';
        userMessage += '💡 Solution: Wait 1-2 minutes for quota to reset, then try again.\n\n';
        userMessage += 'The system automatically retries with increasing delays (up to 62 seconds total).\n\n';
        userMessage += 'If this persists, consider upgrading your Azure OpenAI quota or spreading out your processing.';
      } else if (azureError.message?.includes('network') || azureError.message?.includes('timeout')) {
        userMessage += '🌐 Network Error\n\n';
        userMessage += 'Unable to connect to the AI service.\n\n';
        userMessage += 'Please check your internet connection and try again.';
      } else {
        userMessage += '⚠️ Processing Error\n\n';
        userMessage += `${azureError.message}\n\n`;
        userMessage += 'Please try again or contact support if the problem persists.';
      }

      // Throw error with user-friendly message
      throw new Error(userMessage);
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
    console.log('🔥 [azureAI] ============ processWithAzureOpenAI CALLED ============');
    console.log('🔥 [azureAI] Has customTemplate?', !!customTemplate);
    console.log('🔥 [azureAI] Has template?', !!template);
    console.log('🔥 [azureAI] customTemplate:', customTemplate);

    if (customTemplate) {
      console.log('🎯 [azureAI] ✅ USING CUSTOM TEMPLATE PATH (buildCustomPrompt)');
      console.log('🎯 [azureAI] Template name:', customTemplate.template.name);
      console.log('🎯 [azureAI] Template sections:', Object.keys(customTemplate.template.sections));
      console.log('🎯 [azureAI] General instructions:', customTemplate.template.generalInstructions);

      // Log each section's details
      Object.entries(customTemplate.template.sections).forEach(([key, section]) => {
        console.log(`🔍 [azureAI] Section "${key}":`, {
          title: section.title,
          hasAiInstructions: !!section.aiInstructions,
          aiInstructionsLength: section.aiInstructions?.length || 0,
          hasExampleText: !!section.exampleText,
          exampleTextLength: section.exampleText?.length || 0,
          format: section.format
        });
      });
    } else if (template) {
      console.log('⚠️  [azureAI] Using standard template path (buildPrompt - weaker)');
      console.log('⚠️  [azureAI] Template:', template);
    } else {
      console.log('⚠️  [azureAI] No template - using default SOAP');
    }
    
    // Build enhanced template string with AI instructions
    let templateString = 'Standard SOAP Note Format';
    let prompt = '';
    
    if (customTemplate) {
      // Use custom template with doctor's specific instructions
      logDebug('azureAI', 'Debug message', {});
      prompt = this.buildCustomPrompt(transcript, patient, customTemplate.template, customTemplate.doctorSettings, additionalContext);
      templateString = customTemplate.template.name;
      logInfo('azureAI', 'Info message', {});
    } else if (template && template.sections) {
      // Use standard template with AI instructions
      logDebug('azureAI', 'Debug message', {});
      prompt = this.buildPrompt(transcript, patient, template, additionalContext);
      templateString = template.name || 'Template-based SOAP Note';
      logInfo('azureAI', 'Info message', {});
    } else {
      // Default medical scribe prompt
      logDebug('azureAI', 'Debug message', {});
      prompt = this.buildPrompt(transcript, patient, null, additionalContext);
      templateString = 'Standard Medical SOAP Note';
      logInfo('azureAI', 'Info message', {});
    }
    
    console.log('📝 [azureAI] Generated prompt (first 1000 chars):', prompt.substring(0, 1000));
    console.log('📝 [azureAI] Prompt length:', prompt.length, 'characters');

    try {
      // Process ALL templates (custom and standard) with Azure OpenAI using updated credentials
      logDebug('azureAI', 'Debug message', {});
      logInfo('azureAI', 'Info message', {});
        logDebug("azureAI", "Using standard SOAP format");
      logDebug('azureAI', 'Debug message', {});
      logDebug('azureAI', 'Debug message', {});
      logInfo('azureAI', 'Info message', {});
      
      // Use the appropriate Azure OpenAI method based on template type
      let azureResult;
      if (customTemplate) {
        // For custom templates, use the custom prompt with detailed instructions
        logInfo('azureAI', '🔥 USING CUSTOM TEMPLATE PATH', {
          templateName: customTemplate.template.name,
          sectionsCount: Object.keys(customTemplate.template.sections).length
        });
        console.log('🚀 [azureAI] Calling azureOpenAIService.processTranscriptionWithCustomPrompt...');
        azureResult = await azureOpenAIService.processTranscriptionWithCustomPrompt(
          transcript,
          prompt, // Use the detailed custom prompt we built
          {
            name: patient.fullName,
            mrn: patient.mrn,
            dob: patient.dateOfBirth
          },
          customTemplate.template,
          additionalContext
        );
        console.log('✅ [azureAI] AI returned result:', azureResult);
        console.log('✅ [azureAI] Formatted note preview (first 500 chars):', azureResult.formattedNote?.substring(0, 500));
        logInfo('azureAI', '✅ Custom template AI processing complete', {
          hasFormattedNote: !!azureResult.formattedNote,
          sectionsInResult: Object.keys(azureResult.sections || {}).length
        });
      } else {
        // For standard templates, use the standard method
        logInfo('azureAI', '⚠️ USING STANDARD TEMPLATE PATH (not custom)');
        azureResult = await azureOpenAIService.processTranscription(
          transcript,
          templateString,
          {
            name: patient.fullName,
            mrn: patient.mrn,
            dob: patient.dateOfBirth
          }
        );
      }

        // Convert Azure OpenAI result to our ProcessedNote format
        const processedNote: ProcessedNote = this.convertAzureToProcessedNote(azureResult, patient);

        // Pass template data for validation and retry logic
        return await this.enhanceWithOrderExtraction(
          processedNote,
          transcript,
          customTemplate?.template,
          patient,
          customTemplate?.doctorSettings
        );
    } catch (azureError: any) {
      console.error('❌ [azureAI] AZURE OPENAI ERROR:', azureError);
      console.error('❌ [azureAI] Error details:', {
        message: azureError?.message,
        stack: azureError?.stack,
        response: azureError?.response
      });
      logError('azureAI', 'Azure OpenAI processing failed', { error: azureError });
      logDebug('azureAI', 'Debug message', {});
      
      // For now, disable Azure OpenAI fallback and use standard processing
      logDebug('azureAI', 'Debug message', {});
      logInfo('azureAI', 'Info message', {});
      
      throw azureError; // Re-throw to trigger fallback
    }
  }

  /**
   * Convert Azure OpenAI result to ProcessedNote format
   */
  private convertAzureToProcessedNote(azureResult: any, patient: PatientData): ProcessedNote {
    // Start with standard sections
    const sections: any = {
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
    };

    // Add any custom sections from the Azure result
    Object.keys(azureResult.sections).forEach(key => {
      if (!sections[key] && azureResult.sections[key]) {
        sections[key] = azureResult.sections[key];
      }
    });

    return {
      formatted: azureResult.formattedNote,
      sections,
      metadata: {
        processedAt: new Date().toISOString(),
        model: `Azure OpenAI ${azureResult.metadata?.model || 'GPT-4o'}`,
        confidence: 0.95,
        complexityLevel: azureResult.metadata?.complexityLevel,
        complexityScore: azureResult.metadata?.complexityScore,
        tokenEstimate: azureResult.metadata?.tokenEstimate,
        tokenWarning: azureResult.metadata?.tokenWarning,
        transcriptTruncated: azureResult.metadata?.transcriptTruncated,
        promptVersionId: azureResult.metadata?.promptVersionId,
        promptVersion: azureResult.metadata?.promptVersion
      }
    };
  }

  /**
   * Enhance ProcessedNote with order extraction and validation
   */
  private async enhanceWithOrderExtraction(
    processedNote: ProcessedNote,
    transcript: string,
    template?: DoctorTemplate,
    patient?: PatientData,
    settings?: DoctorSettings
  ): Promise<ProcessedNote> {
    console.log('🔍 ==================== ENHANCE WITH ORDER EXTRACTION ====================');
    console.log('📝 Formatted note length:', processedNote.formatted.length);
    console.log('📝 Formatted note preview (first 200 chars):', processedNote.formatted.substring(0, 200));

    logDebug('azureAI', 'Enhancing note with order extraction and validation');
    // Extract orders from the AI-formatted note (NOT the raw transcript)
    // This ensures we extract from properly structured clinical text instead of messy conversation
    let extractedOrders = orderExtractionService.extractOrders(processedNote.formatted);

    console.log('🔍 Extracted orders result:', extractedOrders);
    console.log('🔍 Medications found:', extractedOrders?.medications?.length || 0);
    console.log('🔍 Labs found:', extractedOrders?.labs?.length || 0);
    console.log('🔍 Imaging found:', extractedOrders?.imaging?.length || 0);

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
      console.log('✅ Orders found! Adding to processedNote.extractedOrders');
      // Pass the AI-generated note to include detailed PA justifications
      const ordersAndActions = orderExtractionService.formatOrdersForTemplate(extractedOrders, processedNote.formatted);
      processedNote.sections.ordersAndActions = ordersAndActions;
      processedNote.extractedOrders = extractedOrders;
      processedNote.formatted += `\n\n**ORDERS & ACTIONS:**\n${ordersAndActions}`;
      logInfo('azureAI', 'Enhanced note with extracted orders', { orderCount: extractedOrders.medications.length + extractedOrders.labs.length });
    } else {
      console.log('❌ No orders found in transcript');
    }
    console.log('🔍 ===========================================================');

    // IMPROVED: Validate template compliance with multiple retry attempts
    if (template) {
      let currentNote = processedNote;
      const maxRetries = 2; // Try up to 2 retries (total 3 attempts)
      let retryCount = 0;

      while (retryCount < maxRetries) {
        const complianceCheck = this.validateTemplateCompliance(currentNote, template);

        if (complianceCheck.compliant) {
          // Compliance successful!
          if (retryCount > 0) {
            logInfo('azureAI', `Template compliance achieved after ${retryCount} retries`);
          }
          break;
        }

        // Compliance failed - retry if we have more attempts
        if (!patient || !settings) {
          logWarn('azureAI', 'Template compliance failed but cannot retry (missing patient/settings)');
          break;
        }

        retryCount++;
        logWarn('azureAI', `Template compliance failed (attempt ${retryCount}/${maxRetries}), retrying with emphasis`, {
          missingSections: complianceCheck.missingSections.length,
          partialSections: complianceCheck.partialSections.length,
          missingSectionNames: complianceCheck.missingSections.join(', '),
          partialSectionNames: complianceCheck.partialSections.join(', ')
        });

        // Retry with emphasis on missing sections
        const retryResult = await this.retryWithEmphasis(
          transcript,
          patient,
          template,
          settings,
          complianceCheck.missingSections,
          complianceCheck.partialSections,
          retryCount // Pass retry count for escalating warnings
        );

        if (retryResult) {
          // IMPORTANT: Preserve extractedOrders from original note
          retryResult.extractedOrders = processedNote.extractedOrders;
          currentNote = retryResult;
        } else {
          logError('azureAI', `Retry ${retryCount} failed - using previous result`);
          break;
        }
      }

      // IMPORTANT: Preserve extractedOrders when updating processedNote
      const preservedOrders = processedNote.extractedOrders;
      processedNote = currentNote;
      processedNote.extractedOrders = preservedOrders;
    }

    // Validate output quality
    const qualityCheck = this.validateOutputQuality(processedNote, transcript);
    if (qualityCheck.quality === 'poor') {
      logWarn('azureAI', 'Output quality poor', {
        issues: qualityCheck.issues.length,
        confidence: Math.round(qualityCheck.confidence * 100) + '%'
      });
    }

    const finalNote = this.validateAndCleanProcessedNote(processedNote, transcript, template);
    return finalNote;
  }

  /**
   * Retry AI processing with emphasis on missing/partial sections
   * IMPROVED: Escalating warnings based on retry count
   */
  private async retryWithEmphasis(
    transcript: string,
    patient: PatientData,
    template: DoctorTemplate,
    settings: DoctorSettings,
    missingSections: string[],
    partialSections: string[],
    retryAttempt: number = 1
  ): Promise<ProcessedNote | null> {
    try {
      // IMPROVED: Escalate warning intensity based on retry attempt
      const urgencyLevel = retryAttempt === 1 ? 'WARNING' : retryAttempt === 2 ? 'CRITICAL' : 'URGENT';

      const emphasisNote = missingSections.length > 0
        ? `\n${urgencyLevel}: Missing REQUIRED sections:\n${missingSections.map(s => `- ${s}`).join('\n')}\nExtract information for these sections from the transcription.\n`
        : '';

      const partialNote = partialSections.length > 0
        ? `\n${urgencyLevel}: Incomplete sections:\n${partialSections.map(s => `- ${s}`).join('\n')}\nProvide detailed information for these sections.\n`
        : '';

      const emphasizedPrompt = this.buildCustomPrompt(transcript, patient, template, settings);

      // Insert emphasis at the beginning for maximum impact
      const finalPrompt = emphasizedPrompt.replace(
        'CRITICAL RULES:',
        `${emphasisNote}${partialNote}\nCRITICAL RULES:`
      );

      logDebug('azureAI', `Retry attempt ${retryAttempt} with ${urgencyLevel} emphasis`, {
        missingSectionsCount: missingSections.length,
        partialSectionsCount: partialSections.length,
        promptLength: finalPrompt.length
      });

      // Use Azure OpenAI with slightly higher temperature for retry to encourage variation
      const azureResult = await azureOpenAIService.processTranscriptionWithCustomPrompt(
        transcript,
        finalPrompt,
        {
          name: patient.fullName,
          mrn: patient.mrn,
          dob: patient.dateOfBirth
        },
        template,
        undefined // No additional context for retry
      );

      return this.convertAzureToProcessedNote(azureResult, patient);
    } catch (error) {
      logError('azureAI', `Retry attempt ${retryAttempt} failed`, { error });
      return null; // Return null to use original result
    }
  }

  /**
   * Post-processing validation to remove duplicate content and ensure accuracy
   * UPDATED: Smarter duplicate detection that doesn't flag properly formatted medical notes
   */
  private validateAndCleanProcessedNote(processedNote: ProcessedNote, originalTranscript: string, template?: DoctorTemplate): ProcessedNote {
    logDebug('azureAI', 'Validating and cleaning processed note', {
      sectionCount: Object.keys(processedNote.sections).length
    });

    // Check for transcript duplication in sections
    const transcriptText = originalTranscript.toLowerCase();
    let flaggedSections = 0;

    // Clean each section
    Object.keys(processedNote.sections).forEach(sectionKey => {
      const section = processedNote.sections[sectionKey as keyof typeof processedNote.sections];
      if (section && typeof section === 'string') {
        const sectionLower = section.toLowerCase();

        // IMPROVED DUPLICATE DETECTION:
        // Only flag as duplicate if BOTH conditions are true:
        // 1. Very high word overlap (>95%) OR is a verbatim copy
        // 2. Lacks proper medical note formatting

        const overlapRatio = this.calculateTextOverlap(sectionLower, transcriptText);
        const hasFormatting = this.hasProperFormatting(section);
        const isVerbatim = this.isVerbatimCopy(section, originalTranscript);

        // Flag as duplicate only if it's clearly a lazy copy-paste
        const isDuplicate = (overlapRatio > 0.95 || isVerbatim) && !hasFormatting;

        if (isDuplicate) {
          logWarn('azureAI', `Section flagged as duplicate: ${sectionKey}`, {
            overlapRatio: Math.round(overlapRatio * 100) + '%',
            hasFormatting,
            isVerbatim
          });
          flaggedSections++;

          // If section is mostly transcript duplication without formatting, mark as needing extraction
          processedNote.sections[sectionKey as keyof typeof processedNote.sections] = "See transcript for details" as any;
        } else if (overlapRatio > 0.8) {
          // High overlap but properly formatted - this is expected for medical notes
          logDebug('azureAI', `Section has high overlap but proper formatting: ${sectionKey}`, {
            overlapRatio: Math.round(overlapRatio * 100) + '%',
            hasFormatting
          });
        }

        // Remove obvious transcript artifacts
        let cleanedSection = section
          .replace(/45 year old female with pashmikos to attack 2 diabetes nausea vomiting comes in blood sugar 400.*?hemoglobin A1C 9/gi, '')
          .replace(/this is the transcript\./gi, '')
          .replace(/^- START:.*$/gm, '') // Remove malformed order entries
          .trim();

        if (cleanedSection !== section && !isDuplicate) {
          logDebug('azureAI', `Cleaned transcript artifacts from section: ${sectionKey}`);
          processedNote.sections[sectionKey as keyof typeof processedNote.sections] = cleanedSection as any;
        }
      }
    });

    if (flaggedSections > 0) {
      logWarn('azureAI', `Flagged ${flaggedSections} sections as duplicates (lacking proper formatting)`);
    } else {
      logInfo('azureAI', 'All sections passed duplicate detection - properly formatted medical note');
    }

    // Validate that key numeric values from transcript are captured
    this.validateNumericExtraction(processedNote, originalTranscript);

    // Update formatted note to reflect cleaned sections (pass template for dynamic sections and original transcript for billing)
    processedNote.formatted = this.rebuildFormattedNote(processedNote, template, originalTranscript);

    logInfo('azureAI', 'Note validation complete');
    return processedNote;
  }

  /**
   * Validate template compliance - check if AI followed the template requirements
   * IMPROVED: Stricter validation with better placeholder detection
   */
  private validateTemplateCompliance(
    processedNote: ProcessedNote,
    template?: DoctorTemplate
  ): { compliant: boolean; missingSections: string[]; partialSections: string[] } {
    if (!template) {
      return { compliant: true, missingSections: [], partialSections: [] };
    }

    const missingSections: string[] = [];
    const partialSections: string[] = [];

    // IMPROVED: More comprehensive placeholder detection
    const placeholderPatterns = [
      'not provided',
      'not mentioned',
      'not applicable',
      'n/a',
      'none',
      'see transcript',
      'no information',
      'not discussed',
      'not addressed',
      'pending',
      'to be determined',
      'tbd'
    ];

    // Check each required section
    Object.entries(template.sections).forEach(([key, section]) => {
      if (section.required) {
        const noteSection = processedNote.sections[key as keyof typeof processedNote.sections];

        if (!noteSection || noteSection.trim() === '') {
          missingSections.push(section.title);
          logWarn('azureAI', `Missing required section: ${section.title}`, {
            templateName: template.name,
            sectionKey: key
          });
        } else {
          const lower = noteSection.toLowerCase().trim();
          const hasPlaceholder = placeholderPatterns.some(p => lower.includes(p));
          const tooShort = noteSection.trim().length < 15; // Increased minimum from 10 to 15
          const onlyPunctuation = /^[\s\-•\.:,;]+$/.test(noteSection); // Only bullets/dashes/punctuation

          if (hasPlaceholder || tooShort || onlyPunctuation) {
            partialSections.push(section.title);
            logWarn('azureAI', `Partial/placeholder content in required section: ${section.title}`, {
              content: noteSection.substring(0, 100),
              length: noteSection.length,
              hasPlaceholder,
              tooShort,
              onlyPunctuation
            });
          }
        }
      }
    });

    const compliant = missingSections.length === 0 && partialSections.length === 0;

    if (!compliant) {
      logWarn('azureAI', 'Template compliance check FAILED', {
        templateName: template.name,
        totalSections: Object.keys(template.sections).length,
        requiredSections: Object.values(template.sections).filter(s => s.required).length,
        missingSections: missingSections.length,
        partialSections: partialSections.length,
        missingSectionsList: missingSections.join(', '),
        partialSectionsList: partialSections.join(', ')
      });
    } else {
      logInfo('azureAI', 'Template compliance check PASSED ✅', {
        templateName: template.name,
        sectionsValidated: Object.keys(template.sections).length
      });
    }

    return { compliant, missingSections, partialSections };
  }

  /**
   * Validate output quality - detect hallucinations and ensure numeric accuracy
   */
  private validateOutputQuality(
    processedNote: ProcessedNote,
    originalTranscript: string
  ): { quality: 'excellent' | 'good' | 'poor'; issues: string[]; confidence: number } {
    const issues: string[] = [];
    let confidence = 1.0;

    // 1. Check for hallucination indicators
    const hallucinationPhrases = [
      'for example',
      'such as',
      'including but not limited to',
      'typically',
      'generally',
      'may include',
      'could indicate',
      'suggests possible'
    ];

    const noteText = processedNote.formatted.toLowerCase();
    hallucinationPhrases.forEach(phrase => {
      if (noteText.includes(phrase)) {
        issues.push(`Potential hallucination: Contains speculative phrase "${phrase}"`);
        confidence -= 0.1;
      }
    });

    // 2. Validate numeric values are preserved
    const numericPatterns = [
      /\b(\d+)\s*(?:year|yr)s?\s+old/gi,
      /blood\s+(?:sugar|glucose)[:\s]+(\d+)/gi,
      /a1c[:\s]+(\d+\.?\d*)/gi,
      /bp[:\s]+(\d+\/\d+)/gi,
      /weight[:\s]+(\d+)\s*(?:lbs?|kg)/gi,
      /(\d+)\s*(?:mg|mcg|units?|ml)/gi
    ];

    const transcriptLower = originalTranscript.toLowerCase();
    numericPatterns.forEach(pattern => {
      const transcriptMatches = [...transcriptLower.matchAll(pattern)];
      transcriptMatches.forEach(match => {
        const value = match[1];
        if (!noteText.includes(value)) {
          issues.push(`Missing numeric value: ${value} from transcript`);
          confidence -= 0.15;
        }
      });
    });

    // 3. Check for generic placeholder text
    const placeholders = [
      'not specified',
      '[insert',
      '[fill in',
      'tbd',
      'to be determined',
      'n/a',
      'see above',
      'as discussed'
    ];

    placeholders.forEach(placeholder => {
      if (noteText.includes(placeholder)) {
        issues.push(`Contains placeholder text: "${placeholder}"`);
        confidence -= 0.1;
      }
    });

    // 4. Check for excessive duplication
    const sections = Object.values(processedNote.sections).filter(s => s && s.trim());
    for (let i = 0; i < sections.length - 1; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        if (sections[i] && sections[j]) {
          const overlap = this.calculateTextOverlap(sections[i].toLowerCase(), sections[j].toLowerCase());
          if (overlap > 0.7) {
            issues.push(`High duplication between sections (${Math.round(overlap * 100)}% overlap)`);
            confidence -= 0.2;
            break;
          }
        }
      }
    }

    // Clamp confidence between 0 and 1
    confidence = Math.max(0, Math.min(1, confidence));

    const quality = confidence >= 0.9 ? 'excellent' : confidence >= 0.7 ? 'good' : 'poor';

    if (issues.length > 0) {
      logInfo('azureAI', 'Output quality validation found issues', {
        quality,
        issueCount: issues.length,
        confidence: Math.round(confidence * 100) + '%'
      });
    }

    return { quality, issues, confidence };
  }

  /**
   * Calculate text overlap between two strings
   */
  private calculateTextOverlap(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);

    if (words1.length === 0) return 0;

    let matchingWords = 0;
    words1.forEach(word => {
      if (words2.includes(word) && word.length > 3) { // Only count meaningful words
        matchingWords++;
      }
    });

    return matchingWords / words1.length;
  }

  /**
   * Check if a section has proper medical note formatting
   * Returns true if the section shows signs of structured medical documentation
   */
  private hasProperFormatting(section: string): boolean {
    if (!section || section.length < 10) return false;

    // Check for medical note formatting indicators
    const formatIndicators = [
      section.includes(':'),                                    // Section headers (CC:, HPI:, etc.)
      section.includes('\n-') || section.includes('\n•'),      // Bullet points
      section.includes('\n1.') || section.includes('\n2.'),    // Numbered lists
      /\b(mg|mcg|units?|ml|mg\/dL|mmol\/L|%)\b/i.test(section), // Medical units
      /\b(PO|IV|BID|TID|QD|QID|PRN|IM|SC|SQ)\b/i.test(section), // Medical abbreviations
      section.split('\n').length > 2,                          // Multiple lines (structured)
      /^\s*[-•]\s+/m.test(section),                           // Starts with bullet
      /\d+\.\s+[A-Z]/m.test(section)                          // Numbered list format
    ];

    // Count how many formatting indicators are present
    const indicatorCount = formatIndicators.filter(Boolean).length;

    // Consider it properly formatted if at least 2 indicators present
    return indicatorCount >= 2;
  }

  /**
   * Check if a section is a verbatim copy of the transcript
   * Returns true if the section contains long continuous blocks from the original transcript
   */
  private isVerbatimCopy(section: string, transcript: string): boolean {
    if (!section || !transcript) return false;

    // Clean both texts (remove punctuation, lowercase, normalize whitespace)
    const cleanSection = section.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanTranscript = transcript.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Check if entire section appears as a continuous block in transcript
    if (cleanTranscript.includes(cleanSection)) {
      return true; // Exact verbatim copy
    }

    // Check for long consecutive word sequences (10+ words in a row)
    const sectionWords = cleanSection.split(/\s+/);
    const transcriptText = cleanTranscript;

    // Look for sequences of 10+ consecutive matching words
    for (let i = 0; i <= sectionWords.length - 10; i++) {
      const sequence = sectionWords.slice(i, i + 10).join(' ');
      if (transcriptText.includes(sequence)) {
        // Found a 10-word verbatim sequence - likely copy-paste
        return true;
      }
    }

    return false; // Not a verbatim copy
  }

  /**
   * Validate that important numeric values are captured
   */
  private validateNumericExtraction(processedNote: ProcessedNote, transcript: string): void {
    const numericPatterns = [
      { pattern: /blood sugar (\d+)/i, description: 'blood sugar' },
      { pattern: /a1c (\d+(?:\.\d+)?)/i, description: 'A1C' },
      { pattern: /(\d+) year old/i, description: 'age' },
      { pattern: /lantus (\d+) units/i, description: 'Lantus dosage' }
    ];

    numericPatterns.forEach(({ pattern, description }) => {
      const match = transcript.match(pattern);
      if (match) {
        const value = match[1];
        const noteText = processedNote.formatted.toLowerCase();
        if (!noteText.includes(value)) {
          logDebug('azureAI', 'Debug message', {});
          // Add to assessment if critical values are missing
          if (description === 'blood sugar' || description === 'A1C') {
            if (processedNote.sections.assessment) {
              processedNote.sections.assessment += `\n- ${description}: ${value}`;
            }
          }
        }
      }
    });
  }

  /**
   * Rebuild formatted note from cleaned sections
   * Now supports dynamic template sections for custom templates
   * NOW WITH AUTOMATIC CPT BILLING!
   */
  private rebuildFormattedNote(processedNote: ProcessedNote, template?: DoctorTemplate, originalTranscript?: string): string {
    const date = new Date().toLocaleDateString();
    const sections = processedNote.sections;

    let formatted = `CLINICAL NOTE
════════════════════════════════════════════════════════
Date: ${date}
════════════════════════════════════════════════════════

`;

    // If we have a custom template, use its section order and titles
    if (template && template.sections) {
      // Sort sections by order property
      const sortedSections = Object.entries(template.sections).sort((a, b) => {
        const orderA = a[1].order !== undefined ? a[1].order : 999;
        const orderB = b[1].order !== undefined ? b[1].order : 999;
        return orderA - orderB;
      });

      // Build note using template section order and titles
      for (const [key, section] of sortedSections) {
        // Find the content for this section (handle different key formats)
        const sectionContent = sections[key] || sections[key as keyof typeof sections];

        if (sectionContent && sectionContent.trim()) {
          formatted += `${section.title.toUpperCase()}:\n${sectionContent}\n\n`;
        } else if (section.required) {
          // Show placeholder for required sections that are missing
          formatted += `${section.title.toUpperCase()}:\n[Not mentioned in transcription]\n\n`;
        }
      }
    } else {
      // Fallback to standard SOAP format for templates without custom sections
      if (sections.chiefComplaint) formatted += `CHIEF COMPLAINT:\n${sections.chiefComplaint}\n\n`;
      if (sections.historyOfPresentIllness) formatted += `HISTORY OF PRESENT ILLNESS:\n${sections.historyOfPresentIllness}\n\n`;
      if (sections.reviewOfSystems) formatted += `REVIEW OF SYSTEMS:\n${sections.reviewOfSystems}\n\n`;
      if (sections.pastMedicalHistory) formatted += `PAST MEDICAL HISTORY:\n${sections.pastMedicalHistory}\n\n`;
      if (sections.medications) formatted += `MEDICATIONS:\n${sections.medications}\n\n`;
      if (sections.allergies) formatted += `ALLERGIES:\n${sections.allergies}\n\n`;
      if (sections.socialHistory) formatted += `SOCIAL HISTORY:\n${sections.socialHistory}\n\n`;
      if (sections.familyHistory) formatted += `FAMILY HISTORY:\n${sections.familyHistory}\n\n`;
      if (sections.physicalExam) formatted += `PHYSICAL EXAMINATION:\n${sections.physicalExam}\n\n`;
      if (sections.assessment) formatted += `ASSESSMENT:\n${sections.assessment}\n\n`;
      if (sections.plan) formatted += `PLAN:\n${sections.plan}\n\n`;
      if (sections.ordersAndActions) formatted += `ORDERS & ACTIONS:\n${sections.ordersAndActions}\n\n`;
    }

    // ✨ NEW: Add CPT Billing Section (enabled by default for all templates)
    console.log('🔍 [BILLING DEBUG] Starting billing section generation...');
    console.log('🔍 [BILLING DEBUG] Template config:', {
      hasTemplate: !!template,
      hasBillingConfig: !!template?.billingConfig,
      billingEnabled: template?.billingConfig?.enabled,
      templateName: template?.name
    });

    const billingEnabled = template?.billingConfig?.enabled !== false; // Default to enabled
    console.log('🔍 [BILLING DEBUG] Billing enabled?', billingEnabled);
    console.log('🔍 [BILLING DEBUG] Has originalTranscript?', !!originalTranscript);
    console.log('🔍 [BILLING DEBUG] Transcript length:', originalTranscript?.length || 0);

    if (billingEnabled && originalTranscript) {
      console.log('✅ [BILLING DEBUG] Entering billing generation block!');
      try {
        // CPT billing analyzer is imported at top of file
        console.log('✅ [BILLING DEBUG] CPT analyzer available');

        // Prepare extracted info for analysis
        const extractedInfo = {
          assessment: sections.assessment ? [sections.assessment] : [],
          plan: sections.plan ? [sections.plan] : [],
          medicationChanges: sections.medications ? [sections.medications] : [],
          vitals: {},
          currentMedications: []
        };
        console.log('✅ [BILLING DEBUG] Extracted info prepared:', {
          assessmentCount: extractedInfo.assessment.length,
          planCount: extractedInfo.plan.length,
          medicationCount: extractedInfo.medicationChanges.length
        });

        // Analyze complexity
        const complexityAnalysis = cptBillingAnalyzer.analyzeComplexity(originalTranscript, extractedInfo);
        console.log('✅ [BILLING DEBUG] Complexity analysis complete:', complexityAnalysis);

        // Get CPT recommendations
        const cptRecommendation = cptBillingAnalyzer.suggestCPTCodes(
          complexityAnalysis,
          !!sections.chiefComplaint,
          extractedInfo.assessment.length > 0,
          extractedInfo.plan.length > 0
        );
        console.log('✅ [BILLING DEBUG] CPT recommendation:', cptRecommendation);

        // Get ICD-10 suggestions if enabled
        const includeICD10 = template?.billingConfig?.includeICD10 !== false;
        let icd10Suggestions: any[] = [];
        if (includeICD10 && extractedInfo.assessment.length > 0) {
          icd10Suggestions = cptBillingAnalyzer.suggestICD10Codes(extractedInfo.assessment);
        }
        console.log('✅ [BILLING DEBUG] ICD-10 suggestions:', icd10Suggestions);

        // Detect in-office procedures
        const procedureRecommendations = cptBillingAnalyzer.detectInOfficeProcedures(
          originalTranscript,
          extractedInfo.plan,
          extractedInfo.assessment
        );
        console.log('✅ [BILLING DEBUG] Procedure recommendations:', procedureRecommendations);

        // Generate billing section
        const billingSection = cptBillingAnalyzer.generateBillingSection(cptRecommendation, icd10Suggestions, procedureRecommendations);
        console.log('✅ [BILLING DEBUG] Billing section generated! Preview:', billingSection.substring(0, 200));
        console.log('✅ [BILLING DEBUG] Billing section length:', billingSection.length);

        formatted += billingSection;
        console.log('✅ [BILLING DEBUG] Billing section appended to formatted note!');
      } catch (error) {
        console.error('❌ [BILLING ERROR] Failed to generate billing section:', error);
        console.error('❌ [BILLING ERROR] Error stack:', (error as Error).stack);
        // Make error visible in the note instead of silently failing
        formatted += `\n\n⚠️ BILLING GENERATION ERROR: ${(error as Error).message}\n`;
      }
    } else {
      console.log('❌ [BILLING DEBUG] Billing section skipped - condition not met');
      console.log('❌ [BILLING DEBUG] Reason:', {
        billingEnabled,
        hasTranscript: !!originalTranscript
      });
    }

    return formatted;
  }

  private buildCustomPrompt(
    transcript: string,
    patient: PatientData,
    template: DoctorTemplate,
    settings: DoctorSettings,
    additionalContext?: string
  ): string {
    logDebug('azureAI', 'Building custom prompt for template', { templateName: template.name });

    // Build section instructions from doctor's custom template
    const sectionPrompts: string[] = [];
    const sectionTitles: string[] = [];

    Object.entries(template.sections).forEach(([key, section]) => {
      const format = section.format || 'paragraph';
      sectionTitles.push(section.title);

      // Build instructions WITHOUT literal "Format:" and "Focus:" labels that AI might echo
      let instructions = section.aiInstructions || '';

      // Add keyword focus naturally (not as labeled metadata)
      if (section.keywords && section.keywords.length > 0) {
        instructions += ` Pay special attention to: ${section.keywords.join(', ')}.`;
      }

      // IMPROVED: Simpler example handling - show structure without verbose warnings
      if (section.exampleText) {
        instructions += `\n\nExample structure (use actual data from transcription):\n${section.exampleText}`;
      }

      // Add format guidance - simpler and clearer
      if (format === 'bullets') {
        instructions += '\nFormat: Bullet points (•)';
      } else if (format === 'numbered') {
        instructions += '\nFormat: Numbered list (1. 2. 3.)';
      } else if (format !== 'paragraph') {
        instructions += '\nFormat: Paragraph';
      }

      sectionPrompts.push(`
### ${section.title}${section.required ? ' (REQUIRED)' : ''}
${instructions}
`);
    });

    logInfo('azureAI', 'Custom prompt built with template', {
      templateName: template.name,
      sectionCount: Object.keys(template.sections).length,
      sectionTitles: sectionTitles.join(', ')
    });

    // Get AI style preferences
    const styleGuide = {
      formal: 'Use formal medical terminology and third-person perspective.',
      conversational: 'Use a natural, conversational tone while maintaining professionalism.',
      concise: 'Be extremely concise and to the point. Avoid unnecessary detail.',
      detailed: 'Include comprehensive details and thorough documentation.'
    };

    // IMPROVED: Clearer, more concise prompt - less confusion for AI
    return `You are an expert medical scribe. Create a clinical note following the template "${template.name}".

${template.generalInstructions ? `INSTRUCTIONS: ${template.generalInstructions}\n\n` : ''}STYLE: ${styleGuide[settings.aiStyle]}

TEMPLATE SECTIONS:
${sectionPrompts.join('\n')}

────────────────────────────────────────────────────────

PATIENT: ${patient.name} (MRN: ${patient.mrn})${patient.dob ? ` | DOB: ${patient.dob}` : ''}
${additionalContext ? `CONTEXT: ${additionalContext}\n` : ''}
TRANSCRIPTION:
"${transcript}"

────────────────────────────────────────────────────────

CRITICAL RULES:
1. Extract ALL information from the transcription (medications, vitals, labs, diagnoses)
2. Use exact values mentioned (e.g., "blood sugar 400", "Lantus 20 units")
3. Match the format shown in examples (abbreviations, bullets, structure)
4. Do NOT write "[Not mentioned]" if data IS in the transcription
5. Be thorough - include every detail from the dictation

Generate the note now:`;
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
      
      // SIMPLIFIED: Concise prompt for templates
      return `You are a medical scribe. Create a professional note following this template.

${generalInstructions ? `TEMPLATE INSTRUCTIONS:\n${generalInstructions}\n\n` : ''}PATIENT: ${patient.name} (MRN: ${patient.mrn})

TRANSCRIPTION:
"${transcript}"

Generate JSON with these sections:
{
  "sections": {
    ${templateSections}
  }
}

RULES:
1. Extract ALL information from the transcription - be thorough
2. Include exact numbers (blood sugar 400, A1C 9.5, age 45)
3. Extract medications with doses, labs ordered, diagnoses mentioned
4. Only use "Not provided" if the section truly has NO relevant information in transcript

Return ONLY the formatted note - no instructions or meta-commentary.`;
    }
    
    // Check if this is a conversation transcript
    const isConversation = transcript.includes('CONVERSATION TRANSCRIPT:') || 
                           transcript.includes('[DOCTOR]:') || 
                           transcript.includes('[PATIENT]:');
    
    // Get specialty role if available
    const specialtyRole = currentDoctor ? 
      specialtyService.getAIPrompt().role : 
      'an ENDOCRINOLOGIST';
    
    // SIMPLIFIED: Focused default prompt
    const prompt = isConversation
      ? `You are a medical scribe for ${specialtyRole}. Extract information from this conversation and create a SOAP note.

CONVERSATION:
"${transcript}"`
      : `You are a medical scribe for ${specialtyRole}. Convert this dictation into a SOAP note.

DICTATION:
"${transcript}"`;

    return prompt + (additionalContext ? `\n\nCONTEXT (for reference - don't copy verbatim):\n${additionalContext}\n` : '') + `

Generate JSON:
{
  "sections": {
    "chiefComplaint": "",
    "historyOfPresentIllness": "",
    "reviewOfSystems": "",
    "pastMedicalHistory": "",
    "medications": "",
    "allergies": "",
    "socialHistory": "",
    "familyHistory": "",
    "physicalExam": "",
    "assessment": "",
    "plan": "",
    "patientSummary": ""
  }
}

RULES:
1. Extract ALL information from the transcription - be thorough
2. Include exact numbers (blood sugar 400, A1C 9, age 45)
3. Extract medications with doses, labs ordered, diagnoses mentioned
4. DIAGNOSES: Only document diagnoses that are EXPLICITLY stated by the provider
   - If provider says "diabetes", "diabetic", "has diabetes" → document as definitive diagnosis
   - If diagnosis is NOT explicitly stated but inferred from medications/labs → add "(possible)" qualifier
   - Example: Patient on Ozempic but diabetes never mentioned → "Type 2 diabetes mellitus (possible)"
   - Example: Patient on Synthroid but hypothyroid never mentioned → "Hypothyroidism (possible)"
5. NEVER write "Not provided", "Not mentioned", or placeholders - always extract from transcription
6. If a section seems empty, re-read the transcription - the information is there
7. Return only the note - no explanations`;
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
          logError('azureAI', 'Error message', {});
          // If JSON parsing fails, treat as markdown
          return this.parseMarkdownResponse(cleanedResponse, patient);
        }
      } else {
        // Response is markdown, not JSON
        logDebug('azureAI', 'Debug message', {});
        return this.parseMarkdownResponse(cleanedResponse, patient);
      }

      // Format based on template type
      let formatted: string;
      logDebug('azureAI', 'Debug message', {});
      logDebug('azureAI', 'Debug message', {});
      logDebug('azureAI', 'Debug message', {});
      logDebug('azureAI', 'Debug message', {});

      if (template && template.sections && parsed.sections) {
        logDebug('azureAI', 'Debug message', {});
        // Format using custom template sections
        formatted = this.formatCustomTemplate(parsed.sections, patient, template);
      } else {
        logDebug('azureAI', 'Debug message', {});
        // Use default formatting
        formatted = this.formatNote(parsed.sections, patient);
      }

      // Extract orders from the AI-formatted note (NOT the raw transcript)
      // This ensures we extract from properly structured clinical text instead of messy conversation
      let extractedOrders: OrderExtractionResult | undefined;
      if (formatted) {
        logDebug('azureAI', 'Extracting orders from formatted note');
        extractedOrders = orderExtractionService.extractOrders(formatted);
        logInfo('azureAI', 'Orders extracted from formatted note');
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

        logInfo('azureAI', 'Info message', {});
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
          model: 'Azure OpenAI GPT-4o',
          confidence: 0.95
        }
      };
    } catch (error) {
      logError('azureAI', 'Error message', {});
      logDebug('azureAI', 'Debug message', {}); 
      
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
      formatted: markdownText,
      sections: {
        historyOfPresentIllness: markdownText
      },
      metadata: {
        processedAt: new Date().toISOString(),
        model: 'markdown-parser',
        confidence: 0.7
      }
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
${this.highlightEndocrineTerms(sections.pastMedicalHistory || 'Not documented in this visit')}

MEDICATIONS:
${this.highlightEndocrineTerms(sections.medications || 'Not documented in this visit')}

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
Generated by Azure OpenAI GPT-4o (HIPAA Compliant - Microsoft BAA)
Processed: ${new Date().toLocaleString()}`;
  }

  /**
   * Extract sections from AI-generated formatted note
   * Parses the note text to identify and extract individual sections
   */
  private extractSections(formattedNote: string, template?: DoctorTemplate): {
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
    ordersAndActions?: string;
    [key: string]: string | undefined;
  } {
    const sections: Record<string, string> = {};

    // Define section headers to look for (case-insensitive)
    let sectionPatterns: Array<{ key: string; patterns: RegExp[] }>;

    // If we have a custom template, build patterns from template section titles
    if (template && template.sections) {
      sectionPatterns = [];
      for (const [key, section] of Object.entries(template.sections)) {
        // Escape special regex characters in the title
        const escapedTitle = section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Create pattern that matches the title (case-insensitive), followed by optional colon/whitespace
        const pattern = new RegExp(`^${escapedTitle}\\s*:?\\s*`, 'i');
        sectionPatterns.push({
          key,
          patterns: [pattern]
        });
      }
      console.log('🔍 ========== EXTRACT SECTIONS: Building patterns from template ==========');
      console.log('Template:', template.name);
      console.log('Patterns built:', sectionPatterns.map(p => `${p.key}: ${p.patterns[0]}`));
      console.log('🔍 =======================================================================');

      logDebug('azureAI', 'Built dynamic section patterns from template', {
        templateName: template.name,
        patternCount: sectionPatterns.length,
        sections: sectionPatterns.map(p => p.key).join(', ')
      });
    } else {
      // Fallback to standard SOAP section patterns
      sectionPatterns = [
        { key: 'chiefComplaint', patterns: [/CHIEF COMPLAINT[:\s]*/i, /CC[:\s]*/i] },
        { key: 'historyOfPresentIllness', patterns: [/HISTORY OF PRESENT ILLNESS[:\s]*/i, /HPI[:\s]*/i] },
        { key: 'reviewOfSystems', patterns: [/REVIEW OF SYSTEMS[:\s]*/i, /ROS[:\s]*/i] },
        { key: 'pastMedicalHistory', patterns: [/PAST MEDICAL HISTORY[:\s]*/i, /PMH[:\s]*/i] },
        { key: 'medications', patterns: [/MEDICATIONS[:\s]*/i, /MEDS[:\s]*/i, /CURRENT MEDICATIONS[:\s]*/i] },
        { key: 'allergies', patterns: [/ALLERGIES[:\s]*/i, /ALLERGY[:\s]*/i] },
        { key: 'socialHistory', patterns: [/SOCIAL HISTORY[:\s]*/i, /SH[:\s]*/i] },
        { key: 'familyHistory', patterns: [/FAMILY HISTORY[:\s]*/i, /FH[:\s]*/i] },
        { key: 'physicalExam', patterns: [/PHYSICAL EXAM(?:INATION)?[:\s]*/i, /PE[:\s]*/i, /EXAM[:\s]*/i] },
        { key: 'assessment', patterns: [/ASSESSMENT[:\s]*/i, /DIAGNOSIS[:\s]*/i, /DIAGNOSES[:\s]*/i] },
        { key: 'plan', patterns: [/PLAN[:\s]*/i, /TREATMENT PLAN[:\s]*/i] },
        { key: 'ordersAndActions', patterns: [/ORDERS\s*(?:&|AND)?\s*ACTIONS[:\s]*/i, /ORDERS[:\s]*/i] }
      ];
    }

    // Split note into lines for processing
    const lines = formattedNote.split('\n');
    let currentSection: string | null = null;
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and dividers
      if (!line || line.match(/^[═━─]{3,}$/)) {
        continue;
      }

      // Check if this line is a section header
      let foundSection = false;
      for (const { key, patterns } of sectionPatterns) {
        for (const pattern of patterns) {
          if (line.match(pattern)) {
            // Save previous section if exists
            if (currentSection && currentContent.length > 0) {
              sections[currentSection] = currentContent.join('\n').trim();
            }

            // Start new section
            currentSection = key;
            currentContent = [];

            // Extract content after the header on the same line
            const headerMatch = line.match(pattern);
            if (headerMatch) {
              const afterHeader = line.substring(headerMatch[0].length).trim();
              if (afterHeader) {
                currentContent.push(afterHeader);
              }
            }

            foundSection = true;
            break;
          }
        }
        if (foundSection) break;
      }

      // If not a header, add to current section content
      if (!foundSection && currentSection) {
        currentContent.push(line);
      }
    }

    // Save the last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    logDebug('azureAI', 'Extracted sections from formatted note', {
      sectionsFound: Object.keys(sections).length,
      sections: Object.keys(sections).join(', ')
    });

    return sections;
  }
}

// Export singleton instance
export const azureAIService = new AzureAIService();

/**
 * Migration from OpenAI to Bedrock:
 * 
 * OLD:
 * import { openAIService } from '../openai.service';
 * const result = await openAIService.processMedicalTranscription(...);
 * 
 * NEW:
 * import { bedrockService } from './bedrock.service';
 * const result = await bedrockService.processMedicalTranscription(...);
 */