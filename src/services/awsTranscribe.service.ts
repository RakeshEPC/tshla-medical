/**
 * AWS Transcribe Medical Service for HIPAA-compliant speech recognition
 * Supports both dictation and conversation modes with speaker diarization
 */

import {
  TranscribeStreamingClient,
  StartMedicalStreamTranscriptionCommand,
  MedicalContentIdentificationType,
  MedicalTranscriptResultStream
} from '@aws-sdk/client-transcribe-streaming';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

export type TranscriptionMode = 'DICTATION' | 'CONVERSATION';
export type MedicalSpecialty = 'PRIMARYCARE' | 'CARDIOLOGY' | 'NEUROLOGY' | 'ONCOLOGY' | 'RADIOLOGY' | 'UROLOGY';

interface TranscriptionConfig {
  mode: TranscriptionMode;
  specialty: MedicalSpecialty;
  enableSpeakerDiarization: boolean;
  maxSpeakers?: number;
  vocabularyName?: string;
}

export interface TranscriptionResult {
  transcript: string;
  isPartial: boolean;
  speaker?: string;
  confidence?: number;
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>;
}

class AWSTranscribeService {
  private client: TranscribeStreamingClient;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isRecording = false;
  private onTranscript: ((result: TranscriptionResult) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private currentConfig: TranscriptionConfig = {
    mode: 'DICTATION',
    specialty: 'PRIMARYCARE',
    enableSpeakerDiarization: false
  };

  constructor() {
    // Initialize AWS Transcribe client
    const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
    const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
    const region = import.meta.env.VITE_AWS_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      logWarn('awsTranscribe', 'Warning message', {});
      // Create a dummy client that will fail gracefully
      this.client = new TranscribeStreamingClient({
        region,
        credentials: {
          accessKeyId: 'not-configured',
          secretAccessKey: 'not-configured'
        }
      });
    } else {
      this.client = new TranscribeStreamingClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
      logInfo('awsTranscribe', 'Info message', {});
    }
  }

  /**
   * Check if AWS Transcribe is properly configured
   */
  isConfigured(): boolean {
    const hasKeys = !!(import.meta.env.VITE_AWS_ACCESS_KEY_ID && import.meta.env.VITE_AWS_SECRET_ACCESS_KEY);
    logDebug('awsTranscribe', 'Debug message', {});
    return hasKeys;
  }

  /**
   * Start transcription with specified configuration
   */
  async startTranscription(
    config: Partial<TranscriptionConfig> = {},
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    // Set callbacks first
    this.onTranscript = onTranscript;
    this.onError = onError;
    
    if (!this.isConfigured()) {
      logWarn('awsTranscribe', 'Warning message', {});
      
      try {
        // Just get microphone access for recording
        this.audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true
          } 
        });
        
        this.isRecording = true;
        
        // Provide feedback that recording is happening
        if (onTranscript) {
          onTranscript({
            transcript: '[Recording audio - real-time transcription unavailable]',
            isPartial: true
          });
        }
        
