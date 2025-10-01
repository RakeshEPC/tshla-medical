import { logError, logWarn, logInfo, logDebug } from './logger.service';
// ElevenLabs Service with multiple voice options
export interface Voice {
  id: string;
  name: string;
  description: string;
  preview_url?: string;
}

export const ELEVENLABS_VOICES: Voice[] = [
  {
    id: 'no8OzvzKgcdKN2SUsP8W',
    name: 'Custom Voice',
    description: 'Custom medical professional voice',
  },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'American, young adult female' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'American, young adult female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'American, young adult female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'American, young adult male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'American, middle-aged male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'American, middle-aged male' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', description: 'American, young adult male' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'British, middle-aged male' },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Nicole', description: 'American, young adult female' },
  { id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Michael', description: 'American, middle-aged male' },
];

class ElevenLabsService {
  private apiKey: string = '';
  private currentVoiceId: string = '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel - American, young adult female
  private apiUrl: string = 'https://api.elevenlabs.io/v1';
  private audioQueue: HTMLAudioElement[] = [];
  private isPlaying: boolean = false;

  constructor() {
    // Load API key from environment variable only
    this.apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || '';

    // Force Rachel as default for all users on initialization
    const voiceVersion = localStorage.getItem('voice_version');
    if (voiceVersion !== 'v2_rachel_default') {
      // Clear old voice preference and set Rachel
      localStorage.setItem('elevenlabs_voice_id', '21m00Tcm4TlvDq8ikWAM');
      localStorage.setItem('voice_version', 'v2_rachel_default');
      this.currentVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel
    } else {
      // Load current preference (which should be Rachel after the update)
      this.currentVoiceId = localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM';
    }
  }

  setApiKey(key: string): void {
    // For HIPAA compliance, don't store API keys in localStorage
    logWarn('elevenlabs', 'Warning message', {});
    this.apiKey = key;
  }

  getApiKey(): string {
    // Only use environment variable for API key
    return this.apiKey || import.meta.env.VITE_ELEVENLABS_API_KEY || '';
  }

  setVoice(voiceId: string): void {
    this.currentVoiceId = voiceId;
    localStorage.setItem('elevenlabs_voice_id', voiceId);
  }

  getVoice(): string {
    // Check if we need to force update to Rachel
    const voiceVersion = localStorage.getItem('voice_version');
    if (voiceVersion !== 'v2_rachel_default') {
      // Force update to Rachel for all users (one-time update)
      this.currentVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel
      localStorage.setItem('elevenlabs_voice_id', '21m00Tcm4TlvDq8ikWAM');
      localStorage.setItem('voice_version', 'v2_rachel_default');
    } else if (!this.currentVoiceId) {
      // Otherwise use stored preference or Rachel as default
      this.currentVoiceId = localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM';
    }
    return this.currentVoiceId;
  }

  async speak(text: string, voiceId?: string): Promise<void> {
    const voice = voiceId || this.currentVoiceId;

    // ALWAYS stop any existing speech first to prevent overlap
    this.stop();

    // Check if we have an API key
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is not configured');
    }

    try {
      const response = await fetch(`${this.apiUrl}/text-to-speech/${voice}`, {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.65,
            similarity_boost: 0.85,
            style: 0.75,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('ElevenLabs API key is invalid or expired (401 Unauthorized)');
        }
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Return a promise that resolves when audio finishes playing
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          this.isPlaying = false;
          resolve();
        };

        audio.onerror = error => {
          this.isPlaying = false;
          logError('elevenlabs', 'Error message', {});
          reject(new Error('Audio playback failed'));
        };

        this.isPlaying = true;
        audio.play().catch(error => {
          logError('elevenlabs', 'Error message', {});
          this.isPlaying = false;

          // Check if this is an autoplay policy error
          if (error.name === 'NotAllowedError' || error.message.includes("user didn't interact")) {
            logDebug('elevenlabs', 'Debug message', {});
            // Don't use fallback for autoplay issues - just resolve silently
            resolve();
          } else {
            // For other errors, reject to potentially trigger fallback
            reject(error);
          }
        });
      });
    } catch (error: any) {
      logError('elevenlabs', 'Error message', {});

      // Only suppress autoplay errors
      if (error?.name === 'NotAllowedError' || error?.message?.includes("user didn't interact")) {
        logDebug('elevenlabs', 'Debug message', {});
        return Promise.resolve();
      }

      // For all other errors, throw them - no fallback
      throw error;
    }
  }

  private async playNext(): Promise<void> {
    if (this.isPlaying || this.audioQueue.length === 0) return;

    this.isPlaying = true;
    const audio = this.audioQueue.shift()!;

    audio.onended = () => {
      this.isPlaying = false;
      this.playNext();
    };

    await audio.play();
  }

  private fallbackSpeak(text: string): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to select a better voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google'));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  }

  private fallbackSpeakAsync(text: string): Promise<void> {
    return new Promise(resolve => {
      if ('speechSynthesis' in window) {
        // Cancel any existing speech first
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Try to select a better voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google'));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = error => {
          logDebug('elevenlabs', 'Debug message', {});
          resolve();
        };

        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          logDebug('elevenlabs', 'Debug message', {});
          resolve();
        }
      } else {
        resolve();
      }
    });
  }

  stop(): void {
    // Stop all audio
    this.audioQueue.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.audioQueue = [];
    this.isPlaying = false;

    // Stop browser TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  // Public method to check if audio is currently playing
  getIsPlaying(): boolean {
    return this.isPlaying || window.speechSynthesis.speaking;
  }

  async testVoice(voiceId: string): Promise<void> {
    await this.speak('Hello, this is a test of the voice you selected.', voiceId);
  }
}

export const elevenLabsService = new ElevenLabsService();
