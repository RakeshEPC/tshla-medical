/**
 * Speech Service Router
 * Routes speech recognition requests to Deepgram STT service
 * Simplified after cleanup - using only Deepgram SDK (AWS/Azure deprecated)
 */

import { deepgramSDKService } from './deepgramSDK.service';
import { logError, logInfo, logDebug } from './logger.service';

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
    if (deepgramSDKService.isConfigured()) {
      return deepgramSDKService;
    } else {
      logError('speechServiceRouter', 'Deepgram service not configured');
      throw new Error(
        'Deepgram transcription service not configured.\n' +
        'Please ensure:\n' +
        '1. VITE_DEEPGRAM_API_KEY is set in .env\n' +
        '2. Proxy server is running: npm run proxy:start'
      );
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
   * Check if speech service is available
   */
  isAnyServiceAvailable(): boolean {
    return deepgramSDKService.isConfigured();
  }

  /**
   * Get service status for debugging
   */
  getServiceStatus() {
    return {
      primaryProvider: 'deepgram',
      deepgram: {
        configured: deepgramSDKService.isConfigured(),
        model: 'nova-2-medical',
        status: 'active'
      },
      deprecated: {
        aws: 'Moved to _archived/',
        azure: 'Disabled - quota issues',
        deepgramAdapter: 'Archived - use deepgramSDKService'
      }
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
