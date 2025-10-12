/**
 * Speech Service Router
 * Routes speech recognition requests to the appropriate service
 * Priority: Deepgram (primary) → AWS Transcribe Medical → Azure Speech (backup)
 * Based on cost, reliability, and quota limitations
 */

// Deepgram Services (primary - medical optimized, 83% cost savings)
import { deepgramSDKService } from './deepgramSDK.service';
import { deepgramAdapter } from './deepgramAdapter.service';

// Azure Speech Services (backup - quota limited, currently archived)
// import { azureSpeechStreamingFixed } from './azureSpeechStreamingFixed.service';
// import { azureSpeechDictation } from './azureSpeechDictation.service';
// import { azureSpeechConversation } from './azureSpeechConversation.service';
// import { azureSpeechAmbientService } from './azureSpeechAmbient.service';
// import { azureSpeechSimple } from './azureSpeechSimple.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

// AWS Transcribe Services (deprecated - moved to _deprecated/)
// import { awsTranscribeStreamingFixed } from './_deprecated/awsTranscribeMedicalStreamingFixed.service';
// import { awsTranscribeSimple } from './_deprecated/awsTranscribeSimple.service';

export interface TranscriptionResult {
  transcript: string;
  isPartial: boolean;
  speaker?: 'CLINICIAN' | 'PATIENT' | string;
  confidence?: number;
  timestamp?: string;
}

export interface SpeechServiceInterface {
  isConfigured(): boolean;
  startTranscription?(
    mode: 'CONVERSATION' | 'DICTATION',
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void,
    specialty?: string
  ): Promise<void>;
  startDictation?(
    onTranscript: (result: any) => void,
    onError: (error: Error) => void,
    specialty?: string
  ): Promise<void>;
  startConversation?(
    onTranscript: (result: any) => void,
    onError: (error: Error) => void,
    specialty?: string
  ): Promise<void>;
  startRecording?(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ): Promise<boolean>;
  stop(): void;
  stopRecording?(): string;
  getCurrentTranscript?(): string;
}

class SpeechServiceRouter {
  private primaryProvider: 'deepgram' = 'deepgram'; // Deepgram only (AWS/Azure deprecated)

  constructor() {
    // Deepgram is now the only supported STT provider
    // AWS and Azure services have been moved to _deprecated/
    this.primaryProvider = 'deepgram';
    logInfo('speechServiceRouter', 'Primary STT provider: Deepgram (nova-2-medical)');
  }

  /**
   * Get the streaming service (main transcription interface)
   */
  getStreamingService(): SpeechServiceInterface {
    // Priority: Deepgram SDK (primary - official SDK with proper auth) → Deepgram Adapter (fallback)
    // The SDK uses the official @deepgram/sdk which handles WebSocket authentication properly
    // The adapter uses manual WebSocket which fails due to browser limitations on custom headers
    if (deepgramSDKService.isConfigured()) {
      logInfo('speechServiceRouter', 'Using Deepgram SDK for streaming (official SDK with proper auth)');
      return deepgramSDKService;
    } else if (deepgramAdapter.isConfigured()) {
      logInfo('speechServiceRouter', 'Using Deepgram Adapter for streaming (fallback - may have auth issues)');
      return deepgramAdapter;
    } else {
      logError('speechServiceRouter', 'No speech services available - check Deepgram configuration');
      throw new Error('Deepgram transcription service not configured. Please set VITE_DEEPGRAM_API_KEY');
    }
  }

  /**
   * Get the dictation service
   */
  getDictationService(): SpeechServiceInterface {
    // Use same priority as streaming
    return this.getStreamingService();
  }

  /**
   * Get the conversation service
   */
  getConversationService(): SpeechServiceInterface {
    // Use same priority as streaming - Deepgram handles conversations well
    return this.getStreamingService();
  }

  /**
   * Get the ambient service
   */
  getAmbientService(): SpeechServiceInterface {
    // Use same priority as streaming - Deepgram has excellent speaker diarization
    return this.getStreamingService();
  }

  /**
   * Get the simple service (most commonly used)
   */
  getSimpleService(): SpeechServiceInterface {
    // Use same priority as streaming - Deepgram is simpler and more reliable
    return this.getStreamingService();
  }

  /**
   * Check if any speech service is available
   */
  isAnyServiceAvailable(): boolean {
    return (
      deepgramSDKService.isConfigured() ||
      deepgramAdapter.isConfigured()
    );
  }

  /**
   * Get service status for debugging
   */
  getServiceStatus() {
    return {
      primaryProvider: this.primaryProvider,
      deepgram: {
        sdk: deepgramSDKService.isConfigured(),
        adapter: deepgramAdapter.isConfigured(),
      },
      aws: {
        status: 'DEPRECATED - Moved to _deprecated/ folder',
        streaming: false,
        simple: false,
      },
      azure: {
        status: 'DISABLED - Out of credits/quota issues',
        streaming: false,
        dictation: false,
        conversation: false,
        ambient: false,
        simple: false,
      },
    };
  }

  /**
   * Force switch to specific provider (for testing)
   */
  setPrimaryProvider(provider: 'deepgram' | 'aws'): void {
    this.primaryProvider = provider;
    logDebug('speechServiceRouter', `Primary provider switched to: ${provider}`, {});
  }

  /**
   * Unified startRecording method for backward compatibility
   * Adapts different service APIs to a common interface
   */
  async startRecording(
    mode: 'dictation' | 'conversation',
    callbacks: {
      onTranscript: (text: string, isFinal: boolean) => void;
      onError: (error: string) => void;
      onEnd?: () => void;
    }
  ): Promise<boolean> {
    try {
      const service = this.getStreamingService();

      if (this.primaryProvider === 'deepgram') {
        // Use Deepgram Services (SDK or Adapter)
        const transcriptionMode = mode === 'dictation' ? 'DICTATION' : 'CONVERSATION';

        await service.startTranscription!(
          transcriptionMode,
          result => {
            callbacks.onTranscript(result.transcript, !result.isPartial);
          },
          error => {
            callbacks.onError(error.message);
          }
        );

        return true;
      } else {
        // Use AWS Transcribe with existing API
        if (service.startRecording) {
          return await service.startRecording(
            (text: string, isFinal: boolean) => callbacks.onTranscript(text, isFinal),
            (error: string) => callbacks.onError(error)
          );
        }
        return false;
      }
    } catch (error) {
      logError('speechServiceRouter', 'Error message', {});
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Unified stopRecording method
   */
  stopRecording(): void {
    const service = this.getStreamingService();

    if (service.stopRecording) {
      service.stopRecording();
    } else {
      service.stop();
    }
  }
}

// Export singleton instance
export const speechServiceRouter = new SpeechServiceRouter();
