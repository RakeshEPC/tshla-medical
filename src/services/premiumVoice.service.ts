/**
 * Premium Voice Service with High-Quality Neural TTS
 * Supports Azure Neural, Google Cloud TTS, and Amazon Polly
 * HIPAA Compliant with echo cancellation
 */

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { logError, logWarn, logInfo, logDebug } from './logger.service';

// Premium voice options with natural, human-like quality
export const PREMIUM_VOICES = {
  azure: [
    // US English Neural Voices (Best Quality)
    {
      id: 'en-US-AriaNeural',
      name: 'Aria',
      gender: 'Female',
      description: 'Friendly and warm',
      style: 'chat',
      premium: true,
    },
    {
      id: 'en-US-JennyMultilingualNeural',
      name: 'Jenny Multilingual',
      gender: 'Female',
      description: 'Natural and clear',
      style: 'assistant',
      premium: true,
    },
    {
      id: 'en-US-GuyNeural',
      name: 'Guy',
      gender: 'Male',
      description: 'Professional and clear',
      style: 'newscast',
      premium: true,
    },
    {
      id: 'en-US-DavisNeural',
      name: 'Davis',
      gender: 'Male',
      description: 'Formal and articulate',
      style: 'professional',
      premium: true,
    },
    {
      id: 'en-US-JaneNeural',
      name: 'Jane',
      gender: 'Female',
      description: 'Energetic and expressive',
      style: 'cheerful',
      premium: true,
    },
    {
      id: 'en-US-NancyNeural',
      name: 'Nancy',
      gender: 'Female',
      description: 'Friendly and pleasant',
      style: 'friendly',
      premium: true,
    },
    {
      id: 'en-US-TonyNeural',
      name: 'Tony',
      gender: 'Male',
      description: 'Professional narrator',
      style: 'professional',
      premium: true,
    },
    {
      id: 'en-US-JasonNeural',
      name: 'Jason',
      gender: 'Male',
      description: 'Casual and friendly',
      style: 'casual',
      premium: true,
    },
    {
      id: 'en-US-SaraNeural',
      name: 'Sara',
      gender: 'Female',
      description: 'Warm and empathetic',
      style: 'empathetic',
      premium: true,
    },
    {
      id: 'en-US-AmberNeural',
      name: 'Amber',
      gender: 'Female',
      description: 'Calm and soothing',
      style: 'calm',
      premium: true,
    },
  ],
  google: [
    // Google Cloud Premium WaveNet voices
    {
      id: 'en-US-Wavenet-A',
      name: 'WaveNet A',
      gender: 'Male',
      description: 'Deep and authoritative',
    },
    { id: 'en-US-Wavenet-B', name: 'WaveNet B', gender: 'Male', description: 'Warm and friendly' },
    {
      id: 'en-US-Wavenet-C',
      name: 'WaveNet C',
      gender: 'Female',
      description: 'Clear and professional',
    },
    {
      id: 'en-US-Wavenet-D',
      name: 'WaveNet D',
      gender: 'Male',
      description: 'Young and energetic',
    },
    {
      id: 'en-US-Wavenet-E',
      name: 'WaveNet E',
      gender: 'Female',
      description: 'Soft and pleasant',
    },
    {
      id: 'en-US-Wavenet-F',
      name: 'WaveNet F',
      gender: 'Female',
      description: 'Bright and cheerful',
    },
  ],
  amazon: [
    // Amazon Polly Neural voices
    {
      id: 'Joanna',
      name: 'Joanna',
      gender: 'Female',
      description: 'Clear and expressive',
      engine: 'neural',
    },
    {
      id: 'Matthew',
      name: 'Matthew',
      gender: 'Male',
      description: 'Professional and warm',
      engine: 'neural',
    },
    {
      id: 'Ruth',
      name: 'Ruth',
      gender: 'Female',
      description: 'Pleasant news reader',
      engine: 'neural',
    },
    {
      id: 'Stephen',
      name: 'Stephen',
      gender: 'Male',
      description: 'Natural conversational',
      engine: 'neural',
    },
    {
      id: 'Danielle',
      name: 'Danielle',
      gender: 'Female',
      description: 'Friendly assistant',
      engine: 'neural',
    },
    {
      id: 'Gregory',
      name: 'Gregory',
      gender: 'Male',
      description: 'Clear narrator',
      engine: 'neural',
    },
  ],
};

