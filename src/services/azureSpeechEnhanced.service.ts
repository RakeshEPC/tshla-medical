import { logError, logWarn, logInfo, logDebug } from './logger.service';
/**
 * Enhanced Azure Speech Service with Full Voice Support
 * Best quality settings and proper stop/start functionality
 */

export interface AzureVoice {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  locale: string;
  styles?: string[];
  description: string;
}

// Complete list of Azure Neural voices for en-US
export const AZURE_NEURAL_VOICES: AzureVoice[] = [
  // Female Voices
  { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'Female', locale: 'en-US', 
    styles: ['assistant', 'chat', 'customerservice', 'newscast', 'angry', 'cheerful', 'sad', 'excited', 'friendly', 'terrified', 'shouting', 'unfriendly', 'whispering', 'hopeful'],
    description: 'Natural and versatile' },
  { id: 'en-US-AriaNeural', name: 'Aria', gender: 'Female', locale: 'en-US',
    styles: ['chat', 'customerservice', 'narration-professional', 'newscast-casual', 'newscast-formal', 'cheerful', 'empathetic', 'angry', 'sad', 'excited', 'friendly', 'terrified', 'shouting', 'unfriendly', 'whispering', 'hopeful'],
    description: 'Warm and expressive' },
  { id: 'en-US-AmberNeural', name: 'Amber', gender: 'Female', locale: 'en-US',
    styles: [], description: 'Clear and pleasant' },
  { id: 'en-US-AshleyNeural', name: 'Ashley', gender: 'Female', locale: 'en-US',
    styles: [], description: 'Professional tone' },
  { id: 'en-US-CoraNeural', name: 'Cora', gender: 'Female', locale: 'en-US',
    styles: [], description: 'Young and energetic' },
  { id: 'en-US-ElizabethNeural', name: 'Elizabeth', gender: 'Female', locale: 'en-US',
    styles: [], description: 'Formal and clear' },
  { id: 'en-US-MichelleNeural', name: 'Michelle', gender: 'Female', locale: 'en-US',
    styles: [], description: 'Friendly and warm' },
  { id: 'en-US-MonicaNeural', name: 'Monica', gender: 'Female', locale: 'en-US',
    styles: [], description: 'Professional' },
  { id: 'en-US-SaraNeural', name: 'Sara', gender: 'Female', locale: 'en-US',
    styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whispering'],
    description: 'Empathetic and kind' },
  { id: 'en-US-AnaNeural', name: 'Ana', gender: 'Female', locale: 'en-US',
    styles: [], description: 'Young adult voice' },
  
  // Male Voices
  { id: 'en-US-GuyNeural', name: 'Guy', gender: 'Male', locale: 'en-US',
    styles: ['newscast', 'angry', 'cheerful', 'sad', 'excited', 'friendly', 'terrified', 'shouting', 'unfriendly', 'whispering', 'hopeful'],
    description: 'Professional and clear' },
  { id: 'en-US-DavisNeural', name: 'Davis', gender: 'Male', locale: 'en-US',
    styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whispering'],
    description: 'Formal and articulate' },
  { id: 'en-US-TonyNeural', name: 'Tony', gender: 'Male', locale: 'en-US',
    styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whispering'],
    description: 'Warm narrator' },
  { id: 'en-US-JasonNeural', name: 'Jason', gender: 'Male', locale: 'en-US',
    styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whispering'],
    description: 'Casual and friendly' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', gender: 'Male', locale: 'en-US',
    styles: [], description: 'Deep and authoritative' },
  { id: 'en-US-EricNeural', name: 'Eric', gender: 'Male', locale: 'en-US',
    styles: [], description: 'Young professional' },
  { id: 'en-US-BrianNeural', name: 'Brian', gender: 'Male', locale: 'en-US',
    styles: [], description: 'News anchor voice' },
  { id: 'en-US-RogerNeural', name: 'Roger', gender: 'Male', locale: 'en-US',
    styles: [], description: 'Mature and trustworthy' },
  { id: 'en-US-SteffanNeural', name: 'Steffan', gender: 'Male', locale: 'en-US',
    styles: [], description: 'Technical narrator' },
  { id: 'en-US-AndrewNeural', name: 'Andrew', gender: 'Male', locale: 'en-US',
    styles: [], description: 'Young adult voice' }
];

