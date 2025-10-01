/**
 * Azure Speech Services - Fixed Streaming Service
 * HIPAA-compliant replacement for AWS Transcribe Medical
 * 
 * This implementation provides real-time speech recognition with medical vocabulary
 * and speaker diarization capabilities using Azure Speech Services
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { azureSpeechConfig } from './azureSpeechConfig.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface TranscriptionResult {
  transcript: string;
  isPartial: boolean;
  speaker?: 'CLINICIAN' | 'PATIENT' | string;
  confidence?: number;
  timestamp?: string;
}

class AzureSpeechStreamingFixed {
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private conversationTranscriber: SpeechSDK.ConversationTranscriber | null = null;
  private isRecording = false;
  private transcriptCallback: ((result: TranscriptionResult) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private currentMode: 'CONVERSATION' | 'DICTATION' = 'DICTATION';

  constructor() {
    logInfo('azureSpeechStreamingFixed', 'Info message', {});
  }

  isConfigured(): boolean {
    return azureSpeechConfig.isConfigured();
  }

  /**
   * Start transcription for either CONVERSATION or DICTATION mode
   */
  async startTranscription(
    mode: 'CONVERSATION' | 'DICTATION',
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void,
    specialty?: string
  ): Promise<void> {
    if (!this.isConfigured()) {
      logWarn('azureSpeechStreamingFixed', 'Warning message', {});
      return this.startWebSpeechFallback(mode, onTranscript, onError);
    }

    this.currentMode = mode;
    this.transcriptCallback = onTranscript;
    this.errorCallback = onError;

    try {
      if (mode === 'CONVERSATION') {
        await this.startConversationMode(specialty);
      } else {
        await this.startDictationMode(specialty);
      }

      this.isRecording = true;
      logDebug('azureSpeechStreamingFixed', 'Debug message', {});
    } catch (error) {
      logError('azureSpeechStreamingFixed', 'Error message', {});
      logWarn('azureSpeechStreamingFixed', 'Warning message', {});
      return this.startWebSpeechFallback(mode, onTranscript, onError);
    }
  }

  /**
   * Start dictation mode (single speaker)
   */
  private async startDictationMode(specialty?: string): Promise<void> {
    const speechConfig = azureSpeechConfig.getSpeechConfig();
    if (!speechConfig) throw new Error('Speech config not available');

    const audioConfig = azureSpeechConfig.getOptimizedAudioConfig();
    this.recognizer = azureSpeechConfig.createDictationRecognizer(audioConfig);

    if (!this.recognizer) throw new Error('Failed to create recognizer');

    // Configure recognition events
    this.setupRecognizerEvents(this.recognizer);

    // Start continuous recognition
    this.recognizer.startContinuousRecognitionAsync(
      () => {
        logInfo('azureSpeechStreamingFixed', 'Info message', {});
      },
      (error) => {
        logError('azureSpeechStreamingFixed', 'Error message', {});
        if (this.errorCallback) {
          this.errorCallback(new Error(`Failed to start dictation: ${error}`));
        }
      }
    );
  }

  /**
   * Start conversation mode (multi-speaker with diarization)
   */
  private async startConversationMode(specialty?: string): Promise<void> {
    const audioConfig = azureSpeechConfig.getOptimizedAudioConfig();
    this.conversationTranscriber = azureSpeechConfig.createConversationTranscriber(audioConfig);

    if (!this.conversationTranscriber) throw new Error('Failed to create conversation transcriber');

    // Configure conversation events
    this.setupConversationEvents(this.conversationTranscriber);

    // Start conversation transcription
    this.conversationTranscriber.startTranscribingAsync(
      () => {
        logInfo('azureSpeechStreamingFixed', 'Info message', {});
      },
      (error) => {
        logError('azureSpeechStreamingFixed', 'Error message', {});
        if (this.errorCallback) {
          this.errorCallback(new Error(`Failed to start conversation: ${error}`));
        }
      }
    );
  }

  /**
   * Setup recognizer events for dictation mode
   */
  private setupRecognizerEvents(recognizer: SpeechSDK.SpeechRecognizer): void {
    // Interim results
    recognizer.recognizing = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech && this.transcriptCallback) {
        this.transcriptCallback({
          transcript: e.result.text,
          isPartial: true,
          confidence: 0.8,
          timestamp: new Date() });
      }
    };

    // Final results
    recognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && this.transcriptCallback) {
        const confidence = this.extractConfidence(e.result);
        this.transcriptCallback({
          transcript: e.result.text,
          isPartial: false,
          confidence,
          timestamp: new Date() });
      } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
        logDebug('azureSpeechStreamingFixed', 'Debug message', {});
      }
    };

    // Error handling
    recognizer.canceled = (s, e) => {
      if (e.reason === SpeechSDK.CancellationReason.Error) {
        logError('azureSpeechStreamingFixed', 'Error message', {});
        if (this.errorCallback) {
          this.errorCallback(new Error(`Speech recognition error: ${e.errorDetails}`));
        }
      }
    };

    // Session events
    recognizer.sessionStarted = (s, e) => {
      logDebug('azureSpeechStreamingFixed', 'Debug message', {});
    };

    recognizer.sessionStopped = (s, e) => {
      logDebug('azureSpeechStreamingFixed', 'Debug message', {});
    };
  }

  /**
   * Setup conversation transcriber events for multi-speaker mode
   */
  private setupConversationEvents(transcriber: SpeechSDK.ConversationTranscriber): void {
    // Interim results
    transcriber.transcribing = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech && this.transcriptCallback) {
        const speaker = this.mapSpeakerLabel(e.result.speakerId);
        this.transcriptCallback({
          transcript: e.result.text,
          isPartial: true,
          speaker,
          confidence: 0.8,
          timestamp: new Date() });
      }
    };

    // Final results
    transcriber.transcribed = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && this.transcriptCallback) {
        const speaker = this.mapSpeakerLabel(e.result.speakerId);
        const confidence = this.extractConfidence(e.result);
        this.transcriptCallback({
          transcript: e.result.text,
          isPartial: false,
          speaker,
          confidence,
          timestamp: new Date() });
      }
    };

    // Error handling
    transcriber.canceled = (s, e) => {
      if (e.reason === SpeechSDK.CancellationReason.Error) {
        logError('azureSpeechStreamingFixed', 'Error message', {});
        if (this.errorCallback) {
          this.errorCallback(new Error(`Conversation transcription error: ${e.errorDetails}`));
        }
      }
    };

    // Session events
    transcriber.sessionStarted = (s, e) => {
      logDebug('azureSpeechStreamingFixed', 'Debug message', {});
    };

    transcriber.sessionStopped = (s, e) => {
      logDebug('azureSpeechStreamingFixed', 'Debug message', {});
    };
  }

  /**
   * Extract confidence score from recognition result
   */
  private extractConfidence(result: SpeechSDK.SpeechRecognitionResult): number {
    try {
      // Try to parse detailed result for confidence score
      const detailedResult = JSON.parse(result.json);
      const confidence = detailedResult?.NBest?.[0]?.Confidence;
      return confidence ? parseFloat(confidence) : 0.95;
    } catch {
      // Default confidence if parsing fails
      return 0.95;
    }
  }

  /**
   * Map Azure speaker ID to medical context
   */
  private mapSpeakerLabel(speakerId: string): 'CLINICIAN' | 'PATIENT' {
    // Simple mapping - in production, this could be more sophisticated
    // based on voice characteristics or user selection
    if (speakerId === 'Guest-0' || speakerId === '0') {
      return 'CLINICIAN';
    } else {
      return 'PATIENT';
    }
  }

  /**
   * Fallback to Web Speech API with improved implementation
   */
  private async startWebSpeechFallback(
    mode: 'CONVERSATION' | 'DICTATION',
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (!('webkitSpeechRecognition' in window)) {
      onError(new Error('Speech recognition not supported in this browser'));
      return;
    }

    // Request microphone permission first
    try {
      logDebug('azureSpeechStreamingFixed', 'Debug message', {});
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      logInfo('azureSpeechStreamingFixed', 'Info message', {});
      // Stop the stream as we don't need it for Web Speech API
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      logError('azureSpeechStreamingFixed', 'Error message', {});
      onError(new Error('Microphone permission denied. Please allow microphone access and try again.'));
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    // For conversation mode, simulate speaker detection
    let currentSpeaker: string = mode === 'CONVERSATION' ? 'CLINICIAN' : '';
    let lastSpeechTime = Date.now();
    let wordCount = 0;

    recognition.onresult = (event: any) => {
      logDebug('azureSpeechStreamingFixed', 'Debug message', {});
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        logDebug('azureSpeechStreamingFixed', 'Debug message', {});
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Simple speaker detection for conversation mode
      if (mode === 'CONVERSATION') {
        const now = Date.now();
        const silenceDuration = now - lastSpeechTime;
        
        // Switch speaker after 3 seconds of silence or every 50 words
        if (silenceDuration > 3000 || wordCount > 50) {
          currentSpeaker = currentSpeaker === 'CLINICIAN' ? 'PATIENT' : 'CLINICIAN';
          wordCount = 0;
        }
        
        lastSpeechTime = now;
        wordCount += (finalTranscript + interimTranscript).split(' ').length;
      }

      if (finalTranscript) {
        logDebug('azureSpeechStreamingFixed', 'Debug message', {});
        onTranscript({
          transcript: finalTranscript,
          isPartial: false,
          speaker: mode === 'CONVERSATION' ? currentSpeaker as 'CLINICIAN' | 'PATIENT' : undefined,
          confidence: 0.95,
          timestamp: new Date() });
      } else if (interimTranscript) {
        logDebug('azureSpeechStreamingFixed', 'Debug message', {});
        onTranscript({
          transcript: interimTranscript,
          isPartial: true,
          speaker: mode === 'CONVERSATION' ? currentSpeaker as 'CLINICIAN' | 'PATIENT' : undefined,
          confidence: 0.8,
          timestamp: new Date() });
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        logError('azureSpeechStreamingFixed', 'Error message', {});
        onError(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onstart = () => {
      logInfo('azureSpeechStreamingFixed', 'Info message', {});
    };

    recognition.onend = () => {
      logDebug('azureSpeechStreamingFixed', 'Debug message', {});
      if (this.isRecording) {
        logDebug('azureSpeechStreamingFixed', 'Debug message', {});
        try {
          recognition.start();
        } catch (e) {
          logError('azureSpeechStreamingFixed', 'Error message', {});
        }
      }
    };

    try {
      recognition.start();
      this.isRecording = true;
      
      // Store recognition instance for cleanup
      (this as any).recognition = recognition;
      
      logWarn('azureSpeechStreamingFixed', 'Warning message', {});
      logDebug('azureSpeechStreamingFixed', 'Debug message', {});
    } catch (error) {
      logError('azureSpeechStreamingFixed', 'Error message', {});
      onError(error as Error);
    }
  }

  /**
   * Stop transcription
   */
  stop(): void {
    logDebug('azureSpeechStreamingFixed', 'Debug message', {});
    this.isRecording = false;
    
    // Stop Azure Speech recognizer
    if (this.recognizer) {
      this.recognizer.stopContinuousRecognitionAsync(
        () => {
          logDebug('azureSpeechStreamingFixed', 'Debug message', {});
          this.recognizer?.close();
          this.recognizer = null;
        },
        (error) => {
          logError('azureSpeechStreamingFixed', 'Error message', {});
          this.recognizer?.close();
          this.recognizer = null;
        }
      );
    }

    // Stop Azure conversation transcriber
    if (this.conversationTranscriber) {
      this.conversationTranscriber.stopTranscribingAsync(
        () => {
          logDebug('azureSpeechStreamingFixed', 'Debug message', {});
          this.conversationTranscriber?.close();
          this.conversationTranscriber = null;
        },
        (error) => {
          logError('azureSpeechStreamingFixed', 'Error message', {});
          this.conversationTranscriber?.close();
          this.conversationTranscriber = null;
        }
      );
    }

    // Stop Web Speech API if used
    if ((this as any).recognition) {
      try {
        (this as any).recognition.stop();
        logDebug('azureSpeechStreamingFixed', 'Debug message', {});
      } catch (e) {
        // Ignore errors
      }
      (this as any).recognition = null;
    }

    logInfo('azureSpeechStreamingFixed', 'Info message', {});
  }
}

// Export singleton instance
export const azureSpeechStreamingFixed = new AzureSpeechStreamingFixed();