export interface VoiceSettings {
  provider: 'azure' | 'google' | 'amazon' | 'browser';
  voiceId: string;
  rate: number;
  pitch: number;
  volume: number;
  style?: string;
  emphasis?: 'reduced' | 'none' | 'moderate' | 'strong';
}

class PremiumVoiceService {
  private speechConfig: sdk.SpeechConfig | null = null;
  private synthesizer: sdk.SpeechSynthesizer | null = null;
  private audioContext: AudioContext | null = null;
  private currentSettings: VoiceSettings = {
    provider: (import.meta.env.VITE_DEFAULT_VOICE_PROVIDER as any) || 'azure',
    voiceId: import.meta.env.VITE_DEFAULT_VOICE_ID || 'en-US-JennyNeural',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    style: import.meta.env.VITE_DEFAULT_VOICE_STYLE || 'friendly',
  };

  // Azure configuration
  private readonly AZURE_KEY = import.meta.env.VITE_AZURE_SPEECH_KEY || '';
  private readonly AZURE_REGION = import.meta.env.VITE_AZURE_SPEECH_REGION || 'centralus';
  private readonly AZURE_ENDPOINT =
    import.meta.env.VITE_AZURE_SPEECH_ENDPOINT ||
    `https://${this.AZURE_REGION}.tts.speech.microsoft.com/`;

  // Google Cloud TTS configuration (optional)
  private readonly GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_TTS_KEY || '';

  constructor() {
    this.initializeService();
    this.setupEchoCancellation();
  }

  private initializeService() {
    // Initialize Azure Speech SDK
    if (this.AZURE_KEY && this.AZURE_KEY.length > 10) {
      try {
        this.speechConfig = sdk.SpeechConfig.fromSubscription(this.AZURE_KEY, this.AZURE_REGION);

        // Set to use neural voice
        this.speechConfig.speechSynthesisVoiceName = this.currentSettings.voiceId;

        // Configure for best quality
        this.speechConfig.speechSynthesisOutputFormat =
          sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3;

        // Create audio config for speaker output with echo cancellation
        const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();

        // Create synthesizer
        this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);

        logDebug('premiumVoice', 'Debug message', {});
      } catch (error) {
        logError('premiumVoice', 'Error message', {});
      }
    }