export interface VoiceSettings {
  voiceId: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  style?: string;
}

class AzureSpeechEnhancedService {
  private readonly apiKey: string;
  private readonly region: string;
  private readonly endpoint: string;
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  constructor() {
    this.apiKey = import.meta.env.VITE_AZURE_SPEECH_KEY || '';
    this.region = import.meta.env.VITE_AZURE_SPEECH_REGION || 'centralus';
    this.endpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    
    if (typeof window !== 'undefined') {
      this.initAudioContext();
    }
    
    // Log configuration status
    logDebug('azureSpeechEnhanced', 'Debug message', {});
    logDebug('azureSpeechEnhanced', 'Debug message', {});
    logDebug('azureSpeechEnhanced', 'Debug message', {}); 
    logDebug('azureSpeechEnhanced', 'Debug message', {});
  }
  
  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      logDebug('azureSpeechEnhanced', 'Debug message', {});
    }
  }
  
  /**
   * Check if Azure Speech is properly configured
   */
  isConfigured(): boolean {
    return this.apiKey.length > 10 && this.apiKey !== 'your_azure_speech_key';
  }
  
  /**
   * Get all available voices
   */
  getVoices(): AzureVoice[] {
    return AZURE_NEURAL_VOICES;
  }
  
  /**
   * Get voice by ID
   */
  getVoice(voiceId: string): AzureVoice | undefined {
    return AZURE_NEURAL_VOICES.find(v => v.id === voiceId);
  }
  
  /**
   * Generate SSML with best quality settings
   */
  private generateSSML(text: string, settings: VoiceSettings): string {
    const voice = this.getVoice(settings.voiceId);
    if (!voice) {
      logWarn('azureSpeechEnhanced', 'Warning message', {});
    }
    
    const voiceId = voice?.id || 'en-US-JennyNeural';
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
    
    // Check if voice supports the requested style
    const supportsStyle = voice?.styles?.includes(style);
    
    // Build SSML with or without style based on voice capabilities
    if (supportsStyle) {
      return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
        <voice name="${voiceId}">
          <mstts:express-as style="${style}" styledegree="2">
            <prosody rate="${rate * 100}%" pitch="${pitch > 1 ? '+' : ''}${(pitch - 1) * 50}%" volume="${volume * 100}">
              ${cleanText}
            </prosody>
          </mstts:express-as>
        </voice>
      </speak>`;
    } else {
      // Voice doesn't support styles, use prosody only
      return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voiceId}">
          <prosody rate="${rate * 100}%" pitch="${pitch > 1 ? '+' : ''}${(pitch - 1) * 50}%" volume="${volume * 100}">
            ${cleanText}
          </prosody>
        </voice>
      </speak>`;
    }
  }
  
  /**
   * Synthesize speech using Azure REST API with best quality
   */
  async speak(text: string, settings: VoiceSettings): Promise<void> {
    logDebug('azureSpeechEnhanced', 'Debug message', {});
    
    if (!this.isConfigured()) {
      logWarn('azureSpeechEnhanced', 'Warning message', {});
      return this.fallbackToWebSpeech(text, settings);
    }
    
    // Stop any current playback
    this.stop();
    
    try {
      const ssml = this.generateSSML(text, settings);
      logDebug('azureSpeechEnhanced', 'Debug message', {});
      
      // Make request to Azure TTS API with best quality format
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': 'application/ssml+xml',
          // Use highest quality audio format
          'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3',
          'User-Agent': 'TSHLA-Medical-App'
        },
        body: ssml
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logError('azureSpeechEnhanced', 'Error message', {});
        
        if (response.status === 401) {
          throw new Error('Invalid Azure Speech API key');
        } else if (response.status === 403) {
          throw new Error('Azure Speech API access denied - check region');
        } else if (response.status === 429) {
          throw new Error('Azure Speech API rate limit exceeded');
        } else if (response.status === 400) {
          logError('azureSpeechEnhanced', 'Error message', {});
          throw new Error('Invalid voice or SSML format');
        }
        throw new Error(`Azure Speech API error: ${response.status}`);
      }
      
      logInfo('azureSpeechEnhanced', 'Info message', {}); 
      
      // Get audio data
      const audioData = await response.arrayBuffer();
      logDebug('azureSpeechEnhanced', 'Debug message', {});
      
      // Play audio using Web Audio API
      await this.playAudioBuffer(audioData);
      
    } catch (error) {
      logError('azureSpeechEnhanced', 'Error message', {});
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
      // Resume audio context if suspended
      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
      }
      
      // Decode audio data
      const audioBuffer = await this.audioContext!.decodeAudioData(audioData);
      logDebug('azureSpeechEnhanced', 'Debug message', {});
      
      // Create source and connect to speakers
      const source = this.audioContext!.createBufferSource();
      source.buffer = audioBuffer;
      
      // Create gain node for volume control
      const gainNode = this.audioContext!.createGain();
      gainNode.gain.value = 1.0;
      
      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      // Store reference for stopping
      this.currentSource = source;
      this.isPlaying = true;
      
      // Handle playback end
      source.onended = () => {
        logDebug('azureSpeechEnhanced', 'Debug message', {});
        this.isPlaying = false;
        this.currentSource = null;
      };
      
      // Start playback
      source.start(0);
      logDebug('azureSpeechEnhanced', 'Debug message', {});
      
      // Return promise that resolves when playback ends
      return new Promise((resolve) => {
        source.onended = () => {
          this.isPlaying = false;
          this.currentSource = null;
          resolve();
        };
      });
      
    } catch (error) {
      logError('azureSpeechEnhanced', 'Error message', {});
      throw error;
    }
  }
  
  /**
   * Fallback to Web Speech API if Azure fails
   */
  private async fallbackToWebSpeech(text: string, settings: VoiceSettings): Promise<void> {
    logDebug('azureSpeechEnhanced', 'Debug message', {});
    
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }
      
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply settings
      utterance.rate = settings.rate || 1.0;
      utterance.pitch = settings.pitch || 1.0;
      utterance.volume = settings.volume || 1.0;
      
      // Try to find a matching voice
      const voices = speechSynthesis.getVoices();
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      
      // Try to match gender from Azure voice ID
      const isFemalevoice = settings.voiceId.includes('Female') || 
                           ['Jenny', 'Aria', 'Amber', 'Ashley', 'Cora', 'Elizabeth', 'Michelle', 'Monica', 'Sara', 'Ana']
                           .some(name => settings.voiceId.includes(name));
      
      if (englishVoices.length > 0) {
        const preferredVoice = englishVoices.find(v => 
          isFemalevoice ? (v.name.includes('Female') || v.name.includes('Samantha')) : v.name.includes('Male')
        );
        utterance.voice = preferredVoice || englishVoices[0];
      }
      
      this.currentUtterance = utterance;
      
      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };
      
      utterance.onerror = (error) => {
        this.currentUtterance = null;
        reject(error);
      };
      
      speechSynthesis.speak(utterance);
    });
  }
  
  /**
   * Stop all speech immediately
   */
  stop() {
    logDebug('azureSpeechEnhanced', 'Debug message', {});
    
    // Stop Azure audio
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // Source might already be stopped
      }
      this.currentSource = null;
    }
    
    // Stop Web Speech API
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    // Clear utterance reference
    this.currentUtterance = null;
    this.isPlaying = false;
    
    logDebug('azureSpeechEnhanced', 'Debug message', {});
  }
  
  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.isPlaying || (speechSynthesis && speechSynthesis.speaking);
  }
  
  /**
   * Test voice with sample text
   */
  async testVoice(voiceId: string, style?: string): Promise<void> {
    const voice = this.getVoice(voiceId);
    const voiceName = voice?.name || 'this voice';
    
    const testText = `Hello! This is ${voiceName} speaking. I'm using Azure Neural voice technology to provide natural, human-like speech. This voice is perfect for medical consultations and patient interactions.`;
    
    await this.speak(testText, { 
      voiceId, 
      style: style || 'friendly',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    });
  }
  
  /**
   * Get service status
   */
  getStatus(): string {
    if (!this.isConfigured()) {
      return '⚠️ Not configured - using browser voices';
    }
    return '✅ Azure Neural voices active (Best Quality)';
  }
}

// Export singleton instance
export const azureSpeechEnhanced = new AzureSpeechEnhancedService();

// Export types for components
export type { VoiceSettings };

// Export for components that need the class
export default AzureSpeechEnhancedService;