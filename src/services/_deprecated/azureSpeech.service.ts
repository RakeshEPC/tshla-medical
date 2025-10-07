import { logError, logWarn, logInfo, logDebug } from '../logger.service';
/**
 * Azure Speech Service - Production Ready
 * Handles common errors and works on both localhost and production
 */

export interface AzureVoiceSettings {
  voiceId: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  style?: string;
}

class AzureSpeechService {
  private readonly apiKey: string;
  private readonly region: string;
  private readonly endpoint: string;
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;

  constructor() {
    this.apiKey = import.meta.env.VITE_AZURE_SPEECH_KEY || '';
    this.region = import.meta.env.VITE_AZURE_SPEECH_REGION || 'centralus';
    this.endpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    // Initialize audio context on first user interaction
    if (typeof window !== 'undefined') {
      this.initAudioContext();
    }
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Check if Azure Speech is properly configured
   */
  isConfigured(): boolean {
    return this.apiKey.length > 10 && this.apiKey !== 'your_azure_speech_key';
  }

  /**
   * Generate SSML for Azure Neural voices
   */
  private generateSSML(text: string, settings: AzureVoiceSettings): string {
    const voiceId = settings.voiceId || 'en-US-JennyNeural';
    const rate = settings.rate || 1.0;
    const pitch = settings.pitch || 1.0;
    const volume = settings.volume || 1.0;
    const style = settings.style || 'friendly';

    // Clean text for SSML
    const cleanText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Build SSML with style support for neural voices
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
      <voice name="${voiceId}">
        <mstts:express-as style="${style}" styledegree="2">
          <prosody rate="${rate * 100}%" pitch="${pitch > 1 ? '+' : ''}${(pitch - 1) * 50}%" volume="${volume * 100}">
            ${cleanText}
          </prosody>
        </mstts:express-as>
      </voice>
    </speak>`;
  }

  /**
   * Synthesize speech using Azure REST API
   */
  async speak(
    text: string,
    settings: AzureVoiceSettings = { voiceId: 'en-US-JennyNeural' }
  ): Promise<void> {
    if (!this.isConfigured()) {
      logWarn('azureSpeech', 'Warning message', {});
      return this.fallbackToWebSpeech(text, settings);
    }

    try {
      // Stop any current playback
      this.stop();

      const ssml = this.generateSSML(text, settings);

      // Make request to Azure TTS API
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3',
          'User-Agent': 'TSHLA-Medical-App',
        },
        body: ssml,
      });

      if (!response.ok) {
        // Handle common Azure errors
        if (response.status === 401) {
          throw new Error('Invalid Azure Speech API key');
        } else if (response.status === 403) {
          throw new Error('Azure Speech API access denied - check region');
        } else if (response.status === 429) {
          throw new Error('Azure Speech API rate limit exceeded');
        } else if (response.status === 400) {
          const errorText = await response.text();
          logError('azureSpeech', 'Error message', {});
          throw new Error('Invalid voice or SSML format');
        }
        throw new Error(`Azure Speech API error: ${response.status}`);
      }

      // Get audio data
      const audioData = await response.arrayBuffer();

      // Play audio using Web Audio API
      await this.playAudioBuffer(audioData);
    } catch (error) {
      logError('azureSpeech', 'Error message', {});
      // Fallback to browser TTS
      return this.fallbackToWebSpeech(text, settings);
    }
  }

  /**
   * Play audio buffer using Web Audio API
   */
  private async playAudioBuffer(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.initAudioContext();
    }

    try {
      // Resume audio context if suspended (Chrome autoplay policy)
      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
      }

      // Decode audio data
      const audioBuffer = await this.audioContext!.decodeAudioData(audioData);

      // Create source and connect to speakers
      const source = this.audioContext!.createBufferSource();
      source.buffer = audioBuffer;

      // Add gain node for volume control
      const gainNode = this.audioContext!.createGain();
      gainNode.gain.value = 0.9;

      source.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      // Track playback state
      this.isPlaying = true;
      source.onended = () => {
        this.isPlaying = false;
      };

      // Start playback
      source.start(0);
    } catch (error) {
      logError('azureSpeech', 'Error message', {});
      throw error;
    }
  }

  /**
   * Fallback to Web Speech API if Azure fails
   */
  private async fallbackToWebSpeech(text: string, settings: AzureVoiceSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);

      // Apply settings
      utterance.rate = settings.rate || 1.0;
      utterance.pitch = settings.pitch || 1.0;
      utterance.volume = settings.volume || 1.0;

      // Find best matching voice
      const voices = speechSynthesis.getVoices();
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      if (englishVoices.length > 0) {
        // Prefer female voices for medical context
        const femaleVoice = englishVoices.find(
          v => v.name.includes('Female') || v.name.includes('Samantha')
        );
        utterance.voice = femaleVoice || englishVoices[0];
      }

      utterance.onend = () => resolve();
      utterance.onerror = error => reject(error);

      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Stop current speech
   */
  stop() {
    this.isPlaying = false;

    // Stop Web Speech API
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }

    // Stop any audio context playback
    if (this.audioContext && this.audioContext.state === 'running') {
      // This will stop all sources
      this.audioContext.suspend();
      this.audioContext.resume();
    }
  }

  /**
   * Test voice with sample text
   */
  async testVoice(voiceId: string): Promise<void> {
    const testText =
      "Hello! I'm your medical assistant. I have a natural, human-like voice powered by Azure Neural technology. How can I help you today?";
    await this.speak(testText, {
      voiceId,
      style: 'friendly',
      rate: 1.0,
      pitch: 1.0,
      volume: 0.9,
    });
  }

  /**
   * Get voice status
   */
  getStatus(): string {
    if (!this.isConfigured()) {
      return 'Not configured - using browser voices';
    }
    return 'Azure Neural voices active';
  }
}

// Export singleton instance
export const azureSpeechService = new AzureSpeechService();

// Export for components that need the class
export default AzureSpeechService;
