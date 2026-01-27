/**
 * ElevenLabs Voice Service
 * Professional text-to-speech for patient audio summaries
 * Uses Bella voice (professional female) for medical summaries
 */

import { logInfo, logError, logDebug } from './logger.service';

export const ELEVENLABS_VOICES = [
  { id: 'f6qhiUOSRVGsfwvD4oSU', name: 'Rakesh Patel', description: 'Custom voice' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Adam', description: 'Professional male' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Friendly female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Warm professional female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Mature male' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young female' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Casual male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Authoritative male' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Documentary narrator' },
  { id: 'Yko7PKHZNXotIFUBG7I9', name: 'Callum', description: 'British male' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'British narrator' },
];

// Default voice for patient summaries: Bella (professional female)
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella

export interface ElevenLabsAudioResult {
  audioUrl: string; // Blob URL for browser playback
  audioBlob: Blob; // Raw blob for Twilio/backend
  durationSeconds: number; // Estimated duration
}

class ElevenLabsService {
  private apiKey: string;
  private currentVoiceId: string = DEFAULT_VOICE_ID;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    this.apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

    if (!this.apiKey) {
      logError('ElevenLabs', 'API key not configured (VITE_ELEVENLABS_API_KEY missing)');
    } else {
      logInfo('ElevenLabs', 'Service initialized with Bella voice (professional female)');
    }
  }

  /**
   * Generate speech from text using ElevenLabs API
   * Returns audio blob and URL for playback
   */
  async generateSpeech(
    text: string,
    voiceId?: string
  ): Promise<ElevenLabsAudioResult> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const selectedVoiceId = voiceId || this.currentVoiceId;

    logInfo('ElevenLabs', `Generating speech (${text.length} chars)`, {
      voice: ELEVENLABS_VOICES.find(v => v.id === selectedVoiceId)?.name || 'Unknown'
    });

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${selectedVoiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5, // Balanced for natural speech
              similarity_boost: 0.75, // Higher for consistent professional voice
              style: 0.0, // No style exaggeration
              use_speaker_boost: true // Clarity boost
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logError('ElevenLabs', `API error (${response.status})`, { error: errorText });
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Estimate duration (rough: 150 words per minute average speaking rate)
      const wordCount = text.split(/\s+/).length;
      const durationSeconds = Math.ceil((wordCount / 150) * 60);

      logInfo('ElevenLabs', `Speech generated successfully`, {
        blobSize: `${(audioBlob.size / 1024).toFixed(1)} KB`,
        estimatedDuration: `${durationSeconds}s`
      });

      return {
        audioUrl,
        audioBlob,
        durationSeconds
      };
    } catch (error: any) {
      logError('ElevenLabs', `Failed to generate speech: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current voice ID
   */
  getVoice(): string {
    return this.currentVoiceId;
  }

  /**
   * Set voice for future generations
   */
  setVoice(voiceId: string): void {
    const voice = ELEVENLABS_VOICES.find(v => v.id === voiceId);
    if (!voice) {
      logError('ElevenLabs', `Invalid voice ID: ${voiceId}`);
      return;
    }

    this.currentVoiceId = voiceId;
    logInfo('ElevenLabs', `Voice changed to: ${voice.name}`);
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const elevenLabsService = new ElevenLabsService();
