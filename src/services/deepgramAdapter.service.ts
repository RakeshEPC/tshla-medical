/**
 * Deepgram Adapter Service
 * Adapts Deepgram service to match existing speech service interface
 * Provides seamless integration with existing audio capture pipeline
 */

import { deepgramService, type TranscriptionResult as DeepgramTranscriptionResult } from './deepgram.service';
import { logInfo, logError, logDebug, logWarn } from './logger.service';
import type { TranscriptionResult, SpeechServiceInterface } from './speechServiceRouter.service';

export class DeepgramAdapter implements SpeechServiceInterface {
  private isRecording = false;
  private currentTranscript = '';
  private onTranscriptCallback: ((result: TranscriptionResult) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;

  constructor() {
    logInfo('deepgramAdapter', 'Deepgram adapter initialized');
  }

  /**
   * Check if Deepgram is configured and available
   */
  isConfigured(): boolean {
    try {
      const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
      return !!apiKey;
    } catch (error) {
      logError('deepgramAdapter', `Configuration check failed: ${error}`);
      return false;
    }
  }

  /**
   * Start transcription (generic method)
   */
  async startTranscription(
    mode: 'CONVERSATION' | 'DICTATION',
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void,
    specialty?: string
  ): Promise<void> {
    logInfo('deepgramAdapter', `Starting ${mode} transcription`);

    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;

    try {
      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Start Deepgram real-time transcription
      await deepgramService.startRealTimeTranscription(
        this.handleDeepgramResult.bind(this),
        this.handleDeepgramError.bind(this)
      );

      // Create MediaRecorder to send audio data to Deepgram
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          deepgramService.sendAudioData(event.data);
        }
      };

      this.mediaRecorder.start(100); // Send audio chunks every 100ms
      this.isRecording = true;

      logInfo('deepgramAdapter', `${mode} transcription started successfully`);

    } catch (error) {
      logError('deepgramAdapter', `Failed to start transcription: ${error}`);
      onError(new Error(`Deepgram transcription failed: ${error}`));
    }
  }

  /**
   * Start dictation mode
   */
  async startDictation(
    onTranscript: (result: any) => void,
    onError: (error: Error) => void,
    specialty?: string
  ): Promise<void> {
    return this.startTranscription('DICTATION', onTranscript, onError, specialty);
  }

  /**
   * Start conversation mode
   */
  async startConversation(
    onTranscript: (result: any) => void,
    onError: (error: Error) => void,
    specialty?: string
  ): Promise<void> {
    return this.startTranscription('CONVERSATION', onTranscript, onError, specialty);
  }

  /**
   * Start recording (simple interface)
   */
  async startRecording(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ): Promise<boolean> {
    try {
      await this.startTranscription(
        'DICTATION',
        (result) => onTranscript(result.transcript, !result.isPartial),
        (error) => onError(error.message)
      );
      return true;
    } catch (error) {
      onError(`Failed to start recording: ${error}`);
      return false;
    }
  }

  /**
   * Stop transcription
   */
  stop(): void {
    logInfo('deepgramAdapter', 'Stopping transcription');

    this.isRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    deepgramService.stopRealTimeTranscription();

    this.onTranscriptCallback = null;
    this.onErrorCallback = null;
    this.mediaRecorder = null;

    logInfo('deepgramAdapter', 'Transcription stopped');
  }

  /**
   * Stop recording (simple interface)
   */
  stopRecording(): string {
    this.stop();
    return this.currentTranscript;
  }

  /**
   * Get current transcript
   */
  getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  /**
   * Handle Deepgram transcription results
   */
  private handleDeepgramResult(result: DeepgramTranscriptionResult): void {
    try {
      // Convert Deepgram result to standard format
      const transcriptionResult: TranscriptionResult = {
        transcript: result.transcript,
        isPartial: !result.is_final,
        confidence: result.confidence,
        timestamp: new Date().toISOString(),
        speaker: result.speaker !== undefined ? `SPEAKER_${result.speaker}` : undefined
      };

      // Update current transcript
      if (result.is_final) {
        this.currentTranscript += ' ' + result.transcript;
        this.currentTranscript = this.currentTranscript.trim();
      }

      // Call the callback
      if (this.onTranscriptCallback) {
        this.onTranscriptCallback(transcriptionResult);
      }

      logDebug('deepgramAdapter', `Transcribed: "${result.transcript}" (final: ${result.is_final})`);

    } catch (error) {
      logError('deepgramAdapter', `Error processing result: ${error}`);
    }
  }

  /**
   * Handle Deepgram errors
   */
  private handleDeepgramError(error: Error): void {
    logError('deepgramAdapter', `Deepgram error: ${error.message}`);

    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRecording: boolean;
    isConfigured: boolean;
    currentTranscript: string;
    provider: string;
  } {
    return {
      isRecording: this.isRecording,
      isConfigured: this.isConfigured(),
      currentTranscript: this.currentTranscript,
      provider: 'deepgram'
    };
  }

  /**
   * Test Deepgram connection
   */
  async testConnection(): Promise<boolean> {
    try {
      return await deepgramService.testConnection();
    } catch (error) {
      logError('deepgramAdapter', `Connection test failed: ${error}`);
      return false;
    }
  }
}

// Export singleton instance
export const deepgramAdapter = new DeepgramAdapter();