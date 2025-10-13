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
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;

  constructor() {
    logInfo('deepgramAdapter', 'Deepgram adapter initialized');
  }

  /**
   * Check if Deepgram is configured and available
   */
  isConfigured(): boolean {
    try {
      const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
      if (!apiKey) {
        logWarn('deepgramAdapter', 'VITE_DEEPGRAM_API_KEY is not set');
        return false;
      }
      return true;
    } catch (error) {
      logError('deepgramAdapter', `Configuration check failed: ${error}`);
      return false;
    }
  }

  /**
   * Check if browser supports required audio APIs
   */
  private checkBrowserSupport(): { supported: boolean; error?: string } {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        supported: false,
        error: 'Your browser does not support audio recording. Please use Chrome, Firefox, or Safari.'
      };
    }

    if (typeof MediaRecorder === 'undefined') {
      return {
        supported: false,
        error: 'Your browser does not support MediaRecorder API. Please update your browser.'
      };
    }

    return { supported: true };
  }

  /**
   * Check and request microphone permissions
   */
  private async checkMicrophonePermission(): Promise<{ granted: boolean; error?: string }> {
    try {
      // Check if Permissions API is available
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });

          if (permissionStatus.state === 'denied') {
            return {
              granted: false,
              error: 'Microphone access is blocked. Please enable microphone permissions in your browser settings:\n\n' +
                     '1. Click the lock icon in the address bar\n' +
                     '2. Allow microphone access\n' +
                     '3. Refresh the page and try again'
            };
          }
        } catch (e) {
          // Permissions API might not support 'microphone', continue to getUserMedia
          logDebug('deepgramAdapter', 'Permissions API query failed, will try getUserMedia directly');
        }
      }

      return { granted: true };
    } catch (error) {
      logError('deepgramAdapter', `Permission check failed: ${error}`);
      return {
        granted: false,
        error: `Could not check microphone permissions: ${error}`
      };
    }
  }

  /**
   * Get list of available audio input devices
   */
  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      logError('deepgramAdapter', `Failed to enumerate devices: ${error}`);
      return [];
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
      // Step 1: Check Deepgram configuration
      if (!this.isConfigured()) {
        throw new Error(
          'Deepgram is not configured. Please set VITE_DEEPGRAM_API_KEY in your environment variables.\n\n' +
          'Contact your administrator for setup assistance.'
        );
      }

      // Step 2: Check browser support
      const browserCheck = this.checkBrowserSupport();
      if (!browserCheck.supported) {
        throw new Error(browserCheck.error || 'Browser not supported');
      }

      // Step 3: Check microphone permissions
      const permissionCheck = await this.checkMicrophonePermission();
      if (!permissionCheck.granted) {
        throw new Error(permissionCheck.error || 'Microphone permission denied');
      }

      // Step 4: Check if audio devices are available
      const audioDevices = await this.getAudioDevices();
      if (audioDevices.length === 0) {
        throw new Error(
          'No microphone detected. Please:\n\n' +
          '1. Connect a microphone to your computer\n' +
          '2. Check your microphone is not disabled in system settings\n' +
          '3. Try refreshing the page'
        );
      }

      logInfo('deepgramAdapter', `Found ${audioDevices.length} audio input device(s)`);

      // Step 5: Get microphone access
      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        logInfo('deepgramAdapter', 'Microphone access granted');

      } catch (getUserMediaError: any) {
        // Handle specific getUserMedia errors
        let errorMessage = 'Failed to access microphone. ';

        if (getUserMediaError.name === 'NotAllowedError' || getUserMediaError.name === 'PermissionDeniedError') {
          errorMessage += 'Permission denied. Please allow microphone access in your browser:\n\n' +
                         '1. Click the camera/microphone icon in your browser\'s address bar\n' +
                         '2. Select "Always allow" for microphone\n' +
                         '3. Click "Done" and try recording again';
        } else if (getUserMediaError.name === 'NotFoundError' || getUserMediaError.name === 'DevicesNotFoundError') {
          errorMessage += 'No microphone found. Please connect a microphone and try again.';
        } else if (getUserMediaError.name === 'NotReadableError' || getUserMediaError.name === 'TrackStartError') {
          errorMessage += 'Microphone is already in use by another application. Please:\n\n' +
                         '1. Close other apps using the microphone\n' +
                         '2. Refresh this page\n' +
                         '3. Try again';
        } else if (getUserMediaError.name === 'OverconstrainedError' || getUserMediaError.name === 'ConstraintNotSatisfiedError') {
          errorMessage += 'Your microphone doesn\'t support the required audio settings.';
        } else {
          errorMessage += `${getUserMediaError.message || getUserMediaError.name || 'Unknown error'}`;
        }

        logError('deepgramAdapter', errorMessage);
        throw new Error(errorMessage);
      }

      // Step 6: Set up audio analysis for volume monitoring
      try {
        this.audioContext = new AudioContext();
        const audioSource = this.audioContext.createMediaStreamSource(this.audioStream);
        this.audioAnalyser = this.audioContext.createAnalyser();
        this.audioAnalyser.fftSize = 256;
        audioSource.connect(this.audioAnalyser);

        // Check if microphone is actually producing audio
        const checkAudioLevel = () => {
          if (!this.audioAnalyser) return;

          const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
          this.audioAnalyser.getByteFrequencyData(dataArray);

          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

          if (average < 1) {
            logWarn('deepgramAdapter', 'Warning: Very low or no audio detected from microphone');
          }
        };

        // Check audio level after 2 seconds
        setTimeout(checkAudioLevel, 2000);

      } catch (audioContextError) {
        // Non-critical - continue without audio analysis
        logWarn('deepgramAdapter', `Could not set up audio analysis: ${audioContextError}`);
      }

      // Step 7: Start Deepgram real-time transcription
      try {
        await deepgramService.startRealTimeTranscription(
          this.handleDeepgramResult.bind(this),
          this.handleDeepgramError.bind(this)
        );

        logInfo('deepgramAdapter', 'Deepgram connection established');

      } catch (deepgramError) {
        throw new Error(
          `Failed to connect to Deepgram service: ${deepgramError}\n\n` +
          'Please check:\n' +
          '1. Your internet connection\n' +
          '2. Deepgram API key is valid\n' +
          '3. Contact support if the issue persists'
        );
      }

      // Step 8: Create MediaRecorder to send audio data to Deepgram
      try {
        this.mediaRecorder = new MediaRecorder(this.audioStream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            deepgramService.sendAudioData(event.data);
          }
        };

        this.mediaRecorder.onerror = (event: any) => {
          logError('deepgramAdapter', `MediaRecorder error: ${event.error}`);
          onError(new Error(`Recording failed: ${event.error}`));
        };

        this.mediaRecorder.start(100); // Send audio chunks every 100ms
        this.isRecording = true;

        logInfo('deepgramAdapter', `${mode} transcription started successfully`);

      } catch (recorderError) {
        throw new Error(`Failed to start audio recording: ${recorderError}`);
      }

    } catch (error) {
      // Clean up if anything fails
      this.cleanup();

      const errorMessage = error instanceof Error ? error.message : String(error);
      logError('deepgramAdapter', `Failed to start transcription: ${errorMessage}`);
      onError(new Error(errorMessage));
      throw error; // Re-throw so caller knows it failed
    }
  }

  /**
   * Clean up all resources
   */
  private cleanup(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        logWarn('deepgramAdapter', `Error stopping media recorder: ${e}`);
      }
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          logWarn('deepgramAdapter', `Error stopping audio track: ${e}`);
        }
      });
      this.audioStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {
        logWarn('deepgramAdapter', `Error closing audio context: ${e}`);
      }
      this.audioContext = null;
    }

    this.audioAnalyser = null;
    this.mediaRecorder = null;
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

    // Clean up all audio resources
    this.cleanup();

    // Stop Deepgram service
    try {
      deepgramService.stopRealTimeTranscription();
    } catch (error) {
      logWarn('deepgramAdapter', `Error stopping Deepgram service: ${error}`);
    }

    this.onTranscriptCallback = null;
    this.onErrorCallback = null;

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
   * Get current audio level (0-255)
   */
  getAudioLevel(): number {
    if (!this.audioAnalyser || !this.isRecording) {
      return 0;
    }

    try {
      const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
      this.audioAnalyser.getByteFrequencyData(dataArray);

      // Calculate average audio level
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      return Math.round(average);
    } catch (error) {
      logWarn('deepgramAdapter', `Error getting audio level: ${error}`);
      return 0;
    }
  }

  /**
   * Test microphone without starting full transcription
   */
  async testMicrophone(): Promise<{
    success: boolean;
    deviceInfo?: MediaDeviceInfo;
    audioLevel?: number;
    error?: string;
  }> {
    let testStream: MediaStream | null = null;
    let testAudioContext: AudioContext | null = null;
    let testAnalyser: AnalyserNode | null = null;

    try {
      // Check browser support
      const browserCheck = this.checkBrowserSupport();
      if (!browserCheck.supported) {
        return {
          success: false,
          error: browserCheck.error
        };
      }

      // Check permissions
      const permissionCheck = await this.checkMicrophonePermission();
      if (!permissionCheck.granted) {
        return {
          success: false,
          error: permissionCheck.error
        };
      }

      // Check devices
      const devices = await this.getAudioDevices();
      if (devices.length === 0) {
        return {
          success: false,
          error: 'No microphone detected'
        };
      }

      // Get microphone stream
      testStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Set up audio analysis
      testAudioContext = new AudioContext();
      const audioSource = testAudioContext.createMediaStreamSource(testStream);
      testAnalyser = testAudioContext.createAnalyser();
      testAnalyser.fftSize = 256;
      audioSource.connect(testAnalyser);

      // Get audio level
      const dataArray = new Uint8Array(testAnalyser.frequencyBinCount);
      testAnalyser.getByteFrequencyData(dataArray);
      const audioLevel = Math.round(dataArray.reduce((a, b) => a + b) / dataArray.length);

      // Get device info
      const activeTrack = testStream.getAudioTracks()[0];
      const deviceLabel = activeTrack.label || 'Unknown Device';
      const deviceInfo = devices.find(d => d.label === deviceLabel) || devices[0];

      logInfo('deepgramAdapter', `Microphone test successful: ${deviceLabel}, level: ${audioLevel}`);

      return {
        success: true,
        deviceInfo: {
          deviceId: deviceInfo.deviceId,
          groupId: deviceInfo.groupId,
          kind: deviceInfo.kind,
          label: deviceLabel,
          toJSON: deviceInfo.toJSON
        },
        audioLevel
      };

    } catch (error: any) {
      logError('deepgramAdapter', `Microphone test failed: ${error}`);

      let errorMessage = 'Microphone test failed. ';

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Permission denied. Please allow microphone access.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Microphone is already in use.';
      } else {
        errorMessage += error.message || 'Unknown error';
      }

      return {
        success: false,
        error: errorMessage
      };

    } finally {
      // Clean up test resources
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop());
      }
      if (testAudioContext && testAudioContext.state !== 'closed') {
        testAudioContext.close();
      }
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
    audioLevel?: number;
  } {
    return {
      isRecording: this.isRecording,
      isConfigured: this.isConfigured(),
      currentTranscript: this.currentTranscript,
      provider: 'deepgram',
      audioLevel: this.getAudioLevel()
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