/**
 * Azure Speech Services - Reliable Medical Transcription
 * Replacing unreliable AWS Transcribe Medical
 * HIPAA Compliant with Microsoft BAA
 */

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export interface AzureTranscriptionResult {
  transcript: string;
  isPartial: boolean;
  speaker?: string;
  confidence?: number;
  timestamp?: string;
}

class AzureSpeechTranscriptionService {
  private speechConfig: sdk.SpeechConfig | null = null;
  private audioConfig: sdk.AudioConfig | null = null;
  private recognizer: sdk.SpeechRecognizer | null = null;
  private isRecording = false;
  private transcriptCallback: ((result: AzureTranscriptionResult) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const speechRegion = import.meta.env.VITE_AZURE_SPEECH_REGION || 'centralus';

    if (!speechKey) {
      logWarn('azureSpeechTranscription', 'Warning message', {});
      return;
    }

    try {
      this.speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);

      // Configure for medical transcription
      this.speechConfig.speechRecognitionLanguage = 'en-US';
      this.speechConfig.enableDictation(); // Better for medical terminology
      this.speechConfig.requestWordLevelTimestamps(); // For precise timing
      this.speechConfig.enableAudioLogging = false; // HIPAA compliance
      this.speechConfig.outputFormat = sdk.OutputFormat.Detailed;

      logInfo('azureSpeechTranscription', 'Info message', {});
      logDebug('azureSpeechTranscription', 'Debug message', {});
      logDebug('azureSpeechTranscription', 'Debug message', {});
    } catch (error) {
      logError('azureSpeechTranscription', 'Error message', {});
    }
  }

  async startRecording(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ): Promise<boolean> {
    if (!this.speechConfig) {
      onError('Azure Speech not configured');
      return false;
    }

    if (this.isRecording) {
      onError('Already recording');
      return false;
    }

    try {
      logDebug('azureSpeechTranscription', 'Debug message', {});

      // Get microphone access
      this.audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();

      // Create recognizer
      this.recognizer = new sdk.SpeechRecognizer(this.speechConfig, this.audioConfig);

      this.transcriptCallback = onTranscript;
      this.errorCallback = onError;
      this.isRecording = true;

      // Handle real-time transcription results
      this.recognizer.recognizing = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
          logDebug('azureSpeechTranscription', 'Debug message', {});
          this.transcriptCallback?.(e.result.text, false);
        }
      };

      // Handle final results
      this.recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          logInfo('azureSpeechTranscription', 'Info message', {});
          this.transcriptCallback?.(e.result.text, true);
        } else if (e.result.reason === sdk.ResultReason.NoMatch) {
          logDebug('azureSpeechTranscription', 'Debug message', {});
        }
      };

      // Handle errors
      this.recognizer.canceled = (s, e) => {
        logError('azureSpeechTranscription', 'Error message', {});
        if (e.reason === sdk.CancellationReason.Error) {
          this.errorCallback?.(new Error(`Azure Speech error: ${e.errorDetails}`));
        }
        this.stopRecording();
      };

      // Handle session events
      this.recognizer.sessionStarted = (s, e) => {
        logDebug('azureSpeechTranscription', 'Debug message', {});
      };

      this.recognizer.sessionStopped = (s, e) => {
        logDebug('azureSpeechTranscription', 'Debug message', {});
        this.stopRecording();
      };

      // Start continuous recognition
      this.recognizer.startContinuousRecognitionAsync(
        () => {
          logInfo('azureSpeechTranscription', 'Info message', {});
        },
        error => {
          logError('azureSpeechTranscription', 'Error message', {});
          this.errorCallback?.(new Error(`Failed to start recognition: ${error}`));
          this.stopRecording();
        }
      );

      return true;
    } catch (error) {
      logError('azureSpeechTranscription', 'Error message', {});
      onError(`Recording failed: ${error}`);
      this.stopRecording();
      return false;
    }
  }

  stopRecording(): void {
    if (!this.isRecording) return;

    logDebug('azureSpeechTranscription', 'Debug message', {});
    this.isRecording = false;

    if (this.recognizer) {
      this.recognizer.stopContinuousRecognitionAsync(
        () => {
          logInfo('azureSpeechTranscription', 'Info message', {});
          this.cleanup();
        },
        error => {
          logError('azureSpeechTranscription', 'Error message', {});
          this.cleanup();
        }
      );
    } else {
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }
    if (this.audioConfig) {
      this.audioConfig.close();
      this.audioConfig = null;
    }
    this.transcriptCallback = null;
    this.errorCallback = null;
  }

  private parseConfidence(result: sdk.SpeechRecognitionResult): number {
    try {
      // Azure provides confidence scores in detailed results
      const detailed = result as any;
      if (detailed.json && detailed.json.NBest && detailed.json.NBest[0]) {
        return detailed.json.NBest[0].Confidence || 0.8;
      }
      return 0.8; // Default confidence
    } catch {
      return 0.8;
    }
  }

  /**
   * Test if Azure Speech is configured and accessible
   */
  async testConnection(): Promise<boolean> {
    if (!this.speechConfig) {
      return false;
    }

    try {
      // Simple test synthesis to verify connection
      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
      return new Promise(resolve => {
        synthesizer.speakTextAsync(
          '',
          result => {
            synthesizer.close();
            resolve(result.reason === sdk.ResultReason.SynthesizingAudioCompleted);
          },
          error => {
            synthesizer.close();
            resolve(false);
          }
        );
      });
    } catch {
      return false;
    }
  }

  isAvailable(): boolean {
    return this.speechConfig !== null;
  }
}

// Export singleton instance
export const azureSpeechTranscription = new AzureSpeechTranscriptionService();

/**
 * Migration Notes:
 *
 * REPLACE:
 * import { awsTranscribeSimple } from './awsTranscribeSimple.service';
 *
 * WITH:
 * import { azureSpeechTranscription } from './azureSpeechTranscription.service';
 *
 * API is compatible - same methods: startRecording(), stopRecording()
 */
