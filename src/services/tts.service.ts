import { logError, logWarn, logInfo, logDebug } from './logger.service';
// Text-to-Speech Service using ElevenLabs API
class TTSService {
  private apiKey: string = '';
  private voiceId: string = '21m00Tcm4TlvDq8ikWAM'; // Rachel - American, young adult female
  private apiUrl: string = 'https://api.elevenlabs.io/v1';

  async speak(text: string): Promise<void> {
    // For demo, use browser's built-in TTS
    // In production, would use ElevenLabs API
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  async speakWithElevenLabs(text: string): Promise<void> {
    if (!this.apiKey) {
      logWarn('tts', 'Warning message', {});
      return this.speak(text);
    }

    try {
      const response = await fetch(`${this.apiUrl}/text-to-speech/${this.voiceId}`, {
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
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('ElevenLabs API error');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (error) {
      logError('tts', 'Error message', {});
      // Fallback to browser TTS
      return this.speak(text);
    }
  }

  stop(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  setVoiceId(id: string): void {
    this.voiceId = id;
  }
}

export const ttsService = new TTSService();
