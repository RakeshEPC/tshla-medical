/**
 * Centralized Dictation Service
 * Handles all voice recognition functionality
 */

import { medicalVocabularyService } from './medicalVocabulary.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export class DictationService {
  private recognition: any = null;
  private isListening = false;
  private onTranscriptUpdate?: (text: string, isFinal: boolean) => void;
  private onError?: (error: string) => void;
  private onStatusChange?: (status: 'idle' | 'listening' | 'processing') => void;

  constructor() {
    this.initializeRecognition();
  }

  private initializeRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      logError('dictation', 'Error message', {});
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      logDebug('dictation', 'Debug message', {});
      this.setupEventHandlers();
    } catch (error) {
      logError('dictation', 'Error message', {});
      this.recognition = null;
    }
  }

  private setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStatusChange?.('listening');
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        // Enhance medical vocabulary for final transcripts
        const enhancedTranscript = medicalVocabularyService.enhanceTranscript(finalTranscript);
        this.onTranscriptUpdate?.(enhancedTranscript, true);
      }
      if (interimTranscript) {
        // Also enhance interim results for better real-time display
        const enhancedInterim = medicalVocabularyService.enhanceTranscript(interimTranscript);
        this.onTranscriptUpdate?.(enhancedInterim, false);
      }
    };

    this.recognition.onerror = (event: any) => {
      // Don't log aborted or no-speech errors as they're normal
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }

      logError('dictation', 'Error message', {});

      if (event.error === 'not-allowed') {
        this.onError?.(
          'Microphone access denied. Please check your browser settings and allow microphone access for this site.'
        );
        this.stop();
        return;
      }

      if (event.error === 'network') {
        this.onError?.('Network error. Please check your internet connection.');
        this.stop();
        return;
      }

      if (event.error === 'audio-capture') {
        this.onError?.(
          'Microphone not found or not working. Please check your microphone connection.'
        );
        this.stop();
        return;
      }

      if (event.error === 'aborted') {
        // User aborted - normal
        return;
      }

      // For other errors, try to recover
      if (this.isListening) {
        logDebug('dictation', 'Debug message', {});
        setTimeout(() => this.restart(), 500);
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        // Auto-restart if we should still be listening
        setTimeout(() => this.restart(), 100);
      } else {
        this.onStatusChange?.('idle');
      }
    };
  }

  public start(
    onTranscriptUpdate: (text: string, isFinal: boolean) => void,
    onError?: (error: string) => void,
    onStatusChange?: (status: 'idle' | 'listening' | 'processing') => void
  ): boolean {
    if (!this.recognition) {
      onError?.('Speech recognition not available');
      return false;
    }

    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onError = onError;
    this.onStatusChange = onStatusChange;

    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e) {
      logError('dictation', 'Error message', {});
      return false;
    }
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        logError('dictation', 'Error message', {});
      }
    }
    this.onStatusChange?.('idle');
  }

  private restart() {
    if (!this.isListening || !this.recognition) return;

    try {
      this.recognition.start();
    } catch (e) {
      // Already started or other error
      logDebug('dictation', 'Debug message', {});
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasSpeechRecognition =
      !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;

    // Also check if recognition was successfully initialized
    if (hasSpeechRecognition && !this.recognition) {
      // Try to initialize if not already done
      this.initializeRecognition();
    }

    return hasSpeechRecognition && this.recognition !== null;
  }
}

// Singleton instance
export const dictationService = new DictationService();
