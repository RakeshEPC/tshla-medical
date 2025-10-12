/**
 * Deepgram SDK Service
 * HIPAA-compliant speech-to-text using official Deepgram JavaScript SDK
 * Replaces Azure Speech Services due to quota/credit issues
 * Medical-grade transcription with 83% cost savings over AWS Transcribe Medical
 */

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { logInfo, logError, logDebug, logWarn } from './logger.service';
import type { TranscriptionResult, SpeechServiceInterface } from './speechServiceRouter.service';

export interface DeepgramSDKConfig {
  apiKey: string;
  model: string;
  language: string;
  tier: string;
  encoding: string;
  sampleRate: number;
  channels: number;
}

export interface DeepgramTranscriptResult {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: number;
  }>;
  speaker?: number;
  is_final: boolean;
  metadata?: {
    duration: number;
    model_version: string;
    language: string;
  };
}

class DeepgramSDKService implements SpeechServiceInterface {
  private deepgram: any;
  private config: DeepgramSDKConfig;
  private connection: any = null;
  private isRecording = false;
  private currentTranscript = '';
  private onTranscriptCallback: ((result: TranscriptionResult) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;

  constructor() {
    this.config = {
      apiKey: import.meta.env.VITE_DEEPGRAM_API_KEY,
      model: import.meta.env.VITE_DEEPGRAM_MODEL || 'nova-2-medical',
      language: import.meta.env.VITE_DEEPGRAM_LANGUAGE || 'en-US',
      tier: import.meta.env.VITE_DEEPGRAM_TIER || 'enhanced',
      encoding: 'linear16',
      sampleRate: 16000,
      channels: 1
    };

    if (!this.config.apiKey) {
      console.error('❌ CRITICAL: VITE_DEEPGRAM_API_KEY is undefined in deepgramSDK!');
      throw new Error('VITE_DEEPGRAM_API_KEY environment variable is required');
    }

    const keyPreview = this.config.apiKey.substring(0, 8) + '...' + this.config.apiKey.substring(this.config.apiKey.length - 4);
    console.log('✅ Deepgram SDK: API key loaded:', keyPreview);
    console.log('   Key length:', this.config.apiKey.length, 'characters');

    // Initialize Deepgram client
    this.deepgram = createClient(this.config.apiKey);

    console.log('✅ Deepgram SDK client created successfully');
    logInfo('deepgramSDK', `Initialized with model: ${this.config.model}`);
  }

  /**
   * Check if Deepgram is configured and available
   */
  isConfigured(): boolean {
    try {
      return !!this.config.apiKey && !!this.deepgram;
    } catch (error) {
      logError('deepgramSDK', `Configuration check failed: ${error}`);
      return false;
    }
  }

  /**
   * Build WebSocket URL for proxy connection
   */
  private buildProxyWebSocketUrl(proxyUrl: string, config: any): string {
    // Create URL with all Deepgram parameters
    const params = new URLSearchParams();

    // Add all configuration parameters
    params.set('model', config.model);
    params.set('language', config.language);
    params.set('encoding', config.encoding);
    params.set('sample_rate', config.sample_rate.toString());
    params.set('channels', config.channels.toString());
    params.set('tier', config.tier);
    params.set('punctuate', config.punctuate.toString());
    params.set('profanity_filter', config.profanity_filter.toString());
    params.set('redact', config.redact.toString());
    params.set('diarize', config.diarize.toString());
    params.set('smart_format', config.smart_format.toString());
    params.set('utterances', config.utterances.toString());
    params.set('endpointing', config.endpointing.toString());
    params.set('interim_results', config.interim_results.toString());
    params.set('vad_events', config.vad_events.toString());

    // Add keywords
    if (config.keywords && Array.isArray(config.keywords)) {
      config.keywords.forEach((keyword: string) => {
        params.append('keywords', keyword);
      });
    }

    return `${proxyUrl}?${params.toString()}`;
  }

  /**
   * Create proxy WebSocket connection that mimics Deepgram SDK connection
   */
  private createProxyConnection(wsUrl: string): any {
    const ws = new WebSocket(wsUrl);
    const eventHandlers: Record<string, Function[]> = {};

    // Create an object that mimics the Deepgram SDK connection interface
    const connection = {
      // Store WebSocket instance
      _ws: ws,

      // on() method to register event handlers
      on(event: string, handler: Function) {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(handler);
      },

      // send() method to send audio data
      send(data: any) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        } else {
          logWarn('deepgramSDK', `Cannot send data - WebSocket not open (state: ${ws.readyState})`);
        }
      },

      // finish() method to close connection
      finish() {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.send(JSON.stringify({ type: 'CloseStream' }));
          ws.close(1000, 'Client finished');
        }
      },