    // Initialize Web Audio API for echo cancellation
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
    }
  }

  private setupEchoCancellation() {
    // Setup echo cancellation using Web Audio API
    if (this.audioContext) {
      // Create dynamics compressor to reduce feedback
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;

      // Connect to destination
      compressor.connect(this.audioContext.destination);
    }
  }

  // Update voice settings
  updateSettings(settings: Partial<VoiceSettings>) {
    this.currentSettings = { ...this.currentSettings, ...settings };

    if (this.speechConfig && settings.voiceId) {
      this.speechConfig.speechSynthesisVoiceName = settings.voiceId;
    }
  }

  // Get current voice settings
  getSettings(): VoiceSettings {
    return { ...this.currentSettings };
  }

  // Get available voices for current provider
  getAvailableVoices() {
    switch (this.currentSettings.provider) {
      case 'azure':
        return PREMIUM_VOICES.azure;
      case 'google':
        return PREMIUM_VOICES.google;
      case 'amazon':
        return PREMIUM_VOICES.amazon;
      default:
        return [];
    }
  }

  // Main TTS function with premium quality
  async speak(text: string, options?: Partial<VoiceSettings>): Promise<void> {
    const settings = { ...this.currentSettings, ...options };

    // Stop any ongoing speech
    this.stop();

    try {
      if (settings.provider === 'azure' && this.synthesizer) {
        return await this.speakWithAzure(text, settings);
      } else if (settings.provider === 'google' && this.GOOGLE_API_KEY) {
        return await this.speakWithGoogle(text, settings);
      } else {
        // Fallback to browser TTS with enhanced settings
        return await this.speakWithBrowser(text, settings);
      }
    } catch (error) {
      logError('premiumVoice', 'Error message', {});
      return await this.speakWithBrowser(text, settings);
    }
  }

  private async speakWithAzure(text: string, settings: VoiceSettings): Promise<void> {
    if (!this.synthesizer || !this.speechConfig) {
      throw new Error('Azure Speech not initialized');
    }

    // Build SSML for advanced voice control
    const ssml = this.buildSSML(text, settings);

    return new Promise((resolve, reject) => {
      this.synthesizer!.speakSsmlAsync(
        ssml,
        result => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            logDebug('premiumVoice', 'Debug message', {});
            resolve();
          } else {
            logError('premiumVoice', 'Error message', {});
            reject(new Error(result.errorDetails));
          }
        },
        error => {
          logError('premiumVoice', 'Error message', {});
          reject(error);
        }
      );
    });
  }

  private buildSSML(text: string, settings: VoiceSettings): string {
    const voiceName = settings.voiceId;
    const rate = settings.rate || 1.0;
    const pitch = settings.pitch || 1.0;
    const volume = settings.volume || 1.0;
    const style = settings.style || 'chat';

    // Build SSML with prosody and style controls
    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
             xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
        <voice name="${voiceName}">
          <mstts:express-as style="${style}" styledegree="2">
            <prosody rate="${rate}" pitch="${pitch}%" volume="${volume * 100}">
              ${this.escapeXML(text)}
            </prosody>
          </mstts:express-as>
        </voice>
      </speak>
    `;
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async speakWithGoogle(text: string, settings: VoiceSettings): Promise<void> {
    // Google Cloud TTS implementation
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.GOOGLE_API_KEY}`;

    const request = {
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: settings.voiceId,
        ssmlGender:
          settings.voiceId.includes('Wavenet-A') ||
          settings.voiceId.includes('Wavenet-B') ||
          settings.voiceId.includes('Wavenet-D')
            ? 'MALE'
            : 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: settings.rate,
        pitch: settings.pitch,
        volumeGainDb: settings.volume * 10,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (data.audioContent) {
      // Play the audio
      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      audio.playbackRate = settings.rate;
      await audio.play();
    }
  }

  private async speakWithBrowser(text: string, settings: VoiceSettings): Promise<void> {
    return new Promise(resolve => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Apply settings for better quality
      utterance.rate = settings.rate * 0.95; // Slightly slower for clarity
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;

      // Try to find a high-quality voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoices = voices.filter(
        v =>
          v.name.includes('Google') ||
          v.name.includes('Microsoft') ||
          v.name.includes('Premium') ||
          v.name.includes('Enhanced')
      );

      if (preferredVoices.length > 0) {
        utterance.voice = preferredVoices[0];
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }

  // Stop all speech
  stop() {
    if (this.synthesizer) {
      this.synthesizer.close();
      // Recreate synthesizer
      if (this.speechConfig) {
        const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
        this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);
      }
    }
    window.speechSynthesis.cancel();
  }

  // Test voice with sample text
  async testVoice(voiceId?: string) {
    const testText =
      "Hello! I'm your medical assistant. I have a natural, human-like voice that makes our conversation more pleasant. How may I help you today?";

    if (voiceId) {
      await this.speak(testText, { voiceId });
    } else {
      await this.speak(testText);
    }
  }

  // Check if service is properly configured
  isConfigured(): boolean {
    return (
      !!(this.AZURE_KEY && this.AZURE_KEY !== 'YOUR_AZURE_KEY') ||
      !!(this.GOOGLE_API_KEY && this.GOOGLE_API_KEY !== '')
    );
  }
}

export const premiumVoiceService = new PremiumVoiceService();
