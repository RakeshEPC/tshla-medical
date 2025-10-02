/**
 * Azure Speech Services - CONVERSATION MODE
 * High-quality medical conversation transcription with speaker diarization
 *
 * This implementation provides real-time multi-speaker transcription
 * using Azure Speech Services conversation transcriber
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { azureSpeechConfig } from './azureSpeechConfig.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface ConversationResult {
  transcript: string;
  isPartial: boolean;
  speaker?: 'CLINICIAN' | 'PATIENT';
  confidence?: number;
  timestamp?: string;
}

class AzureSpeechConversationService {
  private conversationTranscriber: SpeechSDK.ConversationTranscriber | null = null;
  private conversation: SpeechSDK.Conversation | null = null;
  private isRecording = false;
  private transcriptCallback: ((result: ConversationResult) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private speakerMapping: Map<string, 'CLINICIAN' | 'PATIENT'> = new Map();
  private nextSpeakerIndex = 0;

  constructor() {
    logInfo('azureSpeechConversation', 'Info message', {});
  }

  isConfigured(): boolean {
    return azureSpeechConfig.isConfigured();
  }

  /**
   * Start conversation transcription with proper speaker diarization
   */
  async startConversation(
    onTranscript: (result: ConversationResult) => void,
    onError: (error: Error) => void,
    specialty?: string
  ): Promise<void> {
    if (!this.isConfigured()) {
      onError(new Error('Azure Speech Services not configured. Please set Azure credentials.'));
      return;
    }

    this.transcriptCallback = onTranscript;
    this.errorCallback = onError;

    try {
      // Get speech configuration
      const speechConfig = azureSpeechConfig.getSpeechConfig();
      if (!speechConfig) throw new Error('Speech config not available');

      // Create audio configuration
      const audioConfig = this.createOptimizedAudioConfig();

      // Create conversation transcriber
      this.conversationTranscriber = azureSpeechConfig.createConversationTranscriber(audioConfig);
      if (!this.conversationTranscriber)
        throw new Error('Failed to create conversation transcriber');

      // Configure conversation settings
      this.configureConversationSettings();

      // Set up event handlers
      this.setupConversationEvents();

      // Start transcription
      this.conversationTranscriber.startTranscribingAsync(
        () => {
          this.isRecording = true;
          logDebug('azureSpeechConversation', 'Debug message', {});
        },
        error => {
          logError('azureSpeechConversation', 'Error message', {});
          onError(new Error(`Failed to start conversation: ${error}`));
          this.cleanup();
        }
      );
    } catch (error) {
      logError('azureSpeechConversation', 'Error message', {});
      onError(error as Error);
      this.cleanup();
    }
  }

  /**
   * Create optimized audio configuration for conversation
   */
  private createOptimizedAudioConfig(): SpeechSDK.AudioConfig {
    // Use default microphone - Azure will handle speaker separation
    return SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  }

  /**
   * Configure conversation-specific settings
   */
  private configureConversationSettings(): void {
    const speechConfig = azureSpeechConfig.getSpeechConfig();
    if (!speechConfig) return;

    // Configure for conversation mode
    speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
      '5000' // Allow 5 seconds of initial silence
    );

    speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
      '1000' // Shorter end silence for conversation flow
    );

    // Enable detailed output for confidence scores and speaker info
    speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;

    // Configure for medical vocabulary enhancement
    speechConfig.setProperty('SpeechServiceConnection_LanguageIdMode', 'Continuous');
  }

  /**
   * Set up event handlers for conversation transcription
   */
  private setupConversationEvents(): void {
    if (!this.conversationTranscriber) return;

    // Handle interim results
    this.conversationTranscriber.transcribing = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech && this.transcriptCallback) {
        const speaker = this.identifySpeaker(e.result.speakerId);
        const result: ConversationResult = {
          transcript: e.result.text,
          isPartial: true,
          speaker,
          confidence: 0.8,
          timestamp: new Date().toISOString(),
        };

        logDebug('azureSpeechConversation', 'Debug message', {});
        this.transcriptCallback(result);
      }
    };

    // Handle final results
    this.conversationTranscriber.transcribed = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && this.transcriptCallback) {
        const speaker = this.identifySpeaker(e.result.speakerId);
        const confidence = this.extractConfidence(e.result);
        const enhancedTranscript = this.enhanceTextForMedical(e.result.text);

        const result: ConversationResult = {
          transcript: enhancedTranscript,
          isPartial: false,
          speaker,
          confidence,
          timestamp: new Date().toISOString(),
        };

        logInfo('azureSpeechConversation', 'Info message', {});
        this.transcriptCallback(result);
      } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
        logDebug('azureSpeechConversation', 'Debug message', {});
      }
    };

    // Handle cancellation and errors
    this.conversationTranscriber.canceled = (s, e) => {
      logDebug('azureSpeechConversation', 'Debug message', {});

      if (e.reason === SpeechSDK.CancellationReason.Error) {
        logError('azureSpeechConversation', 'Error message', {});
        if (this.errorCallback) {
          this.errorCallback(new Error(`Conversation transcription error: ${e.errorDetails}`));
        }
      }
    };

    // Session events
    this.conversationTranscriber.sessionStarted = (s, e) => {
      logDebug('azureSpeechConversation', 'Debug message', {});
    };

    this.conversationTranscriber.sessionStopped = (s, e) => {
      logDebug('azureSpeechConversation', 'Debug message', {});
      this.isRecording = false;
    };

    // Participant events
    this.conversationTranscriber.participantAdded = (s, e) => {
      logDebug('azureSpeechConversation', 'Debug message', {});
      // Map new participants to medical roles
      this.mapParticipantToRole(e.participant.id);
    };

    this.conversationTranscriber.participantRemoved = (s, e) => {
      logDebug('azureSpeechConversation', 'Debug message', {});
      this.speakerMapping.delete(e.participant.id);
    };
  }

  /**
   * Identify speaker based on speaker ID
   */
  private identifySpeaker(speakerId: string): 'CLINICIAN' | 'PATIENT' {
    if (!speakerId) {
      // Default to CLINICIAN if no speaker ID
      return 'CLINICIAN';
    }

    // Check if we already have a mapping for this speaker
    if (this.speakerMapping.has(speakerId)) {
      return this.speakerMapping.get(speakerId)!;
    }

    // Assign new speaker to role
    return this.mapParticipantToRole(speakerId);
  }

  /**
   * Map participant to medical role (CLINICIAN or PATIENT)
   */
  private mapParticipantToRole(participantId: string): 'CLINICIAN' | 'PATIENT' {
    // Simple mapping strategy: first speaker is CLINICIAN, second is PATIENT
    // In production, this could be more sophisticated based on voice characteristics
    // or user input

    const role = this.nextSpeakerIndex === 0 ? 'CLINICIAN' : 'PATIENT';
    this.speakerMapping.set(participantId, role);
    this.nextSpeakerIndex = (this.nextSpeakerIndex + 1) % 2; // Alternate between 0 and 1

    logDebug('azureSpeechConversation', 'Debug message', {});
    return role;
  }

  /**
   * Extract confidence score from recognition result
   */
  private extractConfidence(result: SpeechSDK.ConversationTranscriptionResult): number {
    try {
      // Parse detailed result for confidence score
      const detailedResult = JSON.parse(result.json);
      const nBest = detailedResult?.NBest;

      if (nBest && nBest.length > 0) {
        const confidence = nBest[0]?.Confidence;
        return confidence ? parseFloat(confidence) : 0.95;
      }

      return 0.95; // Default high confidence
    } catch (error) {
      logWarn('azureSpeechConversation', 'Warning message', {});
      return 0.95;
    }
  }

  /**
   * Enhance text for medical context
   */
  private enhanceTextForMedical(text: string): string {
    if (!text) return text;

    // Apply medical-specific text enhancements
    let enhanced = text;

    // Common medical abbreviations and corrections
    const medicalCorrections = {
      'b p': 'BP',
      'h r': 'HR',
      'r r': 'RR',
      'o two sat': 'O2 sat',
      'oxygen sat': 'O2 sat',
      'e k g': 'EKG',
      'c t scan': 'CT scan',
      'm r i': 'MRI',
      'c b c': 'CBC',
      'b m p': 'BMP',
      'c m p': 'CMP',
      'beats per minute': 'bpm',
      milligrams: 'mg',
      micrograms: 'mcg',
    };

    // Apply corrections (case-insensitive)
    Object.entries(medicalCorrections).forEach(([pattern, replacement]) => {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      enhanced = enhanced.replace(regex, replacement);
    });

    return enhanced;
  }

  /**
   * Manually assign speaker role (for user correction)
   */
  assignSpeakerRole(speakerId: string, role: 'CLINICIAN' | 'PATIENT'): void {
    this.speakerMapping.set(speakerId, role);
    logDebug('azureSpeechConversation', 'Debug message', {});
  }

  /**
   * Get current speaker mappings
   */
  getSpeakerMappings(): Map<string, 'CLINICIAN' | 'PATIENT'> {
    return new Map(this.speakerMapping);
  }

  /**
   * Stop conversation transcription
   */
  stop(): void {
    logDebug('azureSpeechConversation', 'Debug message', {});
    this.isRecording = false;

    if (this.conversationTranscriber) {
      this.conversationTranscriber.stopTranscribingAsync(
        () => {
          logDebug('azureSpeechConversation', 'Debug message', {});
          this.cleanup();
        },
        error => {
          logError('azureSpeechConversation', 'Error message', {});
          this.cleanup();
        }
      );
    } else {
      this.cleanup();
    }
  }

  /**
   * Check if currently recording
   */
  isRecordingActive(): boolean {
    return this.isRecording;
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.conversationTranscriber) {
      this.conversationTranscriber.close();
      this.conversationTranscriber = null;
    }

    if (this.conversation) {
      this.conversation.close();
      this.conversation = null;
    }

    // Clear state
    this.speakerMapping.clear();
    this.nextSpeakerIndex = 0;
    this.transcriptCallback = null;
    this.errorCallback = null;
    this.isRecording = false;

    logDebug('azureSpeechConversation', 'Debug message', {});
  }
}

// Export singleton instance
export const azureSpeechConversation = new AzureSpeechConversationService();