      // getReadyState() method
      getReadyState() {
        return ws.readyState;
      }
    };

    // Set up WebSocket event handlers
    ws.onopen = () => {
      logInfo('deepgramSDK', 'Proxy WebSocket connection opened');
      const handlers = eventHandlers[LiveTranscriptionEvents.Open] || [];
      handlers.forEach(handler => handler());
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle different message types from proxy
        if (data.type === 'open') {
          // Connection opened message
          logInfo('deepgramSDK', 'Deepgram connection established via proxy');
        } else if (data.type === 'error') {
          // Error message
          const handlers = eventHandlers[LiveTranscriptionEvents.Error] || [];
          handlers.forEach(handler => handler(new Error(data.error)));
        } else if (data.type === 'close') {
          // Close message
          const handlers = eventHandlers[LiveTranscriptionEvents.Close] || [];
          handlers.forEach(handler => handler(data));
        } else if (data.type === 'metadata') {
          // Metadata message
          const handlers = eventHandlers[LiveTranscriptionEvents.Metadata] || [];
          handlers.forEach(handler => handler(data.metadata));
        } else {
          // Transcription data
          const handlers = eventHandlers[LiveTranscriptionEvents.Transcript] || [];
          handlers.forEach(handler => handler(data));
        }
      } catch (error) {
        logError('deepgramSDK', `Error parsing proxy message: ${error}`);
      }
    };

    ws.onerror = (error) => {
      logError('deepgramSDK', `Proxy WebSocket error: ${error}`);
      const handlers = eventHandlers[LiveTranscriptionEvents.Error] || [];
      handlers.forEach(handler => handler(error));
    };

    ws.onclose = (event) => {
      logInfo('deepgramSDK', `Proxy WebSocket closed: code=${event.code}, reason=${event.reason}`);
      const handlers = eventHandlers[LiveTranscriptionEvents.Close] || [];
      handlers.forEach(handler => handler(event));
    };

    return connection;
  }

  /**
   * Start transcription (main method)
   */
  async startTranscription(
    mode: 'CONVERSATION' | 'DICTATION',
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void,
    specialty?: string
  ): Promise<void> {
    logInfo('deepgramSDK', `Starting ${mode} transcription with medical model`);

    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;

    try {
      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Configure Deepgram connection
      const liveConfig = {
        model: this.config.model,
        language: this.config.language,
        encoding: this.config.encoding,
        sample_rate: this.config.sampleRate,
        channels: this.config.channels,
        // Medical-specific parameters
        punctuate: true,
        profanity_filter: false, // Medical terms might be flagged
        redact: false, // Keep all medical information
        diarize: mode === 'CONVERSATION', // Enable speaker diarization for conversations
        smart_format: true, // Format numbers, dates, times properly
        utterances: true, // Get utterance-level results
        endpointing: 300, // Wait 300ms for end of speech
        // Custom vocabulary boost for medical terms
        keywords: ['medical:2', 'diagnosis:2', 'prescription:2', 'medication:2', 'symptoms:2', 'treatment:2', 'blood pressure:3', 'diabetes:3', 'insulin:3'],
        // Enhanced medical model settings
        tier: this.config.tier,
        interim_results: true,
        vad_events: true
      };

      // Check if we should use proxy for WebSocket connection
      const useProxyEnv = import.meta.env.VITE_USE_DEEPGRAM_PROXY;
      const proxyUrl = import.meta.env.VITE_DEEPGRAM_PROXY_URL || 'ws://localhost:8080';
      const useProxy = useProxyEnv === 'true';

      console.log('🔍 Deepgram Connection Configuration:', {
        VITE_USE_DEEPGRAM_PROXY: useProxyEnv,
        VITE_DEEPGRAM_PROXY_URL: proxyUrl,
        useProxy: useProxy,
        willUseProxy: useProxy ? 'YES - Using proxy' : 'NO - Direct connection (will fail in browser)'
      });

      if (useProxy) {
        logInfo('deepgramSDK', `Using Deepgram proxy at ${proxyUrl}`);
        console.log(`✅ Connecting via proxy: ${proxyUrl}`);

        // Create WebSocket connection to proxy instead of directly to Deepgram
        // The proxy will handle authentication and forward to Deepgram
        const wsUrl = this.buildProxyWebSocketUrl(proxyUrl, liveConfig);
        console.log(`📡 Proxy WebSocket URL: ${wsUrl.substring(0, 100)}...`);
        this.connection = this.createProxyConnection(wsUrl);
      } else {
        // Direct connection to Deepgram (official SDK)
        logInfo('deepgramSDK', 'Using direct Deepgram SDK connection');
        console.warn('⚠️ WARNING: Using direct connection to Deepgram - this will fail in browsers due to WebSocket auth limitations');
        this.connection = this.deepgram.listen.live(liveConfig);
      }

      // Set up event listeners
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        logInfo('deepgramSDK', 'Deepgram connection opened successfully');
        console.log('✅ Deepgram WebSocket CONNECTED - transcription ready!');
        this.isRecording = true;
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        this.handleTranscriptResult(data, mode);
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error('❌ Deepgram SDK Error Details:', {
          error: error,
          errorType: typeof error,
          errorMessage: error?.message || error,
          errorString: String(error),
          timestamp: new Date().toISOString()
        });

        // Check if it's an authentication error
        if (String(error).includes('401') || String(error).includes('Unauthorized') || String(error).includes('authentication')) {
          console.error('🔑 AUTHENTICATION ERROR - API key may be invalid or not being sent properly');
        }

        logError('deepgramSDK', `Deepgram error: ${error}`);
        this.handleError(new Error(`Deepgram error: ${error.message || error}`));
      });

      this.connection.on(LiveTranscriptionEvents.Close, (closeEvent: any) => {
        console.error('⚠️ Deepgram WebSocket CLOSED:', {
          code: closeEvent?.code,
          reason: closeEvent?.reason || 'No reason provided',
          wasClean: closeEvent?.wasClean,
          timestamp: new Date().toISOString()
        });

        logInfo('deepgramSDK', 'Deepgram connection closed');
        this.isRecording = false;
      });

      // Create MediaRecorder to send audio data
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.connection && this.isRecording) {
          this.connection.send(event.data);
        }
      };

      this.mediaRecorder.onerror = (error) => {
        logError('deepgramSDK', `MediaRecorder error: ${error}`);
        this.handleError(new Error('MediaRecorder error'));
      };

      // Start recording with frequent data chunks for real-time processing
      this.mediaRecorder.start(100);

      logInfo('deepgramSDK', `${mode} transcription started successfully`);

    } catch (error) {
      logError('deepgramSDK', `Failed to start transcription: ${error}`);
      this.handleError(new Error(`Failed to start Deepgram transcription: ${error}`));
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
   * Start recording (simple interface for backward compatibility)
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
    logInfo('deepgramSDK', 'Stopping transcription');

    this.isRecording = false;

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop audio stream
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    // Close Deepgram connection
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }

    // Clear callbacks
    this.onTranscriptCallback = null;
    this.onErrorCallback = null;
    this.mediaRecorder = null;

    logInfo('deepgramSDK', 'Transcription stopped successfully');
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
   * Handle transcript results from Deepgram
   */
  private handleTranscriptResult(data: any, mode: 'CONVERSATION' | 'DICTATION'): void {
    try {
      const transcript = data.channel?.alternatives?.[0];
      if (!transcript || !transcript.transcript.trim()) {
        return;
      }

      const isFinal = data.is_final === true;
      const confidence = transcript.confidence || 0;

      // Extract speaker information for conversations
      let speaker: string | undefined;
      if (mode === 'CONVERSATION' && transcript.words?.[0]?.speaker !== undefined) {
        const speakerNum = transcript.words[0].speaker;
        speaker = speakerNum === 0 ? 'CLINICIAN' : 'PATIENT';
      }

      // Create standardized result
      const result: TranscriptionResult = {
        transcript: transcript.transcript,
        isPartial: !isFinal,
        confidence,
        timestamp: new Date().toISOString(),
        speaker
      };

      // Update current transcript for final results
      if (isFinal) {
        if (speaker) {
          this.currentTranscript += `\n[${speaker}]: ${transcript.transcript}`;
        } else {
          this.currentTranscript += ' ' + transcript.transcript;
        }
        this.currentTranscript = this.currentTranscript.trim();
      }

      // Send result to callback
      if (this.onTranscriptCallback) {
        this.onTranscriptCallback(result);
      }

      logDebug('deepgramSDK',
        `Transcribed: "${transcript.transcript}" (final: ${isFinal}, confidence: ${confidence}, speaker: ${speaker || 'N/A'})`
      );

    } catch (error) {
      logError('deepgramSDK', `Error processing transcript: ${error}`);
      this.handleError(new Error(`Failed to process transcript: ${error}`));
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    logError('deepgramSDK', `Error: ${error.message}`);

    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  /**
   * Test Deepgram connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple API call to verify credentials
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        headers: {
          'Authorization': `Token ${this.config.apiKey}`,
        },
      });

      const isValid = response.ok;

      if (isValid) {
        logInfo('deepgramSDK', 'Connection test successful');
      } else {
        logError('deepgramSDK', `Connection test failed: ${response.status} ${response.statusText}`);
      }

      return isValid;
    } catch (error) {
      logError('deepgramSDK', `Connection test error: ${error}`);
      return false;
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
    model: string;
  } {
    return {
      isRecording: this.isRecording,
      isConfigured: this.isConfigured(),
      currentTranscript: this.currentTranscript,
      provider: 'deepgram-sdk',
      model: this.config.model
    };
  }

  /**
   * Process pre-recorded audio file
   */
  async transcribeAudioFile(audioFile: File): Promise<DeepgramTranscriptResult> {
    try {
      logInfo('deepgramSDK', `Transcribing audio file: ${audioFile.name}`);

      const response = await this.deepgram.listen.prerecorded.transcribeFile(
        audioFile,
        {
          model: this.config.model,
          language: this.config.language,
          punctuate: true,
          profanity_filter: false,
          redact: false,
          diarize: true,
          smart_format: true,
          keywords: ['medical:2', 'diagnosis:2', 'prescription:2', 'medication:2', 'symptoms:2', 'treatment:2']
        }
      );

      const transcript = response.result.channels[0]?.alternatives[0];
      if (!transcript) {
        throw new Error('No transcription result received from Deepgram');
      }

      logInfo('deepgramSDK', `File transcription completed with confidence: ${transcript.confidence}`);

      return {
        transcript: transcript.transcript,
        confidence: transcript.confidence,
        words: transcript.words?.map(word => ({
          word: word.word,
          start: word.start,
          end: word.end,
          confidence: word.confidence,
          speaker: word.speaker
        })) || [],
        is_final: true,
        metadata: {
          duration: response.result.metadata.duration,
          model_version: this.config.model,
          language: this.config.language
        }
      };

    } catch (error) {
      logError('deepgramSDK', `File transcription failed: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const deepgramSDKService = new DeepgramSDKService();