// ElevenLabs Voice Service - Stub implementation
// This service provides text-to-speech feedback for the dictation interface

export const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Adam', description: 'Professional male' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Friendly female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Warm female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Mature male' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young female' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Casual male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Authoritative male' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Documentary narrator' },
  { id: 'Yko7PKHZNXotIFUBG7I9', name: 'Callum', description: 'British male' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'British narrator' },
];

class ElevenLabsService {
  private currentVoiceId: string = ELEVENLABS_VOICES[0].id;
  private enabled: boolean = false; // Disabled by default

  getVoice(): string {
    return this.currentVoiceId;
  }

  setVoice(voiceId: string): void {
    this.currentVoiceId = voiceId;
  }

  speak(text: string): void {
    // Stub implementation - could be enhanced with actual TTS
    console.log(`[ElevenLabs] Speaking: ${text}`);
  }

  testVoice(voiceId: string): void {
    // Stub implementation
    console.log(`[ElevenLabs] Testing voice: ${voiceId}`);
  }
}

export const elevenLabsService = new ElevenLabsService();
