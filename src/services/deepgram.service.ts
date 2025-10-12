/**
 * Deepgram Speech-to-Text Service
 * Medical-grade transcription with 83% cost savings over AWS Transcribe Medical
 * HIPAA Compliant with BAA available
 */

import { logInfo, logError, logDebug, logWarn } from './logger.service';

export interface DeepgramConfig {
  apiKey: string;
  model: string;
  language: string;
  tier: string;
  encoding: string;
  sampleRate: number;
  channels: number;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  speaker?: number;
  is_final: boolean;
  metadata?: {
    duration: number;
    model_version: string;
    language: string;
  };
}

export interface DeepgramResponse {
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
        speaker?: number;
      }>;
    }>;
  };
  metadata: {
    transaction_key: string;
    request_id: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
    models: string[];
  };
  is_final?: boolean;
}

class DeepgramService {
  private apiKey: string;
  private config: DeepgramConfig;
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private transcriptionCallback: ((result: TranscriptionResult) => void) | null = null;

  constructor() {
    this.apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;

    // Debug logging to verify API key is loaded
    if (!this.apiKey) {
      console.error('❌ CRITICAL: VITE_DEEPGRAM_API_KEY is undefined!');
      console.error('Available environment variables:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
      throw new Error('Deepgram API key not configured. Set VITE_DEEPGRAM_API_KEY environment variable.');
    } else {
      const keyPreview = this.apiKey.substring(0, 8) + '...' + this.apiKey.substring(this.apiKey.length - 4);
      console.log('✅ Deepgram API key loaded:', keyPreview);
      console.log('   Key length:', this.apiKey.length, 'characters');
    }

    this.config = {
      apiKey: this.apiKey,
      model: import.meta.env.VITE_DEEPGRAM_MODEL || 'medical',
      language: import.meta.env.VITE_DEEPGRAM_LANGUAGE || 'en-US',
      tier: import.meta.env.VITE_DEEPGRAM_TIER || 'enhanced',
      encoding: 'opus', // Match MediaRecorder output format (audio/webm;codecs=opus)
      sampleRate: 48000, // Opus typically uses 48kHz
      channels: 1
    };

    console.log('✅ Deepgram configuration:', {
      model: this.config.model,
      language: this.config.language,
      tier: this.config.tier
    });

    logInfo('deepgram', `Initialized with model: ${this.config.model}`);
  }

  /**
   * Start real-time transcription session
   */
  async startRealTimeTranscription(
    onTranscription: (result: TranscriptionResult) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      this.transcriptionCallback = onTranscription;

      const wsUrl = this.buildWebSocketUrl();
      logDebug('deepgram', `Connecting to Deepgram WebSocket`);

      // Create WebSocket connection
      // Authentication is now handled via the token parameter in the URL
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logInfo('deepgram', 'Real-time transcription session started');
      };

      this.websocket.onmessage = (event) => {
        try {
          const response: DeepgramResponse = JSON.parse(event.data);

          if (response.channel?.alternatives?.[0]) {
            const alternative = response.channel.alternatives[0];

            const result: TranscriptionResult = {
              transcript: alternative.transcript,
              confidence: alternative.confidence,
              words: alternative.words?.map(word => ({
                word: word.word,
                start: word.start,
                end: word.end,
                confidence: word.confidence
              })) || [],
              speaker: alternative.words?.[0]?.speaker,
              is_final: response.is_final !== false,
              metadata: response.metadata ? {
                duration: response.metadata.duration,
                model_version: response.metadata.models?.[0] || 'medical',
                language: this.config.language
              } : undefined
            };

            if (result.transcript.trim()) {
              logDebug('deepgram', `Transcribed: "${result.transcript}" (confidence: ${result.confidence})`);
              this.transcriptionCallback?.(result);
            }
          }
        } catch (parseError) {
          logError('deepgram', `Failed to parse WebSocket message: ${parseError}`);
        }
      };

      this.websocket.onerror = (error) => {
        logError('deepgram', `WebSocket error:`, error);
        onError?.(new Error(`Deepgram WebSocket error: ${JSON.stringify(error)}`));
      };

      this.websocket.onclose = (event) => {
        this.isConnected = false;

        let errorMessage = `WebSocket closed - Code: ${event.code}, Reason: "${event.reason || 'No reason provided'}", Clean: ${event.wasClean}`;

        // Add specific error messages for common error codes
        if (event.code === 1006) {
          errorMessage += '\n\n⚠️ ERROR 1006: Abnormal Closure (Connection failed before handshake)';
          errorMessage += '\n\n🔍 Most common causes:';
          errorMessage += '\n   1. Invalid or missing Deepgram API key';
          errorMessage += '\n   2. Network/firewall blocking WebSocket connections';
          errorMessage += '\n   3. Deepgram service temporarily unavailable';
          errorMessage += '\n   4. CORS policy blocking the connection';
          errorMessage += '\n\n💡 Troubleshooting:';
          errorMessage += '\n   • Check browser console for "Deepgram API key loaded" message';
          errorMessage += '\n   • Verify internet connection is stable';
          errorMessage += '\n   • Try refreshing the page or using a different browser';
          errorMessage += '\n   • Check Deepgram service status at status.deepgram.com';

          console.error('❌ Deepgram Error 1006 - Detailed Info:', {
            code: event.code,
            reason: event.reason || 'None provided',
            wasClean: event.wasClean,
            apiKeyConfigured: !!this.apiKey,
            apiKeyLength: this.apiKey?.length || 0,
            model: this.config.model,
            timestamp: new Date().toISOString()
          });
        } else if (event.code === 4008) {
          errorMessage += '\n\n⚠️ ERROR 4008: Invalid API key or authentication failed';
          errorMessage += '\n   Your Deepgram API key may be invalid or expired.';
        } else if (event.code === 4009) {
          errorMessage += '\n\n⚠️ ERROR 4009: Insufficient credits';
          errorMessage += '\n   Your Deepgram account has run out of credits.';
        }

        logError('deepgram', errorMessage);

        // Log to console for debugging
        console.error('Deepgram WebSocket Close Event:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          timestamp: new Date().toISOString()
        });

        // Call error callback with detailed info
        onError?.(new Error(errorMessage));

        // Auto-reconnect on unexpected close (except for auth errors)
        if (event.code !== 1000 && event.code !== 4008 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect(onTranscription, onError);
        }
      };

    } catch (error) {
      logError('deepgram', `Failed to start real-time transcription: ${error}`);
      throw error;
    }
  }

  /**
   * Send audio data to Deepgram for transcription
   */
  sendAudioData(audioData: ArrayBuffer | Blob): void {
    if (!this.isConnected || !this.websocket) {
      logWarn('deepgram', 'Cannot send audio - WebSocket not connected');
      return;
    }

    try {
      if (audioData instanceof Blob) {
        // Convert Blob to ArrayBuffer
        audioData.arrayBuffer().then(buffer => {
          this.websocket?.send(buffer);
        });
      } else {
        this.websocket.send(audioData);
      }
    } catch (error) {
      logError('deepgram', `Failed to send audio data: ${error}`);
    }
  }

  /**
   * Stop real-time transcription
   */
  stopRealTimeTranscription(): void {
    if (this.websocket) {
      // Send close frame to signal end of audio
      if (this.isConnected) {
        this.websocket.send(JSON.stringify({ type: 'CloseStream' }));
      }

      this.websocket.close(1000, 'Session ended by user');
      this.websocket = null;
    }

    this.isConnected = false;
    this.transcriptionCallback = null;
    logInfo('deepgram', 'Real-time transcription session stopped');
  }

  /**
   * Process pre-recorded audio file
   */
  async transcribeAudioFile(audioFile: File): Promise<TranscriptionResult> {
    try {
      logInfo('deepgram', `Transcribing audio file: ${audioFile.name}`);

      const formData = new FormData();
      formData.append('audio', audioFile);

      const response = await fetch('https://api.deepgram.com/v1/listen', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
        body: formData,
        // Add query parameters for medical model
        // URL will be built with parameters
      });

      if (!response.ok) {
        throw new Error(`Deepgram API error: ${response.status} ${response.statusText}`);
      }

      const result: DeepgramResponse = await response.json();

      if (!result.channel?.alternatives?.[0]) {
        throw new Error('No transcription result received from Deepgram');
      }

      const alternative = result.channel.alternatives[0];

      logInfo('deepgram', `File transcription completed with confidence: ${alternative.confidence}`);

      return {
        transcript: alternative.transcript,
        confidence: alternative.confidence,
        words: alternative.words?.map(word => ({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence
        })) || [],
        is_final: true,
        metadata: {
          duration: result.metadata.duration,
          model_version: result.metadata.models?.[0] || 'medical',
          language: this.config.language
        }
      };

    } catch (error) {
      logError('deepgram', `File transcription failed: ${error}`);
      throw error;
    }
  }

  /**
   * Build WebSocket URL with medical model parameters
   */
  private buildWebSocketUrl(): string {
    const baseUrl = 'wss://api.deepgram.com/v1/listen';

    // Verify API key exists before building URL
    if (!this.apiKey || this.apiKey.length === 0) {
      console.error('❌ Cannot build WebSocket URL: API key is missing');
      throw new Error('Deepgram API key is required but not set');
    }

    const params = new URLSearchParams({
      // Authentication via query parameter (browsers don't support custom WS headers)
      token: this.apiKey,
      model: this.config.model,
      language: this.config.language,
      tier: this.config.tier,
      // NOTE: encoding/sample_rate omitted - Deepgram auto-detects from WebM/Opus container
      channels: this.config.channels.toString(),
      // Medical-specific parameters
      punctuate: 'true',
      profanity_filter: 'false', // Medical terms might be flagged
      redact: 'false', // Keep all medical information
      diarize: 'true', // Enable speaker diarization for doctor-patient conversations
      smart_format: 'true', // Format numbers, dates, times properly
      utterances: 'true', // Get utterance-level results
      endpointing: '300', // Wait 300ms for end of speech
      // Custom vocabulary for medical terms
      keywords: 'medical:2,diagnosis:2,prescription:2,medication:2,symptoms:2,treatment:2'
    });

    const fullUrl = `${baseUrl}?${params.toString()}`;

    // Debug logging (without exposing full API key)
    console.log('🔗 Building Deepgram WebSocket URL:', {
      baseUrl,
      tokenPresent: params.has('token'),
      tokenLength: this.apiKey.length,
      model: this.config.model,
      paramCount: Array.from(params.keys()).length
    });

    return fullUrl;
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private async attemptReconnect(
    onTranscription: (result: TranscriptionResult) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    logWarn('deepgram', `Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.startRealTimeTranscription(onTranscription, onError);
    }, delay);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    model: string;
    language: string;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      model: this.config.model,
      language: this.config.language
    };
  }

  /**
   * Test Deepgram connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
        },
      });

      const isValid = response.ok;

      if (isValid) {
        logInfo('deepgram', 'Connection test successful');
      } else {
        logError('deepgram', `Connection test failed: ${response.status}`);
      }

      return isValid;
    } catch (error) {
      logError('deepgram', `Connection test error: ${error}`);
      return false;
    }
  }
}

// Export singleton instance
export const deepgramService = new DeepgramService();