        return;
      } catch (micError) {
        logError('awsTranscribe', 'Error message', {});
        onError(micError as Error);
        return;
      }
    }

    // Merge with default config
    this.currentConfig = {
      ...this.currentConfig,
      ...config
    };

    try {
      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // Create processor for audio chunks
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      // Connect audio pipeline
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Try to start AWS Transcribe Medical streaming
      try {
        logDebug('awsTranscribe', 'Debug message', {});
        await this.startAWSTranscribeStream();
        this.isRecording = true;
        logDebug('awsTranscribe', 'Debug message', {});
      } catch (streamError) {
        logError('awsTranscribe', 'Error message', {});
        logError('awsTranscribe', 'Error message', {});
        this.isRecording = true;
        
        // Notify user that we're recording without transcription
        if (onTranscript) {
          onTranscript({
            transcript: '[Recording audio - real-time transcription unavailable]',
            isPartial: true
          });
        }
      }
      
    } catch (error) {
      logError('awsTranscribe', 'Error message', {});
      
      // Try fallback to simple recording
      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          } 
        });
        
        this.isRecording = true;
        
        if (onTranscript) {
          onTranscript({
            transcript: '[Recording audio...]',
            isPartial: true
          });
        }
      } catch (fallbackError) {
        logError('awsTranscribe', 'Error message', {});
        onError(fallbackError as Error);
        this.cleanup();
      }
    }
  }

  /**
   * Start AWS Transcribe Medical streaming
   */
  private async startAWSTranscribeStream(): Promise<void> {
    const command = new StartMedicalStreamTranscriptionCommand({
      LanguageCode: 'en-US',
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: 16000,
      Specialty: this.currentConfig.specialty,
      Type: this.currentConfig.mode,
      ContentIdentificationType: MedicalContentIdentificationType.PHI,
      ShowSpeakerLabel: this.currentConfig.mode === 'CONVERSATION',
      NumberOfChannels: 1,
      EnableChannelIdentification: false
    });

    try {
      const response = await this.client.send(command);
      
      if (response.TranscriptResultStream) {
        this.processTranscriptStream(response.TranscriptResultStream);
      }
      
      // Set up audio chunk processing
      if (this.processor) {
        this.processor.onaudioprocess = (event) => {
          if (this.isRecording) {
            const audioData = event.inputBuffer.getChannelData(0);
            const pcmData = this.float32ToPCM16(audioData);
            // Send audio chunks to AWS Transcribe
            this.sendAudioChunk(pcmData);
          }
        };
      }
    } catch (error) {
      logError('awsTranscribe', 'Error message', {});
      throw error;
    }
  }

  /**
   * Process transcript stream from AWS
   */
  private async processTranscriptStream(stream: MedicalTranscriptResultStream): Promise<void> {
    try {
      // Check if stream is iterable
      if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
        logError('awsTranscribe', 'Error message', {});
        return;
      }
      
      for await (const event of stream) {
        if (event.TranscriptEvent?.Transcript?.Results) {
          for (const result of event.TranscriptEvent.Transcript.Results) {
            if (!result.IsPartial && result.Alternatives && result.Alternatives[0]) {
              const alternative = result.Alternatives[0];
              const items = alternative.Items || [];
              
              // Build transcript with speaker labels if available
              let transcript = '';
              let currentSpeaker = '';
              
              for (const item of items) {
                if (item.Content) {
                  // Check if speaker changed
                  if (this.currentConfig.mode === 'CONVERSATION' && item.Speaker) {
                    const speaker = `Speaker_${item.Speaker}`;
                    if (speaker !== currentSpeaker) {
                      if (transcript) transcript += '\n';
                      transcript += `[${speaker === 'Speaker_0' ? 'DOCTOR' : 'PATIENT'}]: `;
                      currentSpeaker = speaker;
                    }
                  }
                  
                  // Add content
                  transcript += item.Content + ' ';
                }
              }
              
              // Send to callback
              if (this.onTranscript && transcript.trim()) {
                this.onTranscript({
                  transcript: transcript.trim(),
                  isPartial: false,
                  confidence: alternative.Transcript ? 0.95 : 0,
                  speaker: currentSpeaker
                });
              }
            } else if (result.IsPartial && result.Alternatives && result.Alternatives[0]) {
              // Handle partial results for real-time feedback
              const alternative = result.Alternatives[0];
              if (this.onTranscript && alternative.Transcript) {
                this.onTranscript({
                  transcript: alternative.Transcript,
                  isPartial: true,
                  confidence: 0
                });
              }
            }
          }
        }
      }
    } catch (error) {
      logError('awsTranscribe', 'Error message', {});
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }

  /**
   * Convert Float32 audio to PCM16
   */
  private float32ToPCM16(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    return buffer;
  }

  /**
   * Send audio chunk to AWS Transcribe
   */
  private sendAudioChunk(pcmData: ArrayBuffer): void {
    // This would need WebSocket implementation for real streaming
    // For now, we'll accumulate and send in batches
    // In production, use WebSocket connection to AWS Transcribe
    logDebug('awsTranscribe', 'Debug message', {});
  }

  /**
   * Stop transcription
   */
  stopTranscription(): void {
    this.isRecording = false;
    this.cleanup();
    logDebug('awsTranscribe', 'Debug message', {});
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    this.onTranscript = null;
    this.onError = null;
  }

  /**
   * Set recording mode
   */
  setMode(mode: TranscriptionMode): void {
    this.currentConfig.mode = mode;
    this.currentConfig.enableSpeakerDiarization = mode === 'CONVERSATION';
  }

  /**
   * Set medical specialty
   */
  setSpecialty(specialty: MedicalSpecialty): void {
    this.currentConfig.specialty = specialty;
  }
}

// Export singleton instance
export const awsTranscribeService = new AWSTranscribeService();