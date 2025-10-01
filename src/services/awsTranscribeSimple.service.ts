/**
 * AWS Transcribe Medical - Simplified Working Implementation
 * Uses Web Audio API for proper PCM conversion
 */

import { 
  TranscribeStreamingClient, 
  StartMedicalStreamTranscriptionCommand 
} from '@aws-sdk/client-transcribe-streaming';
import { medicalVocabularyEnhancer } from './medicalVocabularyEnhancer.service';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export class AWSTranscribeSimpleService {
  private client: TranscribeStreamingClient | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private audioQueue: Float32Array[] = [];
  private isRecording = false;
  private currentTranscript = '';
  
  constructor() {
    this.initializeClient();
  }
  
  private initializeClient() {
    try {
      // HIPAA Compliance: Use environment variables for AWS credentials
      const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
      const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
      
      if (!accessKeyId || !secretAccessKey) {
        throw new Error('AWS credentials not configured. Please set VITE_AWS_ACCESS_KEY_ID and VITE_AWS_SECRET_ACCESS_KEY in environment variables.');
      }
      
      this.client = new TranscribeStreamingClient({
        region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
      logInfo('awsTranscribeSimple', 'Info message', {});
    } catch (error) {
      logError('awsTranscribeSimple', 'Error message', {});
    }
  }
  
  async startRecording(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ): Promise<boolean> {
    if (!this.client) {
      onError('AWS client not initialized');
      return false;
    }
    
    try {
      logDebug('awsTranscribeSimple', 'Debug message', {});
      
      // Get microphone access with OPTIMAL settings for medical dictation
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,  // Turn OFF for clearer medical terms
          noiseSuppression: false,  // Turn OFF to preserve 's' sounds in medical words
          autoGainControl: false,   // Turn OFF for consistent volume
          sampleSize: 16,
          latency: 0  // Lowest latency for real-time
        } 
      });
      
      logInfo('awsTranscribeSimple', 'Info message', {});
      
      // Set up Web Audio API for PCM conversion
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      // Clear transcript
      this.currentTranscript = '';
      this.audioQueue = [];
      this.isRecording = true;
      
      // Process audio data
      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Store Float32Array data for later conversion
        this.audioQueue.push(new Float32Array(inputData));
      };
      
      // Connect audio nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      // Create audio stream generator for AWS
      const self = this;
      async function* audioStreamGenerator() {
        logDebug('awsTranscribeSimple', 'Debug message', {});
        
        while (self.isRecording || self.audioQueue.length > 0) {
          if (self.audioQueue.length > 0) {
            const floatData = self.audioQueue.shift()!;
            
            // Convert Float32Array to PCM16 (Int16Array)
            const pcm16 = new Int16Array(floatData.length);
            for (let i = 0; i < floatData.length; i++) {
              const s = Math.max(-1, Math.min(1, floatData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Convert to Uint8Array for AWS
            const uint8Array = new Uint8Array(pcm16.buffer);
            
            yield {
              AudioEvent: {
                AudioChunk: uint8Array
              }
            };
          } else {
            // Wait for more audio data
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
        
        logDebug('awsTranscribeSimple', 'Debug message', {});
      }
      
      logDebug('awsTranscribeSimple', 'Debug message', {});
      
      // Start AWS Transcribe stream
      const command = new StartMedicalStreamTranscriptionCommand({
        LanguageCode: 'en-US',
        MediaSampleRateHertz: 16000,
        MediaEncoding: 'pcm',
        Specialty: 'PRIMARYCARE',
        Type: 'DICTATION',  // CRITICAL: Keep as DICTATION for best quality
        ShowSpeakerLabels: false,
        ContentIdentificationType: 'PHI',
        EnablePartialResultsStabilization: true,  // Better interim results
        PartialResultsStability: 'high',  // More stable partial transcripts
        VocabularyName: undefined,  // Can add custom medical vocabulary later
        AudioStream: audioStreamGenerator()
      });
      
      // Send command and process results
      const response = await this.client.send(command);
      
      logInfo('awsTranscribeSimple', 'Info message', {});
      
      if (response.TranscriptResultStream) {
        // Process results in background
        this.processTranscriptStream(response.TranscriptResultStream, onTranscript, onError);
      } else {
        throw new Error('No TranscriptResultStream received');
      }
      
      logInfo('awsTranscribeSimple', 'Info message', {});
      return true;
      
    } catch (error: any) {
      logError('awsTranscribeSimple', 'Error message', {});
      logError('awsTranscribeSimple', 'Error message', {});
      logError('awsTranscribeSimple', 'Error message', {});
      logError('awsTranscribeSimple', 'Error message', {});
      
      // Provide more specific error messages
      let errorMessage = 'AWS Transcribe Medical error: ';
      
      if (error.name === 'UnrecognizedClientException' || error.name === 'InvalidSignatureException') {
        errorMessage += 'Invalid AWS credentials. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.';
      } else if (error.name === 'AccessDeniedException') {
        errorMessage += 'Access denied. Your AWS credentials don\'t have permission for Transcribe Medical.';
      } else if (error.name === 'NetworkingError' || error.message?.includes('Network')) {
        errorMessage += 'Network error. Please check your internet connection and CORS settings.';
      } else if (error.$metadata?.httpStatusCode === 403) {
        errorMessage += 'Permission denied. Ensure your AWS IAM user has TranscribeStreaming permissions.';
      } else {
        errorMessage += error.message || 'Failed to start recording';
      }
      
      onError(errorMessage);
      this.cleanup();
      return false;
    }
  }
  
  private async processTranscriptStream(
    stream: any,
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ) {
    try {
      logDebug('awsTranscribeSimple', 'Debug message', {});
      let eventCount = 0;
      
      for await (const event of stream) {
        eventCount++;
        
        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript?.Results || [];
          
          for (const result of results) {
            if (result.Alternatives && result.Alternatives.length > 0) {
              const transcript = result.Alternatives[0].Transcript || '';
              
              if (transcript) {
                if (!result.IsPartial) {
                  // Final result - enhance with medical vocabulary
                  const enhanced = medicalVocabularyEnhancer.enhanceTranscript(transcript);
                  this.currentTranscript += enhanced + ' ';
                  
                  // Quality monitoring
                  const density = medicalVocabularyEnhancer.getMedicalTermDensity(enhanced);
                  logInfo('awsTranscribeSimple', 'Info message', {});
                  logDebug('awsTranscribeSimple', 'Debug message', {});
                  
                  onTranscript(enhanced, true);
                } else {
                  // Partial result - also enhance for better display
                  const enhanced = medicalVocabularyEnhancer.enhanceTranscript(transcript);
                  logDebug('awsTranscribeSimple', 'Debug message', {});
                  onTranscript(enhanced, false);
                }
              }
            }
          }
        }
        
        // Check for errors
        if (event.BadRequestException) {
          logError('awsTranscribeSimple', 'Error message', {});
          onError(`Bad request: ${event.BadRequestException.Message}`);
        }
        if (event.LimitExceededException) {
          logError('awsTranscribeSimple', 'Error message', {});
          onError(`Limit exceeded: ${event.LimitExceededException.Message}`);
        }
        if (event.InternalFailureException) {
          logError('awsTranscribeSimple', 'Error message', {});
          onError(`Internal failure: ${event.InternalFailureException.Message}`);
        }
      }
      
      logDebug('awsTranscribeSimple', 'Debug message', {});
      
    } catch (error: any) {
      logError('awsTranscribeSimple', 'Error message', {});
      onError(error.message || 'Stream processing error');
    }
  }
  
  stopRecording(): string {
    logDebug('awsTranscribeSimple', 'Debug message', {});
    this.isRecording = false;
    
    // Clean up audio resources
    this.cleanup();
    
    logInfo('awsTranscribeSimple', 'Info message', {});
    return this.currentTranscript;
  }
  
  private cleanup() {
    // Disconnect audio nodes
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Clear audio queue
    this.audioQueue = [];
  }
  
  isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * Check if AWS client is configured (interface compatibility)
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Stop all AWS operations (interface compatibility)
   */
  stop(): void {
    this.stopRecording();
  }
  
  getCurrentTranscript(): string {
    return this.currentTranscript;
  }
}

// Singleton instance
export const awsTranscribeSimple = new AWSTranscribeSimpleService();