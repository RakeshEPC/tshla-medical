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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private lastRecordingMode: 'CONVERSATION' | 'DICTATION' | null = null;
  private lastSpecialty: string | undefined;

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
    // Only add tier if it's defined
    if (config.tier !== undefined && config.tier !== null) {
      params.set('tier', config.tier);
    }
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
    // DEBUG: Log WebSocket creation
    console.log('🔌 Creating WebSocket connection to:', wsUrl.substring(0, 150));

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
      console.log('✅ WebSocket onopen fired! ReadyState:', ws.readyState);
      // DO NOT call Open handlers here - wait for {type: 'open'} message from backend
      // The backend will send {type: 'open'} when Deepgram is actually ready
      console.log('   Waiting for backend to send {type: "open"} message...');
    };

    ws.onmessage = async (event) => {
      try {
        // Handle both string and Blob data
        let messageText: string;

        if (typeof event.data === 'string') {
          // Already a string
          messageText = event.data;
        } else if (event.data instanceof Blob) {
          // Convert Blob to text
          messageText = await event.data.text();
        } else {
          logError('deepgramSDK', `Unknown WebSocket data type: ${typeof event.data}`);
          return;
        }

        const data = JSON.parse(messageText);

        // DEBUG: Enhanced logging to diagnose "No Audio Captured" issue
        console.log('📨 Received from Deepgram:', {
          type: data.type,
          hasTranscript: !!data.channel?.alternatives?.[0]?.transcript,
          transcriptLength: data.channel?.alternatives?.[0]?.transcript?.length || 0,
          isFinal: data.is_final,
          speechFinal: data.speech_final,
          // Log first 100 chars of full response to see structure
          fullDataPreview: JSON.stringify(data).substring(0, 200)
        });

        // CRITICAL: Log the actual transcript content if present
        if (data.channel?.alternatives?.[0]?.transcript) {
          console.log('✅ TRANSCRIPT RECEIVED:', {
            text: data.channel.alternatives[0].transcript,
            confidence: data.channel.alternatives[0].confidence,
            isFinal: data.is_final
          });
        } else {
          console.warn('⚠️ NO TRANSCRIPT in message:', JSON.stringify(data));
        }

        // Handle different message types from proxy
        if (data.type === 'open') {
          // Connection opened message - NOW call the Open event handlers!
          logInfo('deepgramSDK', 'Deepgram connection established via proxy');
          console.log('🎉 Backend sent {type: "open"} - calling LiveTranscriptionEvents.Open handlers now!');
          const handlers = eventHandlers[LiveTranscriptionEvents.Open] || [];
          handlers.forEach(handler => handler());
        } else if (data.type === 'error') {
          // Error message
          console.error('❌ Deepgram error message:', data);
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
          console.log('🎙️ Processing transcript, handlers:', eventHandlers[LiveTranscriptionEvents.Transcript]?.length || 0);
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

    // Store for reconnection attempts
    this.lastRecordingMode = mode;
    this.lastSpecialty = specialty;
    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;

    // Clear any pending reconnection attempts
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

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

      // Create AudioContext FIRST to get the actual browser sample rate
      // Browsers often ignore the requested sample rate and use their native rate (44100 or 48000)
      const audioContext = new AudioContext();
      const actualSampleRate = audioContext.sampleRate;

      logInfo('deepgramSDK', `Browser AudioContext sample rate: ${actualSampleRate}Hz`);
      console.log(`🎤 Audio context sample rate: ${actualSampleRate}Hz`);

      // Configure Deepgram connection with ACTUAL sample rate
      const liveConfig = {
        model: this.config.model,
        language: this.config.language,
        encoding: this.config.encoding,
        sample_rate: actualSampleRate, // Use browser's actual sample rate!
        channels: this.config.channels,
        // Medical-specific parameters
        punctuate: true,
        profanity_filter: false, // Medical terms might be flagged
        redact: false, // Keep all medical information
        diarize: mode === 'CONVERSATION', // Enable speaker diarization for conversations
        smart_format: true, // Format numbers, dates, times properly
        utterances: true, // Get utterance-level results
        endpointing: 300, // Wait 300ms for end of speech
        // Custom vocabulary boost for medical terms (format: 'term:boost_level' where boost 1-4)
        // Focus on commonly misheard terms - nova-2-medical model already handles most medical vocab
        keywords: [
          // Common vital signs and measurements
          'blood pressure:3', 'BP:3', 'heart rate:3', 'respiratory rate:3', 'oxygen saturation:3', 'O2 sat:3', 'temperature:3',
          // Top misheard medications
          'lisinopril:3', 'metformin:3', 'atorvastatin:3', 'metoprolol:3', 'amlodipine:3', 'omeprazole:3',
          'gabapentin:3', 'hydrochlorothiazide:3', 'sertraline:3', 'levothyroxine:3',
          // Common insulin names
          'insulin:3', 'Lantus:3', 'NovoLog:3', 'Humalog:3', 'glargine:3', 'lispro:3',
          // Common conditions
          'diabetes:3', 'diabetes mellitus:3', 'hypertension:3', 'hyperlipidemia:3', 'COPD:3', 'CHF:3', 'atrial fibrillation:3',
          // Common lab tests
          'A1C:3', 'hemoglobin A1C:3', 'HbA1c:3', 'CMP:2', 'CBC:2', 'TSH:2', 'LDL:2', 'HDL:2',
          // Physical exam phrases
          'no acute distress:2', 'alert and oriented:2', 'clear to auscultation:2', 'regular rate and rhythm:2',
          // Medical document types
          'diagnosis:2', 'prescription:2', 'medication:2', 'symptoms:2', 'treatment:2', 'assessment:2', 'plan:2'
        ],
        // Note: tier parameter removed - Deepgram determines tier based on model and API key
        interim_results: true,
        vad_events: true
      };

      // ALWAYS use proxy for browser WebSocket connections
      // Browsers cannot send Authorization headers on WebSocket connections
      const proxyUrl = import.meta.env.VITE_DEEPGRAM_PROXY_URL || 'ws://localhost:8080';
      const useProxy = true; // Always true for browser environment

      // DEBUG: Log proxy URL resolution
      console.log('🔍 DEEPGRAM PROXY DEBUG:');
      console.log('  Environment variable VITE_DEEPGRAM_PROXY_URL:', import.meta.env.VITE_DEEPGRAM_PROXY_URL);
      console.log('  Resolved proxy URL:', proxyUrl);
      console.log('  Using proxy:', useProxy);

      logInfo('deepgramSDK', `Connecting via proxy: ${proxyUrl}`);

      // Validate proxy is accessible before attempting WebSocket connection
      // Note: CORS errors on health check don't prevent WebSocket connections from working
      try {
        const healthUrl = proxyUrl.replace('ws://', 'http://').replace('wss://', 'https://') + '/health';
        logDebug('deepgramSDK', `Checking proxy health: ${healthUrl}`);

        const healthCheck = await fetch(healthUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        }).catch(err => {
          // CORS errors are expected for cross-origin requests
          // WebSocket connections work independently of HTTP CORS
          logWarn('deepgramSDK', `Proxy health check failed (expected for CORS): ${err.message}`);
          return null;
        });

        if (healthCheck && healthCheck.ok) {
          logInfo('deepgramSDK', 'Proxy is healthy and accessible');
        } else {
          // Log warning but don't throw - WebSocket will fail on its own if proxy is down
          logWarn('deepgramSDK', 'Proxy health check did not succeed, will attempt WebSocket connection anyway');
        }
      } catch (error) {
        // Log warning but don't block WebSocket attempt
        const errorMsg = error instanceof Error ? error.message : String(error);
        logWarn('deepgramSDK', `Proxy health check error: ${errorMsg} (will attempt WebSocket anyway)`);
      }

      // Create WebSocket connection to proxy
      const wsUrl = this.buildProxyWebSocketUrl(proxyUrl, liveConfig);

      // DEBUG: Log full WebSocket URL
      console.log('  Built WebSocket URL:', wsUrl);
      console.log('  First 100 chars of URL:', wsUrl.substring(0, 100));

      logDebug('deepgramSDK', `Connecting to proxy WebSocket`);
      this.connection = this.createProxyConnection(wsUrl);

      // Set up event listeners
      console.log('📝 Registering LiveTranscriptionEvents.Open handler...');
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        logInfo('deepgramSDK', 'Deepgram connection opened successfully');
        console.log('🎉 LiveTranscriptionEvents.Open handler called! Setting isRecording = true');
        console.log('🔍 DIAGNOSTIC: Connection state when Open fired:', {
          connectionReadyState: this.connection?.getReadyState(),
          audioStreamActive: !!this.audioStream,
          audioStreamTracks: this.audioStream?.getTracks().length || 0,
          timestamp: new Date().toISOString()
        });
        this.isRecording = true;
        this.reconnectAttempts = 0; // Reset reconnect counter on successful connection
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
          timestamp: new Date().toISOString(),
          // Add URL info if available
          connectionURL: this.connection?._ws?.url || 'unknown'
        });

        // Check if it's an authentication error
        if (String(error).includes('401') || String(error).includes('Unauthorized') || String(error).includes('authentication')) {
          console.error('🔑 AUTHENTICATION ERROR - API key may be invalid or not being sent properly');
        }

        logError('deepgramSDK', `Deepgram error: ${error}`);
        this.handleError(new Error(`Deepgram error: ${error.message || error}`));
      });

      this.connection.on(LiveTranscriptionEvents.Close, (closeEvent: any) => {
        const wasClean = closeEvent?.wasClean !== false;
        console.log('🚨 CLOSE EVENT DETAILS:', {
          code: closeEvent?.code,
          reason: closeEvent?.reason,
          wasClean,
          type: closeEvent?.type,
          timestamp: new Date().toISOString()
        });
        logInfo('deepgramSDK', `Deepgram connection closed (code: ${closeEvent?.code}, clean: ${wasClean})`);

        this.isRecording = false;

        // TEMPORARY: Disable auto-reconnect to stop the alert loop
        console.warn('⚠️ AUTO-RECONNECT DISABLED FOR DEBUGGING');
        return;

        // Attempt automatic reconnection if it was not a clean close
        // and we haven't exceeded max attempts
        if (!wasClean && this.reconnectAttempts < this.maxReconnectAttempts && this.lastRecordingMode) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000); // Exponential backoff, max 5s

          logWarn('deepgramSDK', `Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

          this.reconnectTimeoutId = setTimeout(() => {
            if (this.onTranscriptCallback && this.onErrorCallback && this.lastRecordingMode) {
              logInfo('deepgramSDK', 'Reconnecting to Deepgram...');
              this.startTranscription(
                this.lastRecordingMode,
                this.onTranscriptCallback,
                this.onErrorCallback,
                this.lastSpecialty
              ).catch(err => {
                logError('deepgramSDK', `Reconnection failed: ${err.message}`);
                if (this.onErrorCallback) {
                  this.onErrorCallback(new Error(`Reconnection failed: ${err.message}`));
                }
              });
            }
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logError('deepgramSDK', 'Max reconnection attempts reached');
          if (this.onErrorCallback) {
            this.onErrorCallback(new Error('Connection lost. Please refresh and try again.'));
          }
        }
      });

      // CRITICAL: Wait for WebSocket to be fully OPEN before processing audio
      // This prevents the race condition where audio starts processing before WebSocket is ready
      console.log('⏳ Waiting for WebSocket to be fully OPEN before starting audio processing...');

      // Poll WebSocket state until it's OPEN (max 5 seconds)
      const wsOpenTimeout = 5000;
      const wsOpenStart = Date.now();
      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const readyState = this.connection.getReadyState();
          console.log(`   WebSocket state: ${readyState} (${['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][readyState]})`);

          if (readyState === 1) { // OPEN
            clearInterval(checkInterval);
            console.log('✅ WebSocket is OPEN! Starting audio processing...');
            resolve();
          } else if (Date.now() - wsOpenStart > wsOpenTimeout) {
            clearInterval(checkInterval);
            reject(new Error(`WebSocket did not open within ${wsOpenTimeout}ms (state: ${readyState})`));
          }
        }, 100); // Check every 100ms
      });

      // Use AudioContext to capture raw PCM audio instead of MediaRecorder
      // Deepgram WebSocket API expects raw audio, not WebM container
      // AudioContext already created above to get actual sample rate
      const source = audioContext.createMediaStreamSource(this.audioStream);

      // Use ScriptProcessorNode to capture raw PCM audio
      // Note: This is deprecated but still widely supported. AudioWorklet is preferred but more complex.
      const processorBufferSize = 4096;
      const processor = audioContext.createScriptProcessor(processorBufferSize, 1, 1);

      let audioChunksSent = 0;
      let audioProcessWarningCount = 0;
      processor.onaudioprocess = (e) => {
        // DIAGNOSTIC: Log state every 50 audio process calls if not recording
        if (!this.isRecording || !this.connection) {
          audioProcessWarningCount++;
          if (audioProcessWarningCount === 1 || audioProcessWarningCount % 50 === 0) {
            console.warn('⏸️ DIAGNOSTIC: Audio processing but not ready to send', {
              isRecording: this.isRecording,
              hasConnection: !!this.connection,
              connectionState: this.connection ? this.connection.getReadyState() : 'no connection',
              warningCount: audioProcessWarningCount,
              timestamp: new Date().toISOString()
            });
          }
          return;
        }

        // Get raw PCM data
        const inputData = e.inputBuffer.getChannelData(0);

        // DIAGNOSTIC: Calculate audio level to verify microphone is capturing audio
        let sum = 0;
        let maxSample = 0;
        for (let i = 0; i < inputData.length; i++) {
          const absValue = Math.abs(inputData[i]);
          sum += absValue;
          if (absValue > maxSample) maxSample = absValue;
        }
        const avgLevel = sum / inputData.length;
        const audioLevelPercent = Math.floor(maxSample * 100);

        // Log audio level periodically to verify capture
        if (audioChunksSent === 0 || audioChunksSent % 50 === 0) {
          console.log(`🔊 Audio level check: max=${maxSample.toFixed(4)}, avg=${avgLevel.toFixed(4)}, percent=${audioLevelPercent}%`);

          if (maxSample < 0.001 && audioChunksSent > 10) {
            console.warn('⚠️ VERY LOW AUDIO LEVEL - Microphone may not be working or volume too low!');
          }
        }

        // Convert float32 PCM to int16 PCM (required by Deepgram)
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp to [-1, 1] and convert to int16 range
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // DIAGNOSTIC: Log first audio chunk data to verify format
        if (audioChunksSent === 0) {
          console.log('🎵 First audio chunk details:', {
            bufferSize: int16Data.length,
            sampleFormat: 'int16',
            firstSamples: Array.from(int16Data.slice(0, 10)),
            maxValue: Math.max(...Array.from(int16Data)),
            minValue: Math.min(...Array.from(int16Data))
          });
        }

        // Send raw PCM data to Deepgram
        const wsReadyState = this.connection.getReadyState();
        if (wsReadyState === 1) {
          this.connection.send(int16Data.buffer);
          audioChunksSent++;
          if (audioChunksSent === 1 || audioChunksSent % 100 === 0) {
            console.log(`🎤 ✅ Sent audio chunk #${audioChunksSent} (${int16Data.length} samples, level=${audioLevelPercent}%, wsState=${wsReadyState})`);
          }
        } else {
          console.error(`⚠️ DIAGNOSTIC: Cannot send audio - WebSocket not OPEN!`, {
            readyState: wsReadyState,
            readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsReadyState] || 'UNKNOWN',
            audioChunksSent,
            isRecording: this.isRecording,
            timestamp: new Date().toISOString()
          });
        }
      };

      // Connect audio graph
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Store processor for cleanup
      (this as any).audioProcessor = processor;
      (this as any).audioContext = audioContext;

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

    // Clear any pending reconnection attempts
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    // Reset reconnection state
    this.reconnectAttempts = 0;
    this.lastRecordingMode = null;
    this.lastSpecialty = undefined;

    // Stop MediaRecorder (if using old method)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop audio processor (if using AudioContext)
    const audioProcessor = (this as any).audioProcessor;
    const audioContext = (this as any).audioContext;
    if (audioProcessor) {
      audioProcessor.disconnect();
      (this as any).audioProcessor = null;
    }
    if (audioContext) {
      audioContext.close();
      (this as any).audioContext = null;
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
   * Test microphone access and audio levels
   */
  async testMicrophone(): Promise<{
    success: boolean;
    error?: string;
    deviceInfo?: MediaDeviceInfo;
    audioLevel?: number;
  }> {
    let testStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let processor: ScriptProcessorNode | null = null;

    try {
      logInfo('deepgramSDK', 'Testing microphone access...');

      // Request microphone access
      testStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Get device information
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const currentDevice = audioInputs.find(device =>
        testStream?.getAudioTracks()[0].label === device.label
      ) || audioInputs[0];

      logInfo('deepgramSDK', `Microphone detected: ${currentDevice?.label || 'Unknown'}`);

      // Create audio context to measure audio levels
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(testStream);
      processor = audioContext.createScriptProcessor(2048, 1, 1);

      let maxAudioLevel = 0;
      let measurementsDone = false;

      // Return a promise that resolves after measuring audio for 2 seconds
      const result = await new Promise<{
        success: boolean;
        error?: string;
        deviceInfo?: MediaDeviceInfo;
        audioLevel?: number;
      }>((resolve) => {
        processor!.onaudioprocess = (e) => {
          if (measurementsDone) return;

          const inputData = e.inputBuffer.getChannelData(0);

          // Calculate RMS (Root Mean Square) for audio level
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          const audioLevel = Math.floor(rms * 255); // Convert to 0-255 scale

          // Track maximum audio level
          if (audioLevel > maxAudioLevel) {
            maxAudioLevel = audioLevel;
          }
        };

        // Connect audio graph
        source.connect(processor!);
        processor!.connect(audioContext!.destination);

        // Measure for 2 seconds
        setTimeout(() => {
          measurementsDone = true;

          logInfo('deepgramSDK', `Microphone test complete. Max audio level: ${maxAudioLevel}/255`);

          resolve({
            success: true,
            deviceInfo: currentDevice,
            audioLevel: maxAudioLevel
          });
        }, 2000);
      });

      return result;

    } catch (error: any) {
      logError('deepgramSDK', `Microphone test failed: ${error.message}`);

      let errorMessage = 'Unknown error occurred';

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone device found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application. Please close other apps and try again.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Could not satisfy microphone constraints. Please try a different microphone.';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Security error accessing microphone. Please ensure you are using HTTPS or localhost.';
      } else {
        errorMessage = error.message || String(error);
      }

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      // Cleanup
      if (processor) {
        processor.disconnect();
      }
      if (audioContext) {
        audioContext.close();
      }
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop());
      }
    }
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
          keywords: [
            // Same enhanced keywords as live transcription
            'blood pressure:3', 'BP:3', 'heart rate:3', 'respiratory rate:3', 'oxygen saturation:3', 'O2 sat:3', 'temperature:3',
            'lisinopril:3', 'metformin:3', 'atorvastatin:3', 'metoprolol:3', 'amlodipine:3', 'omeprazole:3',
            'gabapentin:3', 'hydrochlorothiazide:3', 'sertraline:3', 'levothyroxine:3',
            'insulin:3', 'Lantus:3', 'NovoLog:3', 'Humalog:3', 'glargine:3', 'lispro:3',
            'diabetes:3', 'diabetes mellitus:3', 'hypertension:3', 'hyperlipidemia:3', 'COPD:3', 'CHF:3', 'atrial fibrillation:3',
            'A1C:3', 'hemoglobin A1C:3', 'HbA1c:3', 'CMP:2', 'CBC:2', 'TSH:2', 'LDL:2', 'HDL:2',
            'no acute distress:2', 'alert and oriented:2', 'clear to auscultation:2', 'regular rate and rhythm:2',
            'diagnosis:2', 'prescription:2', 'medication:2', 'symptoms:2', 'treatment:2', 'assessment:2', 'plan:2'
          ]
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