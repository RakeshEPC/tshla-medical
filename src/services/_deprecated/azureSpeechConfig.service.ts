/**
 * Azure Speech Services Configuration
 * HIPAA-compliant speech-to-text service configuration
 *
 * Replaces AWS Transcribe Medical in Azure migration
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { logError, logWarn, logInfo, logDebug } from '../logger.service';

export interface AzureSpeechConfig {
  subscriptionKey: string;
  region: string;
  language: string;
  endpointId?: string;
  enableDictation: boolean;
  enableConversation: boolean;
  enableMedicalPhrases: boolean;
}

export class AzureSpeechConfigService {
  private config: AzureSpeechConfig;
  private speechConfig: SpeechSDK.SpeechConfig | null = null;

  constructor() {
    this.config = this.loadConfiguration();
    this.initializeSpeechConfig();
  }

  private loadConfiguration(): AzureSpeechConfig {
    const subscriptionKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const region = import.meta.env.VITE_AZURE_SPEECH_REGION || 'centralus';

    if (!subscriptionKey) {
      logWarn('azureSpeechConfig', 'Warning message', {});
    }

    return {
      subscriptionKey,
      region,
      language: 'en-US',
      enableDictation: true,
      enableConversation: true,
      enableMedicalPhrases: true,
    };
  }

  private initializeSpeechConfig(): void {
    if (!this.config.subscriptionKey) {
      logWarn('azureSpeechConfig', 'Warning message', {});
      return;
    }

    try {
      this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        this.config.subscriptionKey,
        this.config.region
      );

      // Configure speech recognition
      this.speechConfig.speechRecognitionLanguage = this.config.language;

      // Enable medical phrase list for better medical terminology recognition
      if (this.config.enableMedicalPhrases) {
        // Note: Medical phrase lists will be configured per recognition session
        logDebug('azureSpeechConfig', 'Debug message', {});
      }

      // Set output format to detailed for confidence scores
      this.speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;

      // Enable profanity masking (medical compliance)
      this.speechConfig.setProfanity(SpeechSDK.ProfanityOption.Masked);

      logInfo('azureSpeechConfig', 'Info message', {});
    } catch (error) {
      logError('azureSpeechConfig', 'Error message', {});
    }
  }

  isConfigured(): boolean {
    return this.speechConfig !== null && !!this.config.subscriptionKey;
  }

  getSpeechConfig(): SpeechSDK.SpeechConfig | null {
    return this.speechConfig;
  }

  getConfig(): AzureSpeechConfig {
    return { ...this.config };
  }

  /**
   * Create speech recognizer for dictation mode
   */
  createDictationRecognizer(
    audioConfig?: SpeechSDK.AudioConfig
  ): SpeechSDK.SpeechRecognizer | null {
    if (!this.speechConfig) return null;

    const recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, audioConfig);

    // Configure for medical dictation
    this.configureMedicalPhrases(recognizer);

    return recognizer;
  }

  /**
   * Create conversation transcriber for multi-speaker scenarios
   */
  createConversationTranscriber(
    audioConfig?: SpeechSDK.AudioConfig
  ): SpeechSDK.ConversationTranscriber | null {
    if (!this.speechConfig) return null;

    const transcriber = new SpeechSDK.ConversationTranscriber(audioConfig);

    // Configure for medical conversation
    this.configureMedicalPhrases(transcriber as any);

    return transcriber;
  }

  /**
   * Configure medical phrases for better recognition
   */
  private configureMedicalPhrases(recognizer: SpeechSDK.SpeechRecognizer): void {
    try {
      // Create phrase list grammar for medical terminology
      const phraseListGrammar = SpeechSDK.PhraseListGrammar.fromRecognizer(recognizer);

      // Add common medical phrases
      const medicalPhrases = [
        // Vital signs
        'blood pressure',
        'heart rate',
        'respiratory rate',
        'temperature',
        'oxygen saturation',
        'systolic',
        'diastolic',
        'beats per minute',
        'breaths per minute',

        // Symptoms
        'chest pain',
        'shortness of breath',
        'nausea',
        'vomiting',
        'dizziness',
        'fatigue',
        'headache',
        'abdominal pain',
        'back pain',
        'joint pain',
        'muscle pain',

        // Medical conditions
        'diabetes',
        'hypertension',
        'asthma',
        'COPD',
        'pneumonia',
        'bronchitis',
        'myocardial infarction',
        'stroke',
        'seizure',
        'fracture',
        'laceration',

        // Medications
        'milligrams',
        'micrograms',
        'units',
        'twice daily',
        'three times daily',
        'as needed',
        'before meals',
        'after meals',
        'at bedtime',

        // Anatomy
        'anterior',
        'posterior',
        'lateral',
        'medial',
        'proximal',
        'distal',
        'superior',
        'inferior',
        'cervical',
        'thoracic',
        'lumbar',
        'sacral',

        // Common medical abbreviations (spoken)
        'B P',
        'H R',
        'R R',
        'O two sat',
        'E K G',
        'C T scan',
        'M R I',
        'CBC',
        'BMP',
        'CMP',
        'PT',
        'PTT',
        'INR',
      ];

      medicalPhrases.forEach(phrase => {
        phraseListGrammar.addPhrase(phrase);
      });

      logDebug('azureSpeechConfig', 'Debug message', {});
    } catch (error) {
      logWarn('azureSpeechConfig', 'Warning message', {});
    }
  }

  /**
   * Get medical-optimized audio configuration
   */
  getOptimizedAudioConfig(): SpeechSDK.AudioConfig {
    // Use default microphone with optimal settings for medical dictation
    return SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AzureSpeechConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeSpeechConfig();
  }

  /**
   * Test connection to Azure Speech Services
   */
  async testConnection(): Promise<boolean> {
    if (!this.speechConfig) {
      logError('azureSpeechConfig', 'Error message', {});
      return false;
    }

    try {
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, audioConfig);

      return new Promise(resolve => {
        recognizer.sessionStarted = () => {
          logInfo('azureSpeechConfig', 'Info message', {});
          recognizer.close();
          resolve(true);
        };

        recognizer.canceled = (s, e) => {
          logError('azureSpeechConfig', 'Error message', {});
          recognizer.close();
          resolve(false);
        };

        // Start a brief recognition session to test connection
        recognizer.startContinuousRecognitionAsync();

        // Stop after 1 second
        setTimeout(() => {
          recognizer.stopContinuousRecognitionAsync();
        }, 1000);
      });
    } catch (error) {
      logError('azureSpeechConfig', 'Error message', {});
      return false;
    }
  }
}

// Export singleton instance
export const azureSpeechConfig = new AzureSpeechConfigService();
