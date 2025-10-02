/**
 * Browser Text-to-Speech Service
 * Uses Web Speech API (built into all modern browsers)
 * Replaces ElevenLabs - no external API needed
 */

export class BrowserTTSService {
  private isSpeaking: boolean = false;

  /**
   * Speak text using browser's built-in TTS
   */
  async speak(text: string): Promise<void> {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser');
      return Promise.resolve();
    }

    // Stop any existing speech first
    this.stop();

    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Try to select a good voice (prefer Google voices if available)
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v =>
          v.lang.startsWith('en') &&
          (v.name.includes('Google') || v.name.includes('Microsoft'))
        );

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => {
          this.isSpeaking = false;
          resolve();
        };

        utterance.onerror = (error) => {
          this.isSpeaking = false;
          console.warn('Speech synthesis error:', error);
          resolve(); // Resolve instead of reject to avoid breaking UI
        };

        this.isSpeaking = true;
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        this.isSpeaking = false;
        console.warn('Speech synthesis error:', error);
        resolve();
      }
    });
  }

  /**
   * Stop any ongoing speech
   */
  stop(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  /**
   * Check if currently speaking
   */
  getIsPlaying(): boolean {
    return this.isSpeaking || (window.speechSynthesis?.speaking ?? false);
  }

  /**
   * Test voice with a sample message
   */
  async testVoice(): Promise<void> {
    await this.speak('Hello, this is a test of the browser speech system.');
  }

  /**
   * Get available voices (for potential voice selection UI)
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!('speechSynthesis' in window)) {
      return [];
    }
    return window.speechSynthesis.getVoices();
  }
}

// Export singleton instance
export const browserTTS = new BrowserTTSService();

// Default export for backward compatibility
export default browserTTS;
