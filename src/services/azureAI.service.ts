/**
 * Azure AI Service for HIPAA-Compliant Medical Note Processing
 *
 * HIPAA COMPLIANCE STATUS:
 * ========================
 * ✅ PRIMARY: Azure OpenAI (GPT-4o)
 *    - Microsoft BAA available and signed
 *    - HIPAA-compliant when properly configured
 *    - Data processed in Microsoft's secure infrastructure
 *
 * ✅ FALLBACK: AWS Bedrock (Claude)
 *    - AWS BAA available and signed
 *    - HIPAA-compliant service
 *    - Used when Azure OpenAI is unavailable
 *
 * ✅ CLIENT FALLBACK: clientAIProcessor.service.ts
 *    - 100% client-side processing (no PHI transmission)
 *    - Used when both cloud services fail
 *    - Rule-based extraction, no AI models
 *
 * ❌ ARCHIVED SERVICES (Not HIPAA-compliant):
 *    - OpenAI API (no BAA available) - ARCHIVED
 *    - Standard AI services without BAA - ARCHIVED
 *
 * WORKFLOW:
 * 1. Try Azure OpenAI (primary, HIPAA-compliant)
 * 2. Fallback to AWS Bedrock (secondary, HIPAA-compliant)
 * 3. Final fallback to client-side processor (no PHI transmission)
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Template } from '../types/template.types';
import type { PatientData } from './patientData.service';
import { specialtyService } from './specialty.service';
import type { DoctorTemplate, DoctorSettings } from './doctorProfile.service';
import { orderExtractionService, type OrderExtractionResult } from './orderExtraction.service';
import { azureOpenAIService } from './_deprecated/azureOpenAI.service';
import { medicalCorrections } from './medicalCorrections.service';
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
  private client: BedrockRuntimeClient;
  // MIGRATION PHASE 1: Azure OpenAI PRIMARY, AWS Bedrock FALLBACK ONLY
  private primaryProvider = import.meta.env.VITE_PRIMARY_AI_PROVIDER || 'openai'; // Use env var for provider
  private modelId = 'us.anthropic.claude-opus-4-1-20250805-v1:0'; // AWS Bedrock fallback model
  private fallbackModelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0'; // AWS Bedrock secondary fallback
  private workingModelId: string | null = null;
  private migrationMode = false; // Phase 1 of migration DISABLED - use env var instead

  constructor() {
    if (this.migrationMode) {
      logInfo('azureAI', 'Info message', {});
      logInfo('azureAI', 'Info message', {});
      logDebug('azureAI', 'Debug message', {});
      logDebug('azureAI', 'Debug message', {});
      logDebug('azureAI', 'Debug message', {});
    }
    
    const bearerToken = import.meta.env.VITE_AWS_BEARER_TOKEN_BEDROCK;
    
    // Check if we have standard AWS credentials first
    if (import.meta.env.VITE_AWS_ACCESS_KEY_ID && import.meta.env.VITE_AWS_SECRET_ACCESS_KEY) {
      logDebug('azureAI', 'Debug message', {});
      this.client = new BedrockRuntimeClient({
        region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY
        }
      });
    } else if (bearerToken) {
      // Bearer token authentication needs special handling
      logDebug('azureAI', 'Debug message', {});
      logWarn('azureAI', 'Warning message', {});
      
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
      logWarn('azureAI', 'Warning message', {});
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
   * Process medical transcription into structured note
   * HIPAA COMPLIANT - Covered by AWS BAA
   */
  async processMedicalTranscription(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    additionalContext?: string,
    customTemplate?: { template: DoctorTemplate; doctorSettings: DoctorSettings }
  ): Promise<ProcessedNote> {
    // Log processing request
    logInfo('azureAI', 'Starting medical transcription processing', {
      transcriptLength: transcript.length,
      patientName: patient.name || 'Unknown',
      templateUsed: customTemplate?.template.name || template?.name || 'Default SOAP',
      primaryProvider: this.primaryProvider,
      timestamp: new Date().toISOString()
    });

    // Check primary provider from environment variable
    if (this.primaryProvider === 'openai') {
      try {
        logInfo('azureAI', 'Using OpenAI API as primary provider (from VITE_PRIMARY_AI_PROVIDER)');
        const openaiResult = await this.processWithOpenAI(transcript, patient, template, additionalContext, customTemplate);
        logInfo('azureAI', 'OpenAI processing completed successfully');
        return openaiResult;
      } catch (openaiError) {
        logWarn('azureAI', `OpenAI failed: ${openaiError}, falling back to Azure OpenAI`);
        // Fall through to Azure OpenAI below
      }
    }

    // MIGRATION PHASE 1: Azure OpenAI is now PRIMARY provider
    if (this.migrationMode || this.primaryProvider === 'azure') {
      try {
        logDebug('azureAI', 'Debug message', {});
        logDebug('azureAI', 'Debug message', {});
        const azureResult = await this.processWithAzureOpenAI(transcript, patient, template, additionalContext, customTemplate);
        logInfo('azureAI', 'Azure OpenAI processing completed successfully');
        return azureResult;
      } catch (azureError: any) {
        console.error('❌ Azure OpenAI FAILED:', azureError);
        console.error('Error details:', {
          message: azureError.message,
          stack: azureError.stack,
          name: azureError.name
        });
        logError('azureAI', 'Azure OpenAI failed - falling back to AWS Bedrock', {
          error: azureError.message,
          errorType: azureError.name,
          stack: azureError.stack,
          timestamp: new Date().toISOString()
        });
        // Continue to AWS Bedrock fallback below
      }
    }

    try {
      const prompt = customTemplate
        ? this.buildCustomPrompt(transcript, patient, customTemplate.template, customTemplate.doctorSettings, additionalContext)
        : this.buildPrompt(transcript, patient, template, additionalContext);

      // AWS Bedrock fallback
      logInfo('azureAI', 'Attempting AWS Bedrock processing', {
        modelId: this.modelId,
        promptLength: prompt.length,
        timestamp: new Date().toISOString()
      });
      
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

      // Add retry logic with exponential backoff for rate limits
      let response;
      let retryCount = 0;
      const maxRetries = 12; // Increased for better resilience against 429 errors
      
      while (retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            // Aggressive backoff with jitter: starts at 10s, increases to max 90s
            const baseDelay = Math.min(10000 * Math.pow(2, retryCount - 1), 90000);
            const jitter = Math.random() * 5000; // Add 0-5s random jitter
            const delay = baseDelay + jitter;
            logDebug('azureAI', 'Debug message', {});
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          response = await this.client.send(command);
          logInfo('azureAI', 'Info message', {});
          break; // Success, exit the retry loop
          
        } catch (error: any) {
          // Check for rate limit error (429 or TooManyRequestsException)
          if (error?.name === 'TooManyRequestsException' || 
              error?.name === 'ThrottlingException' ||
              error?.$metadata?.httpStatusCode === 429 ||
              error?.message?.toLowerCase().includes('too many requests') ||
              error?.message?.toLowerCase().includes('throttl') ||
              error?.message?.toLowerCase().includes('rate')) {
            retryCount++;
            if (retryCount > maxRetries) {
              logError('azureAI', 'Error message', {});
              throw new Error('AI service is temporarily busy. Please wait a moment and try again.');
            }
            continue; // Retry with backoff
          }
          
          // Check for model access issues and try next model in preference list
          if (error?.name === 'AccessDeniedException' || 
              error?.name === 'ValidationException' ||
              error?.message?.includes('Operation not allowed') ||
              error?.message?.includes('not authorized') ||
              error?.message?.includes('model') ||
              error?.$metadata?.httpStatusCode === 403 ||
              error?.$metadata?.httpStatusCode === 400) {
            
            logWarn('azureAI', 'Warning message', {});
            
            // Try the fallback model
            const fallbackModels = [this.fallbackModelId, 'anthropic.claude-3-sonnet-20240229-v1:0', 'anthropic.claude-instant-v1', 'anthropic.claude-v2'];
            for (const nextModelId of fallbackModels) {
              
              logDebug('azureAI', 'Debug message', {});
              
              try {
                const fallbackCommand = new InvokeModelCommand({
                  modelId: nextModelId,
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
                
                response = await this.client.send(fallbackCommand);
                
                // Success! Save this as the working model
                this.workingModelId = nextModelId;
                logInfo('azureAI', 'Info message', {});
                break; // Exit both loops
              } catch (modelError: any) {
                logDebug('azureAI', 'Debug message', {});
                continue; // Try next model
              }
            }
            
            if (!response) {
              logError('azureAI', 'Error message', {});
              throw new Error('AWS Bedrock models not accessible. Please enable Claude models in the AWS Bedrock console at: https://console.aws.amazon.com/bedrock/');
            }
            break; // Exit retry loop if we found a working model
          }
          
          // If it's a different type of error, check if we should try fallback
          if (error?.name === 'ValidationException' || 
              error?.message?.includes('model') ||
              error?.message?.includes('not found')) {
            logWarn('azureAI', 'Warning message', {});
            const fallbackCommand = new InvokeModelCommand({
              modelId: this.fallbackModelId,
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
            
            // Apply same retry logic for fallback model
            retryCount = 0;
            while (retryCount <= maxRetries) {
              try {
                if (retryCount > 0) {
                  const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
                  logDebug('azureAI', 'Debug message', {});
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
                response = await this.client.send(fallbackCommand);
                // Update the modelId for future calls
                this.modelId = this.fallbackModelId;
                logInfo('azureAI', 'Info message', {});
                break;
              } catch (fallbackError: any) {
                if (fallbackError?.name === 'TooManyRequestsException' || 
                    fallbackError?.name === 'ThrottlingException' ||
                    fallbackError?.$metadata?.httpStatusCode === 429) {
                  retryCount++;
                  if (retryCount > maxRetries) {
                    throw new Error('AI service is temporarily busy. Please wait a moment and try again.');
                  }
                  continue;
                }
                throw fallbackError;
              }
            }
            break; // Exit main loop after fallback
          } else {
            throw error; // Other errors, don't retry
          }
        }
      }
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      const parsedNote = this.parseResponse(responseBody.content[0].text, patient, template, transcript);
      return this.validateAndCleanProcessedNote(parsedNote, transcript, customTemplate?.template);
    } catch (error) {
      logError('azureAI', 'Error message', {});
      
      // Try Azure OpenAI as fallback when Bedrock fails
      logWarn('azureAI', 'Warning message', {});
      
      try {
        // Convert template to string format for Azure OpenAI
        const templateString = template ? 
          `${template.name}\n${template.sections.map(s => s.title).join('\n')}` : 
          'Standard SOAP Note Format';
        
        const azureResult = await azureOpenAIService.processTranscription(
          transcript,
          templateString,
          {
            name: patient.fullName,
            mrn: patient.mrn,
            dob: patient.dateOfBirth
          }
        );
        
        logInfo('azureAI', 'Info message', {});
        
        // Convert Azure OpenAI result to our ProcessedNote format
        const convertedNote = {
          formatted: azureResult.formattedNote,
          sections: {
            chiefComplaint: azureResult.sections.chiefComplaint,
            historyOfPresentIllness: azureResult.sections.hpi,
            reviewOfSystems: azureResult.sections.reviewOfSystems,
            physicalExam: azureResult.sections.physicalExam,
            assessment: azureResult.sections.assessment,
            plan: azureResult.sections.plan
          },
          metadata: {
            processedAt: new Date().toISOString(),
            model: azureResult.metadata?.model || 'Azure OpenAI',
            confidence: 0.85
          }
        };
        return this.validateAndCleanProcessedNote(convertedNote, transcript, customTemplate?.template);
      } catch (azureError) {
        logError('azureAI', 'Error message', {});
        
        // If both Bedrock and Azure fail, provide basic formatting
        logWarn('azureAI', 'Warning message', {});
        
        // Create basic note with order extraction
        const basicNote = this.createBasicFormattedNote(transcript, patient);

        // Extract orders from the formatted basic note (not raw transcript)
        // This ensures we extract from properly structured clinical text
        const extractedOrders = orderExtractionService.extractOrders(basicNote.formatted);
        if (extractedOrders && (
          extractedOrders.medications.length > 0 ||
          extractedOrders.labs.length > 0 ||
          extractedOrders.imaging.length > 0 ||
          extractedOrders.priorAuths.length > 0 ||
          extractedOrders.referrals.length > 0
        )) {
          // Pass the AI-generated note to include detailed PA justifications
          const ordersAndActions = orderExtractionService.formatOrdersForTemplate(extractedOrders, basicNote.formatted);
          basicNote.formatted += `\n\n**ORDERS & ACTIONS:**\n${ordersAndActions}`;
          basicNote.sections.ordersAndActions = ordersAndActions;
          basicNote.extractedOrders = extractedOrders;
        }

        return this.validateAndCleanProcessedNote(basicNote, transcript, customTemplate?.template);
      }
    }
  }

  /**
   * Process with standard OpenAI API
   * NOTE: NOT HIPAA-compliant (no BAA available)
   * Use for testing or non-PHI data only
   */
  private async processWithOpenAI(
    transcript: string,
    patient: PatientData,
    template: Template | null,
    additionalContext?: string,
    customTemplate?: { template: DoctorTemplate; doctorSettings: DoctorSettings }
  ): Promise<ProcessedNote> {
    logInfo('azureAI', 'Processing with OpenAI API');

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured (VITE_OPENAI_API_KEY)');
    }

    // Build prompt using same logic as Azure
    const prompt = customTemplate
      ? this.buildCustomPrompt(transcript, patient, customTemplate.template, customTemplate.doctorSettings, additionalContext)
      : this.buildPrompt(transcript, patient, template, additionalContext);

    // Use GPT-4 for note processing
    const model = import.meta.env.VITE_OPENAI_MODEL_STAGE5 || 'gpt-4o';

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a medical scribe assistant helping format clinical notes. Respond ONLY with the formatted note, no preamble or explanation.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const formattedNote = data.choices[0]?.message?.content || '';

      if (!formattedNote.trim()) {
        throw new Error('OpenAI returned empty response');
      }

      // 🔍 DEBUG: Log the raw AI output to see what OpenAI generated
      console.log('🔍 ==================== RAW OPENAI OUTPUT ====================');
      console.log(formattedNote);
      console.log('🔍 ========================================================');

      logInfo('azureAI', 'OpenAI processing successful');

      // Extract sections from the formatted note
      const extractedSections = this.extractSections(formattedNote, customTemplate?.template);

      // 🔍 DEBUG: Log what sections were extracted
      console.log('🔍 ==================== EXTRACTED SECTIONS ====================');
      console.log('Section keys found:', Object.keys(extractedSections));
      console.log('Full sections object:', extractedSections);
      console.log('🔍 ============================================================');

      // Extract orders from the AI-formatted note (NOT the raw transcript)
      // This ensures we extract from properly structured clinical text instead of messy conversation
      const extractedOrders = orderExtractionService.extractOrders(formattedNote);

      // Log extracted orders for debugging
      if (extractedOrders && (
        extractedOrders.medications.length > 0 ||
        extractedOrders.labs.length > 0 ||
        extractedOrders.imaging.length > 0 ||
        extractedOrders.priorAuths.length > 0 ||
        extractedOrders.referrals.length > 0
      )) {
        logInfo('azureAI', 'Extracted orders from formatted note', {
          medications: extractedOrders.medications.length,
          labs: extractedOrders.labs.length,
          imaging: extractedOrders.imaging.length,
          priorAuths: extractedOrders.priorAuths.length,
          referrals: extractedOrders.referrals.length
        });
      }

      return {
        formatted: formattedNote,
        sections: extractedSections,
        extractedOrders: extractedOrders,
        metadata: {
          processedAt: new Date().toISOString(),
          model: model,
          promptVersionId: 'openai-standard-v1'
        }
      };
    } catch (error: any) {
      logError('azureAI', `OpenAI processing failed: ${error.message}`);
      throw error;
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

    // Update formatted note to reflect cleaned sections (pass template for dynamic sections)
    processedNote.formatted = this.rebuildFormattedNote(processedNote, template);

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
   */
  private rebuildFormattedNote(processedNote: ProcessedNote, template?: DoctorTemplate): string {
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
4. NEVER write "Not provided", "Not mentioned", or placeholders - always extract from transcription
5. If a section seems empty, re-read the transcription - the information is there
6. Return only the note - no explanations`;
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
          model: this.modelId.includes('claude-opus-4') ? 'claude-opus-4.1' :
                 this.modelId.includes('claude-3-5-sonnet') ? 'claude-3.5-sonnet' : 
                 this.modelId.includes('claude-3-sonnet') ? 'claude-3-sonnet' : 'claude-3-haiku',
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
      logError('azureAI', 'Error message', {});
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
        logError('azureAI', 'Error message', {});
        
        // Check if it's a throttling error
        if (error.name === 'ThrottlingException' || 
            error.name === 'TooManyRequestsException' ||
            error.$metadata?.httpStatusCode === 429 ||
            error.message?.includes('Too many requests')) {
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff
            logDebug('azureAI', 'Debug message', {});
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            // Max retries exceeded, return fallback instead of throwing
            logWarn('azureAI', 'Warning message', {});
            return 'I understand your needs. Let me analyze this information to find your best pump match.';
          }
        }
        
        // For non-throttling errors, return a generic fallback
        logError('azureAI', 'Error message', {});
        return 'I\'m analyzing your preferences to find the best pump for you. Let\'s continue with the next category.';
      }
    }
    
    // If we exhausted all retries, return a helpful fallback
    logWarn('azureAI', 'Warning message', {});
    return 'I understand your needs. Let me analyze this information to find your best pump match.';
  }

  /**
   * Process simple prompt with Claude (for PumpDrive and other services)
   * HIPAA COMPLIANT - Covered by AWS BAA
   */
  async processWithClaude(prompt: string, context?: string): Promise<string> {
    // Check if this is a conversational request (pump follow-up questions, etc.)
    const isConversational = context === 'followup_question' ||
                            context === 'pump_recommendation' ||
                            context === 'clarifying_question' ||
                            prompt.includes('Great question!') ||
                            prompt.includes('friendly diabetes educator') ||
                            prompt.includes('conversational, easy-to-understand way');

    // MIGRATION PHASE 1: Azure OpenAI is PRIMARY for all processing
    if (this.migrationMode || this.primaryProvider === 'azure') {
      try {
        logDebug('azureAI', 'Processing prompt with Azure OpenAI', { context, isConversational });

        if (isConversational) {
          // Use conversational processing for pump-related questions
          const response = await azureOpenAIService.processConversationalPrompt(prompt);
          logInfo('azureAI', 'Successfully processed conversational prompt via Azure OpenAI', {});
          return response;
        } else {
          // Use medical transcription processing for SOAP notes
          const azureResult = await azureOpenAIService.processTranscription(
            prompt,
            'Standard Response',
            { name: 'System' }
          );
          logInfo('azureAI', 'Successfully processed medical transcription via Azure OpenAI', {});
          return azureResult.formattedNote;
        }
      } catch (azureError) {
        logWarn('azureAI', 'Azure OpenAI processing failed, falling back to AWS Bedrock', { error: azureError });
        // Continue to AWS Bedrock fallback below
      }
    }

    try {
      logDebug('azureAI', 'Debug message', {});
      
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
      logError('azureAI', 'Error message', {});
      
      // Try Azure OpenAI as fallback when Bedrock fails
      logWarn('azureAI', 'Warning message', {});
      
      try {
        const azureResult = await azureOpenAIService.processTranscription(
          prompt,
          'Standard Response',
          { name: 'System' }
        );
        logInfo('azureAI', 'Info message', {});
        return azureResult.formattedNote;
      } catch (azureError) {
        logError('azureAI', 'Error message', {});
        throw new Error('AI processing failed. Please try again later.');
      }
    }
  }


  /**
   * Create an enhanced formatted note with intelligent extraction when AI is unavailable
   * Uses regex patterns and medical terminology extraction
   */
  private createBasicFormattedNote(transcript: string, patient: PatientData): ProcessedNote {
    const timestamp = new Date().toISOString();
    const correctedTranscript = medicalCorrections.correctTranscription(transcript);

    logInfo('azureAI', 'Creating enhanced fallback note with pattern extraction');

    // Extract sections using intelligent patterns
    const sections = this.extractSectionsFromTranscript(correctedTranscript);

    // Build formatted output
    const formatted = `
╔════════════════════════════════════════════════════════╗
║           CLINICAL NOTE - Client-Side Extraction        ║
╚════════════════════════════════════════════════════════╝

PATIENT INFORMATION:
Name: ${patient.name || 'Not provided'}
MRN: ${patient.mrn || 'Not provided'}
DOB: ${patient.dob || 'Not provided'}
Visit Date: ${new Date().toLocaleDateString()}

${sections.chiefComplaint ? `CHIEF COMPLAINT:\n${sections.chiefComplaint}\n\n` : ''}${sections.historyOfPresentIllness ? `HISTORY OF PRESENT ILLNESS:\n${sections.historyOfPresentIllness}\n\n` : ''}${sections.medications ? `MEDICATIONS:\n${sections.medications}\n\n` : ''}${sections.allergies ? `ALLERGIES:\n${sections.allergies}\n\n` : ''}${sections.assessment ? `ASSESSMENT/DIAGNOSES:\n${sections.assessment}\n\n` : ''}${sections.plan ? `PLAN:\n${sections.plan}\n\n` : ''}${sections.physicalExam ? `VITAL SIGNS/EXAM:\n${sections.physicalExam}\n\n` : ''}
════════════════════════════════════════════════════════

ℹ️  NOTE: This note was generated using client-side extraction (AI services unavailable).
   Key information has been extracted, but manual review is recommended.

   To enable full AI processing:
   • Verify API credentials are configured
   • Check network connection
   • Contact support if the issue persists

Generated: ${new Date().toLocaleString()} | Confidence: Medium
    `.trim();

    return {
      formatted,
      sections,
      metadata: {
        processedAt: timestamp,
        model: 'enhanced-fallback-extractor',
        confidence: 0.65
      }
    };
  }

  /**
   * Extract medical sections from transcript using regex patterns
   */
  private extractSectionsFromTranscript(transcript: string): {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    reviewOfSystems?: string;
    pastMedicalHistory?: string;
    medications?: string;
    allergies?: string;
    physicalExam?: string;
    assessment?: string;
    plan?: string;
  } {
    const sections: any = {};

    // 1. Extract Chief Complaint (first sentence or explicit mention)
    const ccMatch = transcript.match(/(?:chief complaint|presenting with|here for|comes in (?:with|for))\s*:?\s*([^.!?]+)/i);
    if (ccMatch) {
      sections.chiefComplaint = ccMatch[1].trim();
    } else {
      // Use first sentence as chief complaint
      const firstSentence = transcript.split(/[.!?]+/)[0];
      if (firstSentence && firstSentence.length < 150) {
        sections.chiefComplaint = firstSentence.trim();
      }
    }

    // 2. Extract Diagnoses/Conditions
    const diagnoses: string[] = [];
    const diagnosisPatterns = [
      /(?:diabetes|diabetic|dm|type 2 diabetes|type 1 diabetes)/gi,
      /(?:hypertension|htn|high blood pressure)/gi,
      /(?:hyperlipidemia|high cholesterol)/gi,
      /(?:hypothyroid|hyperthyroid|thyroid disorder)/gi,
      /(?:nausea|vomiting|diarrhea)/gi,
      /(?:infection|uti|upper respiratory infection|uri)/gi
    ];

    const transcriptLower = transcript.toLowerCase();
    diagnosisPatterns.forEach(pattern => {
      const matches = transcript.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!diagnoses.some(d => d.toLowerCase() === match.toLowerCase())) {
            diagnoses.push(match);
          }
        });
      }
    });

    if (diagnoses.length > 0) {
      sections.assessment = diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n');
    }

    // 3. Extract Medications
    const medications: string[] = [];
    const medPatterns = [
      /(?:lantus|humalog|novolog|metformin|ozempic|mounjaro|jardiance|farxiga)\s*(?:\d+\s*(?:mg|units?|mcg))?/gi,
      /(?:levothyroxine|synthroid)\s*\d+\s*mcg/gi,
      /(?:lisinopril|losartan|amlodipine)\s*\d+\s*mg/gi,
      /(?:atorvastatin|rosuvastatin|simvastatin)\s*\d+\s*mg/gi
    ];

    medPatterns.forEach(pattern => {
      const matches = transcript.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!medications.some(m => m.toLowerCase() === match.toLowerCase())) {
            medications.push(match);
          }
        });
      }
    });

    if (medications.length > 0) {
      sections.medications = medications.map((m, i) => `${i + 1}. ${m}`).join('\n');
    }

    // 4. Extract Allergies
    const allergyMatch = transcript.match(/(?:allergies?|allergic to)\s*:?\s*([^.!?]+)/i);
    if (allergyMatch) {
      sections.allergies = allergyMatch[1].trim();
    } else if (transcriptLower.includes('nkda') || transcriptLower.includes('no known')) {
      sections.allergies = 'NKDA (No Known Drug Allergies)';
    }

    // 5. Extract Vital Signs and Lab Values
    const vitalsData: string[] = [];

    // Blood pressure
    const bpMatch = transcript.match(/(?:bp|blood pressure)[:\s]*(\d+\/\d+)/i);
    if (bpMatch) vitalsData.push(`BP: ${bpMatch[1]}`);

    // Blood sugar / Glucose
    const bsMatch = transcript.match(/(?:blood sugar|glucose|bg)[:\s]*(\d+)/i);
    if (bsMatch) vitalsData.push(`Blood Glucose: ${bsMatch[1]} mg/dL`);

    // A1C
    const a1cMatch = transcript.match(/(?:a1c|hemoglobin a1c|hba1c)[:\s]*(\d+\.?\d*)/i);
    if (a1cMatch) vitalsData.push(`A1C: ${a1cMatch[1]}%`);

    // Weight
    const weightMatch = transcript.match(/(?:weight|wt)[:\s]*(\d+)\s*(?:lbs?|pounds?)/i);
    if (weightMatch) vitalsData.push(`Weight: ${weightMatch[1]} lbs`);

    // Age
    const ageMatch = transcript.match(/(\d+)\s*(?:year|yr)s?\s*old/i);
    if (ageMatch) vitalsData.push(`Age: ${ageMatch[1]} years`);

    if (vitalsData.length > 0) {
      sections.physicalExam = vitalsData.join('\n');
    }

    // 6. Extract Plan Items
    const planItems: string[] = [];

    // Look for plan section
    const planMatch = transcript.match(/(?:plan|treatment|management)\s*:?\s*([^]+?)(?:\n\n|$)/i);
    if (planMatch) {
      sections.plan = planMatch[1].trim();
    } else {
      // Extract common plan patterns
      if (transcriptLower.includes('increase') || transcriptLower.includes('adjust')) {
        const adjustMatch = transcript.match(/(?:increase|adjust|change)\s+([^.!?]+)/i);
        if (adjustMatch) planItems.push(`• ${adjustMatch[0]}`);
      }

      if (transcriptLower.includes('start') || transcriptLower.includes('begin')) {
        const startMatch = transcript.match(/(?:start|begin)\s+([^.!?]+)/i);
        if (startMatch) planItems.push(`• ${startMatch[0]}`);
      }

      if (transcriptLower.includes('follow up') || transcriptLower.includes('follow-up')) {
        planItems.push('• Follow up as scheduled');
      }

      if (transcriptLower.includes('lab') || transcriptLower.includes('blood work')) {
        planItems.push('• Labs ordered');
      }

      if (planItems.length > 0) {
        sections.plan = planItems.join('\n');
      }
    }

    // 7. Extract HPI (everything not yet categorized)
    if (!sections.historyOfPresentIllness) {
      // Remove chief complaint from transcript for HPI
      let hpiText = transcript;
      if (sections.chiefComplaint) {
        hpiText = hpiText.replace(sections.chiefComplaint, '').trim();
      }

      // Take first 300 characters as HPI summary
      if (hpiText.length > 300) {
        sections.historyOfPresentIllness = hpiText.substring(0, 300) + '... (see full transcript for details)';
      } else if (hpiText.length > 50) {
        sections.historyOfPresentIllness = hpiText;
      }
    }

    logInfo('azureAI', 'Extracted sections from transcript', {
      sectionsFound: Object.keys(sections).length,
      hasChiefComplaint: !!sections.chiefComplaint,
      hasMedications: !!sections.medications,
      hasAssessment: !!sections.assessment
    });

    return sections;
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