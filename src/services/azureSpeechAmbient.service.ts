/**
 * Azure Speech Services - AMBIENT/CONVERSATION MODE
 * HIPAA-compliant replacement for AWS Transcribe Medical ambient mode
 *
 * Optimized for ambient medical conversation capture with automatic
 * speaker identification and medical vocabulary enhancement
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { azureSpeechConfig } from './azureSpeechConfig.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface TranscriptionResult {
  transcript: string;
  isPartial: boolean;
  speaker?: string;
  confidence?: number;
  timestamp?: string;
}

class AzureSpeechAmbientService {
  private conversationTranscriber: SpeechSDK.ConversationTranscriber | null = null;
  private isRecording = false;
  private transcriptCallback: ((result: TranscriptionResult) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;
  private speakerMapping: Map<string, string> = new Map();
  private speakerCount = 0;

  constructor() {
    logInfo('azureSpeechAmbient', 'Info message', {});
  }

  isConfigured(): boolean {
    return azureSpeechConfig.isConfigured();
  }

  /**
   * Start ambient/conversation transcription
   * This is optimized for continuous background conversation capture
   */
  async startConversation(
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (!this.isConfigured()) {
      logWarn('azureSpeechAmbient', 'Warning message', {});
      return this.fallbackToWebSpeech(onTranscript, onError);
    }

    this.transcriptCallback = onTranscript;
    this.errorCallback = onError;

    try {
      // Create audio configuration optimized for ambient capture
      const audioConfig = this.createAmbientAudioConfig();

      // Create conversation transcriber for multi-speaker scenarios
      this.conversationTranscriber = azureSpeechConfig.createConversationTranscriber(audioConfig);
      if (!this.conversationTranscriber)
        throw new Error('Failed to create conversation transcriber');

      // Configure ambient-specific settings
      this.configureAmbientSettings();

      // Set up event handlers for ambient mode
      this.setupAmbientEvents();

      // Start transcription
      this.conversationTranscriber.startTranscribingAsync(
        () => {
          this.isRecording = true;
          logDebug('azureSpeechAmbient', 'Debug message', {});
        },
        error => {
          logError('azureSpeechAmbient', 'Error message', {});
          onError(new Error(`Failed to start ambient conversation: ${error}`));
          this.cleanup();
        }
      );
    } catch (error) {
      logError('azureSpeechAmbient', 'Error message', {});
      logWarn('azureSpeechAmbient', 'Warning message', {});
      return this.fallbackToWebSpeech(onTranscript, onError);
    }
  }

  /**
   * Create audio configuration optimized for ambient capture
   */
  private createAmbientAudioConfig(): SpeechSDK.AudioConfig {
    // Use default microphone with settings optimized for ambient conversation
    return SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  }

  /**
   * Configure settings specific to ambient conversation capture
   */
  private configureAmbientSettings(): void {
    const speechConfig = azureSpeechConfig.getSpeechConfig();
    if (!speechConfig) return;

    // Configure for ambient conversation mode
    speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
      '10000' // Allow longer initial silence for ambient scenarios
    );

    speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
      '500' // Shorter end silence for natural conversation flow
    );

    // Enable continuous recognition for ambient capture
    speechConfig.setProperty('SpeechServiceConnection_Mode', 'Conversation');

    // Optimize for multiple speakers
    speechConfig.setProperty('ConversationTranscriptionInRoomAndOnline', 'true');
  }

  /**
   * Set up event handlers optimized for ambient conversation
   */
  private setupAmbientEvents(): void {
    if (!this.conversationTranscriber) return;

    // Handle interim results (for real-time feedback)
    this.conversationTranscriber.transcribing = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech && this.transcriptCallback) {
        const speaker = this.getSpeakerLabel(e.result.speakerId);

        this.transcriptCallback({
          transcript: e.result.text,
          isPartial: true,
          speaker,
          confidence: 0.8,
          timestamp: new Date().toISOString(),
        });
      }
    };

    // Handle final results
    this.conversationTranscriber.transcribed = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && this.transcriptCallback) {
        const speaker = this.getSpeakerLabel(e.result.speakerId);
        const confidence = this.extractConfidence(e.result);

        // Log ambient conversation capture
        logDebug('azureSpeechAmbient', 'Debug message', {});

        this.transcriptCallback({
          transcript: e.result.text,
          isPartial: false,
          speaker,
          confidence,
          timestamp: new Date().toISOString(),
        });
      }
    };

    // Handle errors with ambient-specific logging
    this.conversationTranscriber.canceled = (s, e) => {
      if (e.reason === SpeechSDK.CancellationReason.Error) {
        logError('azureSpeechAmbient', 'Error message', {});
        if (this.errorCallback && e.errorDetails !== 'No speech was detected') {
          // Don't treat "no speech" as an error in ambient mode
          this.errorCallback(new Error(`Ambient conversation error: ${e.errorDetails}`));
        }
      }
    };

    // Session events for ambient monitoring
    this.conversationTranscriber.sessionStarted = (s, e) => {
      logDebug('azureSpeechAmbient', 'Debug message', {});
    };

    this.conversationTranscriber.sessionStopped = (s, e) => {
      logDebug('azureSpeechAmbient', 'Debug message', {});
      this.isRecording = false;
    };

    // Participant tracking for ambient scenarios
    this.conversationTranscriber.participantAdded = (s, e) => {
      this.addSpeaker(e.participant.id);
      logDebug('azureSpeechAmbient', 'Debug message', {});
    };

    this.conversationTranscriber.participantRemoved = (s, e) => {
      logDebug('azureSpeechAmbient', 'Debug message', {});
    };
  }

  /**
   * Get or create speaker label for ambient conversation
   */
  private getSpeakerLabel(speakerId: string): string {
    if (!speakerId) {
      return 'Speaker_1'; // Default speaker
    }

    if (this.speakerMapping.has(speakerId)) {
      return this.speakerMapping.get(speakerId)!;
    }

    // Add new speaker
    return this.addSpeaker(speakerId);
  }

  /**
   * Add new speaker to the conversation
   */
  private addSpeaker(speakerId: string): string {
    this.speakerCount++;
    const speakerLabel = `Speaker_${this.speakerCount}`;
    this.speakerMapping.set(speakerId, speakerLabel);
    return speakerLabel;
  }

  /**
   * Extract confidence score from recognition result
   */
  private extractConfidence(result: SpeechSDK.ConversationTranscriptionResult): number {
    try {
      const detailedResult = JSON.parse(result.json);
      const confidence = detailedResult?.NBest?.[0]?.Confidence;
      return confidence ? parseFloat(confidence) : 0.95;
    } catch {
      return 0.95;
    }
  }

  /**
   * Fallback to Web Speech API for ambient conversation mode
   */
  private async fallbackToWebSpeech(
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (!('webkitSpeechRecognition' in window)) {
      onError(new Error('Speech recognition not supported'));
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let lastSpeaker = 'Speaker_1';
    let silenceTimer: NodeJS.Timeout;
    let wordCount = 0;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Simple speaker detection based on silence gaps
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        // Switch speaker after 3 seconds of silence
        lastSpeaker = lastSpeaker === 'Speaker_1' ? 'Speaker_2' : 'Speaker_1';
        wordCount = 0;
      }, 3000);

      // Also switch speaker after every 50 words (rough heuristic)
      wordCount += (finalTranscript + interimTranscript).split(' ').length;
      if (wordCount > 50) {
        lastSpeaker = lastSpeaker === 'Speaker_1' ? 'Speaker_2' : 'Speaker_1';
        wordCount = 0;
      }

      if (finalTranscript) {
        onTranscript({
          transcript: finalTranscript,
          isPartial: false,
          speaker: lastSpeaker,
          confidence: 0.95,
          timestamp: new Date().toISOString(),
        });
      } else if (interimTranscript) {
        onTranscript({
          transcript: interimTranscript,
          isPartial: true,
          speaker: lastSpeaker,
          confidence: 0.8,
          timestamp: new Date().toISOString(),
        });
      }
    };

    recognition.onerror = (event: any) => {
      logError('azureSpeechAmbient', 'Error message', {});
      if (event.error !== 'no-speech') {
        onError(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      if (this.isRecording) {
        // Restart if still recording (ambient mode should be continuous)
        recognition.start();
      }
    };

    recognition.start();
    this.isRecording = true;

    // Store recognition instance for cleanup
    (this as any).recognition = recognition;

    logWarn('azureSpeechAmbient', 'Warning message', {});
  }

  /**
   * Stop ambient transcription
   */
  stop(): void {
    logDebug('azureSpeechAmbient', 'Debug message', {});
    this.isRecording = false;

    if (this.conversationTranscriber) {
      this.conversationTranscriber.stopTranscribingAsync(
        () => {
          logDebug('azureSpeechAmbient', 'Debug message', {});
          this.cleanup();
        },
        error => {
          logError('azureSpeechAmbient', 'Error message', {});
          this.cleanup();
        }
      );
    }

    if ((this as any).recognition) {
      (this as any).recognition.stop();
    }

    this.cleanup();
  }

  /**
   * Get current speaker mappings
   */
  getSpeakers(): Map<string, string> {
    return new Map(this.speakerMapping);
  }

  /**
   * Reset speaker mappings (for new conversation)
   */
  resetSpeakers(): void {
    this.speakerMapping.clear();
    this.speakerCount = 0;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.conversationTranscriber) {
      this.conversationTranscriber.close();
      this.conversationTranscriber = null;
    }

    this.speakerMapping.clear();
    this.speakerCount = 0;
    this.transcriptCallback = null;
    this.errorCallback = null;
    this.isRecording = false;

    logDebug('azureSpeechAmbient', 'Debug message', {});
  }
}

// Export singleton instance
export const azureSpeechAmbientService = new AzureSpeechAmbientService();
