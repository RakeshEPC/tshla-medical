/**
 * Azure Speech Services - Simplified Working Implementation
 * HIPAA-compliant replacement for AWS Transcribe Simple
 *
 * This is the primary service that should be used by the application
 * for reliable medical speech recognition with Azure Speech Services
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { azureSpeechConfig } from './azureSpeechConfig.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export class AzureSpeechSimpleService {
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private isRecording = false;
  private currentTranscript = '';

  constructor() {
    logInfo('azureSpeechSimple', 'Info message', {});
  }

  /**
   * Start recording with Azure Speech Services
   */
  async startRecording(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ): Promise<boolean> {
    if (!azureSpeechConfig.isConfigured()) {
      onError(
        'Azure Speech Services not configured. Please set VITE_AZURE_SPEECH_KEY and VITE_AZURE_SPEECH_REGION environment variables.'
      );
      return false;
    }

    try {
      logDebug('azureSpeechSimple', 'Debug message', {});

      // Get speech configuration
      const speechConfig = azureSpeechConfig.getSpeechConfig();
      if (!speechConfig) {
        throw new Error('Failed to get speech configuration');
      }

      // Create audio configuration
      const audioConfig = azureSpeechConfig.getOptimizedAudioConfig();

      // Create recognizer
      this.recognizer = azureSpeechConfig.createDictationRecognizer(audioConfig);
      if (!this.recognizer) {
        throw new Error('Failed to create speech recognizer');
      }

      // Clear transcript
      this.currentTranscript = '';
      this.isRecording = true;

      logInfo('azureSpeechSimple', 'Info message', {});

      // Set up event handlers
      this.setupEventHandlers(onTranscript, onError);

      // Start continuous recognition
      this.recognizer.startContinuousRecognitionAsync(
        () => {
          logInfo('azureSpeechSimple', 'Info message', {});
        },
        error => {
          logError('azureSpeechSimple', 'Error message', {});
          onError(`Failed to start recognition: ${error}`);
          this.cleanup();
        }
      );

      return true;
    } catch (error: any) {
      logError('azureSpeechSimple', 'Error message', {});

      // Provide specific error messages
      let errorMessage = 'Azure Speech Services error: ';

      if (error.message?.includes('Invalid subscription key')) {
        errorMessage += 'Invalid subscription key. Please check your VITE_AZURE_SPEECH_KEY.';
      } else if (error.message?.includes('Invalid region')) {
        errorMessage += 'Invalid region. Please check your VITE_AZURE_SPEECH_REGION.';
      } else if (error.message?.includes('Forbidden')) {
        errorMessage +=
          'Access forbidden. Your Azure subscription may not have Speech Services enabled.';
      } else if (error.message?.includes('Network')) {
        errorMessage += 'Network error. Please check your internet connection.';
      } else {
        errorMessage += error.message || 'Failed to start recording';
      }

      onError(errorMessage);
      this.cleanup();
      return false;
    }
  }

  /**
   * Set up event handlers for Azure Speech recognition
   */
  private setupEventHandlers(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ): void {
    if (!this.recognizer) return;

    // Handle interim results
    this.recognizer.recognizing = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
        const transcript = this.enhanceTranscript(e.result.text);
        logDebug('azureSpeechSimple', 'Debug message', {});
        onTranscript(transcript, false);
      }
    };

    // Handle final results
    this.recognizer.recognized = (s, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const transcript = this.enhanceTranscript(e.result.text);
        this.currentTranscript += transcript + ' ';

        // Get confidence score
        const confidence = this.extractConfidence(e.result);

        logInfo('azureSpeechSimple', 'Info message', {});
        onTranscript(transcript, true);
      } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
        logDebug('azureSpeechSimple', 'Debug message', {});
      }
    };

    // Handle cancellation and errors
    this.recognizer.canceled = (s, e) => {
      logDebug('azureSpeechSimple', 'Debug message', {});

      if (e.reason === SpeechSDK.CancellationReason.Error) {
        logError('azureSpeechSimple', 'Error message', {});

        // Handle specific error cases
        if (e.errorDetails.includes('1006')) {
          onError('Connection lost. Please check your internet connection and try again.');
        } else if (e.errorDetails.includes('Forbidden')) {
          onError('Access denied. Please check your Azure Speech Services subscription.');
        } else {
          onError(`Recognition error: ${e.errorDetails}`);
        }
      }
    };

    // Session events
    this.recognizer.sessionStarted = (s, e) => {
      logDebug('azureSpeechSimple', 'Debug message', {});
    };

    this.recognizer.sessionStopped = (s, e) => {
      logDebug('azureSpeechSimple', 'Debug message', {});
      this.isRecording = false;
    };

    // Speech detection events
    this.recognizer.speechStartDetected = (s, e) => {
      logDebug('azureSpeechSimple', 'Debug message', {});
    };

    this.recognizer.speechEndDetected = (s, e) => {
      logDebug('azureSpeechSimple', 'Debug message', {});
    };
  }

  /**
   * Extract confidence score from recognition result
   */
  private extractConfidence(result: SpeechSDK.SpeechRecognitionResult): number {
    try {
      const detailedResult = JSON.parse(result.json);
      const nBest = detailedResult?.NBest;

      if (nBest && nBest.length > 0) {
        const confidence = nBest[0]?.Confidence;
        return confidence ? parseFloat(confidence) : 0.95;
      }

      return 0.95; // Default confidence
    } catch (error) {
      logWarn('azureSpeechSimple', 'Warning message', {});
      return 0.95;
    }
  }

  /**
   * Enhance transcript with medical vocabulary corrections
   */
  private enhanceTranscript(text: string): string {
    if (!text) return text;

    let enhanced = text;

    // Medical abbreviations and corrections
    const medicalCorrections = {
      'b p': 'BP',
      'blood pressure': 'blood pressure',
      'h r': 'HR',
      'heart rate': 'heart rate',
      'r r': 'RR',
      'respiratory rate': 'respiratory rate',
      'o two sat': 'O2 sat',
      'oxygen saturation': 'O2 sat',
      'e k g': 'EKG',
      'c t scan': 'CT scan',
      'm r i': 'MRI',
      'c b c': 'CBC',
      'b m p': 'BMP',
      'c m p': 'CMP',
      'beats per minute': 'bpm',
      'breaths per minute': 'bpm',
      milligrams: 'mg',
      milligram: 'mg',
      micrograms: 'mcg',
      microgram: 'mcg',
      temperature: 'temp',
      'degrees fahrenheit': '°F',
      'degrees celsius': '°C',
    };

    // Apply corrections (case-insensitive)
    Object.entries(medicalCorrections).forEach(([pattern, replacement]) => {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      enhanced = enhanced.replace(regex, replacement);
    });

    // Capitalize common medical terms
    const medicalTerms = [
      'tylenol',
      'acetaminophen',
      'ibuprofen',
      'aspirin',
      'metformin',
      'lisinopril',
      'atorvastatin',
      'amlodipine',
      'omeprazole',
      'diabetes',
      'hypertension',
      'hyperlipidemia',
      'asthma',
      'copd',
      'pneumonia',
      'bronchitis',
      'sinusitis',
      'pharyngitis',
    ];

    medicalTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      enhanced = enhanced.replace(regex, term.charAt(0).toUpperCase() + term.slice(1));
    });

    return enhanced;
  }

  /**
   * Stop recording
   */
  stopRecording(): string {
    logDebug('azureSpeechSimple', 'Debug message', {});
    this.isRecording = false;

    if (this.recognizer) {
      this.recognizer.stopContinuousRecognitionAsync(
        () => {
          logDebug('azureSpeechSimple', 'Debug message', {});
          this.cleanup();
        },
        error => {
          logError('azureSpeechSimple', 'Error message', {});
          this.cleanup();
        }
      );
    }

    logInfo('azureSpeechSimple', 'Info message', {});
    return this.currentTranscript;
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }

    this.isRecording = false;
    logDebug('azureSpeechSimple', 'Debug message', {});
  }

  /**
   * Check if Azure Speech Services is initialized
   */
  isInitialized(): boolean {
    return azureSpeechConfig.isConfigured();
  }

  /**
   * Check if Azure Speech Services is configured (interface compatibility)
   */
  isConfigured(): boolean {
    return azureSpeechConfig.isConfigured();
  }

  /**
   * Stop all Azure Speech Services operations (interface compatibility)
   */
  stop(): void {
    this.stopRecording();
  }

  /**
   * Get current transcript
   */
  getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  /**
   * Clear current transcript
   */
  clearTranscript(): void {
    this.currentTranscript = '';
  }

  /**
   * Check if currently recording
   */
  isRecordingActive(): boolean {
    return this.isRecording;
  }
}

// Singleton instance
export const azureSpeechSimple = new AzureSpeechSimpleService();
